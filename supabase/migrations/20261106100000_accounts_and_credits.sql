-- Accounts, license credits, deletion requests and the operator's audit log.
-- References: docs/05-modules/administration.md (ADM-xxx), docs/05-modules/control-tower.md (CT-xxx), ADR 0002.
--
-- Every write goes through a function below, which checks who calls it; tables keep read policies only.
-- Rules enforced here:
--   * an account belongs to exactly one organization (ADM-030);
--   * creating an account uses a credit, in the same transaction, and is refused without one (ADM-011);
--   * an organization always keeps an active Admin (ADM-016); an Admin never changes or suspends themselves (ADM-017);
--   * a deletion request suspends the account; only the operator's validation removes it and returns its credit,
--     and the operator only ever sees counts (ADM-020, ADM-021, CT-020, CT-021);
--   * credits never go below the accounts that exist (CT-013);
--   * every operator action is written to an append-only audit log (CT-040).

------------------------------------------------------------------------------------------------------------------------
-- Accounts (app.memberships)
------------------------------------------------------------------------------------------------------------------------

alter table app.memberships
  add column email                 text,
  add column display_name          text,
  add column joined_at             timestamptz,
  add column deletion_requested_at timestamptz;

update app.memberships m
   set email = u.email, display_name = coalesce(u.email, ''), joined_at = m.created_at
  from auth.users u
 where u.id = m.user_id;

alter table app.memberships
  alter column email set not null,
  alter column display_name set not null,
  add constraint memberships_display_name_check check (length(btrim(display_name)) > 0),
  add constraint memberships_one_organization unique (user_id),
  add constraint memberships_deletion_suspends check (deletion_requested_at is null or status = 'suspended');

comment on column app.memberships.joined_at is 'When the invited person chose a password; null while the invitation is pending (ADM-012).';
comment on column app.memberships.deletion_requested_at is 'Set by an Admin (ADM-020); the operator validates the deletion without seeing which accounts (CT-021).';

drop policy "Admins add memberships" on app.memberships;
drop policy "Admins update memberships" on app.memberships;
drop policy "Admins delete memberships" on app.memberships;

------------------------------------------------------------------------------------------------------------------------
-- Projects: description, readable identifier, archive; deletion by Admins only (ADM-040…ADM-042, NAV-020)
------------------------------------------------------------------------------------------------------------------------

alter table app.projects
  add column description text not null default '',
  add column slug        text,
  add column archived_at timestamptz;

update app.projects
   set slug = coalesce(nullif(trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')), ''), 'project')
              || '-' || left(id::text, 4);

alter table app.projects
  alter column slug set not null,
  add constraint projects_slug_check check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 60),
  add constraint projects_slug_unique unique (organization_id, slug);

-- A project created without a slug gets one from its name, made unique in the organization (`acme`, `acme-2`…).
create function app.project_default_slug()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base text;
  candidate text;
  n integer := 1;
begin
  if new.slug is not null then
    return new;
  end if;
  base := left(coalesce(nullif(trim(both '-' from regexp_replace(lower(new.name), '[^a-z0-9]+', '-', 'g')), ''), 'project'), 50);
  base := trim(both '-' from base);
  candidate := base;
  while exists (select 1 from app.projects p where p.organization_id = new.organization_id and p.slug = candidate) loop
    n := n + 1;
    candidate := base || '-' || n;
  end loop;
  new.slug := candidate;
  return new;
end;
$$;

create trigger projects_default_slug
  before insert on app.projects
  for each row execute function app.project_default_slug();

drop policy "Editors delete projects" on app.projects;
create policy "Admins delete projects"
  on app.projects for delete to authenticated
  using ((select app.has_role(organization_id, array['admin']::app.member_role[])));

------------------------------------------------------------------------------------------------------------------------
-- Operator audit log (CT-040, ARC-203)
------------------------------------------------------------------------------------------------------------------------

create table licensing.operator_audit (
  id              bigint generated always as identity primary key,
  at              timestamptz not null default now(),
  operator_id     uuid not null,
  action          text not null,
  organization_id uuid references licensing.organizations (id) on delete set null,
  details         jsonb not null default '{}'::jsonb
);
create index operator_audit_at_idx on licensing.operator_audit (at desc);
create index operator_audit_organization_idx on licensing.operator_audit (organization_id);
comment on table licensing.operator_audit is 'Append-only log of operator actions, figures only, never customer content (CT-040).';

alter table licensing.operator_audit enable row level security;
create policy "Operators read the audit log"
  on licensing.operator_audit for select to authenticated
  using ((select licensing.is_operator()));
revoke insert, update, delete, truncate on licensing.operator_audit from authenticated;

-- Organizations change only through the functions below, so that every change is audited.
drop policy "Operators create organizations" on licensing.organizations;
drop policy "Operators update organizations" on licensing.organizations;
drop policy "Operators delete organizations" on licensing.organizations;
revoke insert, update, delete, truncate on licensing.organizations from authenticated;

------------------------------------------------------------------------------------------------------------------------
-- Integrity triggers
------------------------------------------------------------------------------------------------------------------------

-- ADM-016: after any change, an organization that has accounts keeps at least one active Admin.
create function app.keep_an_active_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  org uuid := coalesce(new.organization_id, old.organization_id);
begin
  if exists (select 1 from app.memberships where organization_id = org)
     and not exists (
       select 1 from app.memberships
        where organization_id = org and role = 'admin' and status = 'active'
     ) then
    raise exception 'The organization must keep at least one active Admin (ADM-016).' using errcode = 'P0001';
  end if;
  return null;
end;
$$;

create constraint trigger memberships_keep_an_active_admin
  after update or delete on app.memberships
  deferrable initially immediate
  for each row execute function app.keep_an_active_admin();

-- CT-013: credits never go below the number of accounts.
create function licensing.credits_cover_accounts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.credits_granted < (select count(*) from app.memberships m where m.organization_id = new.id) then
    raise exception 'Credits cannot go below the number of accounts (CT-013).' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger organizations_credits_cover_accounts
  before update of credits_granted on licensing.organizations
  for each row execute function licensing.credits_cover_accounts();

------------------------------------------------------------------------------------------------------------------------
-- Helpers
------------------------------------------------------------------------------------------------------------------------

-- The organization of the current user, when their account is active.
create function app.my_organization()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.organization_id from app.memberships m
   where m.user_id = (select auth.uid()) and m.status = 'active';
$$;

create function app.require_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org uuid := app.my_organization();
begin
  if org is null or not app.has_role(org, array['admin']::app.member_role[]) then
    raise exception 'Only an Admin can do this.' using errcode = '42501';
  end if;
  return org;
end;
$$;

create function licensing.require_operator()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not licensing.is_operator() then
    raise exception 'Only the operator can do this.' using errcode = '42501';
  end if;
  return (select auth.uid());
end;
$$;

-- A user just invited through Supabase Auth: never signed in, created minutes ago, not an operator, no account yet.
-- Prevents attaching an existing person (e.g. an operator) to an organization.
create function app.is_fresh_invitee(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users u
     where u.id = target
       and u.last_sign_in_at is null
       and u.created_at > now() - interval '15 minutes'
  )
  and not exists (select 1 from licensing.operators o where o.user_id = target)
  and not exists (select 1 from app.memberships m where m.user_id = target);
$$;

-- Inserts an account after checking and using a credit, with the organization row locked (ADM-011).
create function app.insert_account(org uuid, target uuid, account_email text, account_name text, account_role app.member_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  granted integer;
begin
  select o.credits_granted into granted from licensing.organizations o where o.id = org for update;
  if granted is null then
    raise exception 'Unknown organization.' using errcode = 'P0002';
  end if;
  if (select count(*) from app.memberships m where m.organization_id = org) >= granted then
    raise exception 'No license credit remains (ADM-011).' using errcode = 'P0001';
  end if;
  if not app.is_fresh_invitee(target) then
    raise exception 'This person cannot be added (ADM-013).' using errcode = 'P0001';
  end if;
  insert into app.memberships (organization_id, user_id, role, email, display_name)
  values (org, target, account_role, lower(btrim(account_email)), btrim(account_name));
end;
$$;

-- ADM-040: creates a project in the caller's organization and returns its slug. Runs with the caller's rights, so
-- the insert policy (Editors and Admins) applies.
create function app.create_project(project_name text, project_description text default '')
returns text
language sql
security invoker
set search_path = ''
as $$
  insert into app.projects (organization_id, name, description)
  values (app.my_organization(), btrim(project_name), btrim(coalesce(project_description, '')))
  returning slug;
$$;

-- ADM-013: an address already used by any Atlas sign-in is refused before an invitation is sent. Admins and the
-- operator only; the answer says nothing about where the address is used.
create function app.email_available(candidate text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not licensing.is_operator() then
    perform app.require_admin();
  end if;
  return not exists (select 1 from auth.users u where lower(u.email) = lower(btrim(candidate)));
end;
$$;

------------------------------------------------------------------------------------------------------------------------
-- Customer side: license counter and accounts (Admins)
------------------------------------------------------------------------------------------------------------------------

-- ADM-001
create function app.license_counter()
returns table (credits_granted integer, credits_used integer, credits_remaining integer, waiting_for_deletion integer)
language sql
stable
security definer
set search_path = ''
as $$
  select o.credits_granted,
         count(m.user_id)::integer,
         (o.credits_granted - count(m.user_id))::integer,
         count(m.deletion_requested_at)::integer
    from licensing.organizations o
    left join app.memberships m on m.organization_id = o.id
   where o.id = app.require_admin()
   group by o.id;
$$;

-- SCR-080: accounts with their last sign-in (read from Supabase Auth).
create function app.list_accounts()
returns table (user_id uuid, email text, display_name text, role app.member_role, status app.member_status,
               joined_at timestamptz, deletion_requested_at timestamptz, last_sign_in_at timestamptz,
               created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id, m.email, m.display_name, m.role, m.status, m.joined_at, m.deletion_requested_at,
         u.last_sign_in_at, m.created_at
    from app.memberships m
    left join auth.users u on u.id = m.user_id
   where m.organization_id = app.require_admin()
   order by m.display_name;
$$;

-- ADM-010…ADM-013: called by the server right after Supabase Auth created the invited user.
create function app.add_account(target uuid, account_email text, account_name text, account_role app.member_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.insert_account(app.require_admin(), target, account_email, account_name, account_role);
end;
$$;

-- Lets the server check before sending an invitation (the final check is in add_account).
create function app.credits_remaining()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (o.credits_granted - (select count(*) from app.memberships m where m.organization_id = o.id))::integer
    from licensing.organizations o
   where o.id = app.require_admin();
$$;

create function app.require_other_account(target uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org uuid := app.require_admin();
begin
  if target = (select auth.uid()) then
    raise exception 'Another Admin must do this (ADM-017).' using errcode = 'P0001';
  end if;
  if not exists (select 1 from app.memberships m where m.user_id = target and m.organization_id = org) then
    raise exception 'Unknown account.' using errcode = 'P0002';
  end if;
  return org;
end;
$$;

-- ADM-015
create function app.set_role(target uuid, new_role app.member_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.require_other_account(target);
  update app.memberships set role = new_role where user_id = target;
end;
$$;

-- ADM-018: suspension also ends the person's sessions.
create function app.suspend_account(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.require_other_account(target);
  update app.memberships set status = 'suspended' where user_id = target;
  delete from auth.sessions where user_id = target;
end;
$$;

-- ADM-019
create function app.reactivate_account(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.require_other_account(target);
  if exists (select 1 from app.memberships where user_id = target and deletion_requested_at is not null) then
    raise exception 'Cancel the deletion request first.' using errcode = 'P0001';
  end if;
  update app.memberships set status = 'active' where user_id = target;
end;
$$;

-- ADM-020: the account is suspended at once and waits for the operator.
create function app.request_deletion(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.require_other_account(target);
  update app.memberships set status = 'suspended', deletion_requested_at = now() where user_id = target;
  delete from auth.sessions where user_id = target;
end;
$$;

-- ADM-020: the account stays suspended; an Admin reactivates it if needed.
create function app.cancel_deletion(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.require_other_account(target);
  update app.memberships set deletion_requested_at = null where user_id = target;
end;
$$;

-- SCR-002 and SCR-090: the person's own account.
create function app.mark_joined()
returns void
language sql
security definer
set search_path = ''
as $$
  update app.memberships set joined_at = coalesce(joined_at, now())
   where user_id = (select auth.uid()) and status = 'active';
$$;

create function app.set_my_display_name(new_name text)
returns void
language sql
security definer
set search_path = ''
as $$
  update app.memberships set display_name = btrim(new_name) where user_id = (select auth.uid());
$$;

------------------------------------------------------------------------------------------------------------------------
-- Operator side (control tower): counts only
------------------------------------------------------------------------------------------------------------------------

-- CT-010, CT-020
create function licensing.organization_figures()
returns table (id uuid, name text, credits_granted integer, accounts integer, credits_remaining integer,
               deletions_waiting integer, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.name, o.credits_granted,
         count(m.user_id)::integer,
         (o.credits_granted - count(m.user_id))::integer,
         count(m.deletion_requested_at)::integer,
         o.created_at
    from licensing.organizations o
    left join app.memberships m on m.organization_id = o.id
   where licensing.require_operator() is not null
   group by o.id
   order by o.name;
$$;

-- CT-011
create function licensing.create_organization(org_name text, credits integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  operator uuid := licensing.require_operator();
  org uuid;
begin
  if credits < 1 then
    raise exception 'An organization starts with at least 1 credit (CT-011).' using errcode = 'P0001';
  end if;
  insert into licensing.organizations (name, credits_granted) values (btrim(org_name), credits) returning id into org;
  insert into licensing.operator_audit (operator_id, action, organization_id, details)
  values (operator, 'organization_created', org, jsonb_build_object('name', btrim(org_name), 'credits_granted', credits));
  return org;
end;
$$;

-- CT-012: the first Admin, right after Supabase Auth created the invited user. The e-mail is not logged.
create function licensing.add_first_admin(org uuid, target uuid, admin_email text, admin_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  operator uuid := licensing.require_operator();
begin
  if exists (select 1 from app.memberships m where m.organization_id = org) then
    raise exception 'This organization already has accounts.' using errcode = 'P0001';
  end if;
  perform app.insert_account(org, target, admin_email, admin_name, 'admin');
  insert into licensing.operator_audit (operator_id, action, organization_id, details)
  values (operator, 'first_admin_invited', org, '{}'::jsonb);
end;
$$;

-- CT-013
create function licensing.set_credits(org uuid, credits integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  operator uuid := licensing.require_operator();
  before integer;
begin
  select credits_granted into before from licensing.organizations where id = org for update;
  if before is null then
    raise exception 'Unknown organization.' using errcode = 'P0002';
  end if;
  update licensing.organizations set credits_granted = credits where id = org;
  insert into licensing.operator_audit (operator_id, action, organization_id, details)
  values (operator, 'credits_changed', org, jsonb_build_object('before', before, 'after', credits));
end;
$$;

-- CT-014
create function licensing.rename_organization(org uuid, new_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  operator uuid := licensing.require_operator();
  before text;
begin
  select name into before from licensing.organizations where id = org for update;
  if before is null then
    raise exception 'Unknown organization.' using errcode = 'P0002';
  end if;
  update licensing.organizations set name = btrim(new_name) where id = org;
  insert into licensing.operator_audit (operator_id, action, organization_id, details)
  values (operator, 'organization_renamed', org, jsonb_build_object('before', before, 'after', btrim(new_name)));
end;
$$;

-- CT-021: removes the accounts waiting for deletion (their sign-in too, ADM-023) and returns only how many.
create function licensing.validate_deletions(org uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  operator uuid := licensing.require_operator();
  removed integer;
begin
  with gone as (
    delete from auth.users u
     using app.memberships m
     where m.user_id = u.id and m.organization_id = org and m.deletion_requested_at is not null
    returning u.id
  )
  select count(*) into removed from gone;
  insert into licensing.operator_audit (operator_id, action, organization_id, details)
  values (operator, 'deletions_validated', org, jsonb_build_object('accounts_removed', removed));
  return removed;
end;
$$;

------------------------------------------------------------------------------------------------------------------------
-- Function privileges: nothing for anonymous visitors; callers are checked inside each function.
------------------------------------------------------------------------------------------------------------------------

revoke execute on all functions in schema app from public, anon;
revoke execute on all functions in schema licensing from public, anon;

grant execute on function
  app.license_counter(), app.list_accounts(), app.add_account(uuid, text, text, app.member_role),
  app.credits_remaining(), app.set_role(uuid, app.member_role), app.suspend_account(uuid),
  app.reactivate_account(uuid), app.request_deletion(uuid), app.cancel_deletion(uuid), app.mark_joined(),
  app.set_my_display_name(text), app.my_organization(), app.create_project(text, text),
  app.email_available(text)
  to authenticated;

grant execute on function
  licensing.organization_figures(), licensing.create_organization(text, integer),
  licensing.add_first_admin(uuid, uuid, text, text), licensing.set_credits(uuid, integer),
  licensing.rename_organization(uuid, text), licensing.validate_deletions(uuid)
  to authenticated;

-- Kept for the policies (granted in the first migration): licensing.is_operator, app.is_member, app.has_role.
grant execute on function licensing.is_operator(), app.is_member(uuid), app.has_role(uuid, app.member_role[])
  to authenticated;

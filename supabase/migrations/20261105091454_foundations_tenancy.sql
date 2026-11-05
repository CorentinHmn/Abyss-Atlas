-- Atlas foundations: schemas, tenancy and row-level security.
-- References: docs/04-architecture.md §3.1 and §5 (ARC-100…ARC-104), ADR 0002 (operator never reads customer content).
--
-- Rules enforced here:
--   * every table of `app` and `licensing` has RLS enabled and at least one policy (checked by supabase/tests);
--   * a member sees only the rows of their own organization, and only while their account is active;
--   * Viewers never write;
--   * the operator reads and manages `licensing` only, and has no policy on any `app` table.

------------------------------------------------------------------------------------------------------------------------
-- Schemas and base privileges
------------------------------------------------------------------------------------------------------------------------

create schema app;
create schema licensing;

comment on schema app is 'Customer content, isolated per organization by RLS. Never readable by the operator (ADR 0002).';
comment on schema licensing is 'Licensing data managed by the operator: organizations, credits, operators (ADR 0002).';

-- Anonymous visitors get nothing; signed-in users reach the schemas, RLS decides which rows.
revoke all on schema app, licensing from public, anon;
grant usage on schema app, licensing to authenticated, service_role;

alter default privileges in schema app grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema licensing grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema app grant all on tables to service_role;
alter default privileges in schema licensing grant all on tables to service_role;
alter default privileges in schema app revoke all on tables from anon;
alter default privileges in schema licensing revoke all on tables from anon;
alter default privileges in schema app revoke execute on functions from public;
alter default privileges in schema licensing revoke execute on functions from public;

------------------------------------------------------------------------------------------------------------------------
-- Licensing (operator side)
------------------------------------------------------------------------------------------------------------------------

create table licensing.operators (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
comment on table licensing.operators is 'Accounts of the Atlas operator (control tower). Managed by migration or database admin only.';

create table licensing.organizations (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (length(btrim(name)) > 0),
  credits_granted integer not null default 0 check (credits_granted >= 0),
  created_at      timestamptz not null default now()
);
comment on table licensing.organizations is 'Customer organizations, created by the operator (UC-050). 1 credit = 1 account (UC-041).';

------------------------------------------------------------------------------------------------------------------------
-- Customer content (app)
------------------------------------------------------------------------------------------------------------------------

create type app.member_role as enum ('admin', 'editor', 'viewer');
create type app.member_status as enum ('active', 'suspended');

create table app.memberships (
  organization_id uuid not null references licensing.organizations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  role            app.member_role not null,
  status          app.member_status not null default 'active',
  created_at      timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index memberships_user_id_idx on app.memberships (user_id);
comment on table app.memberships is 'Accounts of an organization, with their role (Admin, Editor, Viewer) and status (UC-041, UC-046).';

create table app.projects (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references licensing.organizations (id) on delete cascade,
  name            text not null check (length(btrim(name)) > 0),
  created_at      timestamptz not null default now()
);
create index projects_organization_id_idx on app.projects (organization_id);
comment on table app.projects is 'Projects of an organization (UC-044).';

------------------------------------------------------------------------------------------------------------------------
-- Helper functions used by policies
-- SECURITY DEFINER so that policies can read memberships/operators without recursing into their own RLS.
-- They only answer questions about the current user and never return data.
------------------------------------------------------------------------------------------------------------------------

create function licensing.is_operator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from licensing.operators o where o.user_id = (select auth.uid())
  );
$$;

create function app.is_member(org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from app.memberships m
    where m.organization_id = org
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  );
$$;

create function app.has_role(org uuid, allowed app.member_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from app.memberships m
    where m.organization_id = org
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role = any (allowed)
  );
$$;

revoke execute on function licensing.is_operator() from public;
revoke execute on function app.is_member(uuid) from public;
revoke execute on function app.has_role(uuid, app.member_role[]) from public;
grant execute on function licensing.is_operator() to authenticated;
grant execute on function app.is_member(uuid) to authenticated;
grant execute on function app.has_role(uuid, app.member_role[]) to authenticated;

------------------------------------------------------------------------------------------------------------------------
-- Table privileges (tables created above existed before the default privileges applied to them)
------------------------------------------------------------------------------------------------------------------------

grant select, insert, update, delete on all tables in schema app to authenticated;
grant select, insert, update, delete on all tables in schema licensing to authenticated;
grant all on all tables in schema app to service_role;
grant all on all tables in schema licensing to service_role;

------------------------------------------------------------------------------------------------------------------------
-- Row-level security
------------------------------------------------------------------------------------------------------------------------

alter table licensing.operators enable row level security;
alter table licensing.organizations enable row level security;
alter table app.memberships enable row level security;
alter table app.projects enable row level security;

-- licensing.operators: operators can see the list; nobody writes through the API.
create policy "Operators read the operator list"
  on licensing.operators for select to authenticated
  using ((select licensing.is_operator()));

-- licensing.organizations: the operator manages organizations and credits; active members read their own one
-- (name and credit counter, UC-040). Members never change credits.
create policy "Operators manage organizations"
  on licensing.organizations for all to authenticated
  using ((select licensing.is_operator()))
  with check ((select licensing.is_operator()));

create policy "Members read their organization"
  on licensing.organizations for select to authenticated
  using ((select app.is_member(id)));

-- app.memberships: members see the accounts of their organization; Admins manage them.
-- Credit checks on account creation come with the accounts module (P2, UC-041).
create policy "Members read memberships of their organization"
  on app.memberships for select to authenticated
  using ((select app.is_member(organization_id)));

create policy "Admins add memberships"
  on app.memberships for insert to authenticated
  with check ((select app.has_role(organization_id, array['admin']::app.member_role[])));

create policy "Admins update memberships"
  on app.memberships for update to authenticated
  using ((select app.has_role(organization_id, array['admin']::app.member_role[])))
  with check ((select app.has_role(organization_id, array['admin']::app.member_role[])));

create policy "Admins delete memberships"
  on app.memberships for delete to authenticated
  using ((select app.has_role(organization_id, array['admin']::app.member_role[])));

-- app.projects: members read; Editors and Admins write.
create policy "Members read projects of their organization"
  on app.projects for select to authenticated
  using ((select app.is_member(organization_id)));

create policy "Editors create projects"
  on app.projects for insert to authenticated
  with check ((select app.has_role(organization_id, array['admin', 'editor']::app.member_role[])));

create policy "Editors update projects"
  on app.projects for update to authenticated
  using ((select app.has_role(organization_id, array['admin', 'editor']::app.member_role[])))
  with check ((select app.has_role(organization_id, array['admin', 'editor']::app.member_role[])));

create policy "Editors delete projects"
  on app.projects for delete to authenticated
  using ((select app.has_role(organization_id, array['admin', 'editor']::app.member_role[])));

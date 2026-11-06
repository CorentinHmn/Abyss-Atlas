-- The organization's catalogue of domains (business processes) shared by all its projects
-- (docs/05-modules/administration.md §4, ADM-050…ADM-054; docs/02-metamodel.md §3.2, MM-020…MM-026).
-- Members read; only Admins write, through the functions below. A domain used by a spec object cannot be deleted,
-- only retired; its code never changes. Owner and stewards are e-mails of active accounts of the organization.

create table app.domains (
  organization_id uuid not null references licensing.organizations (id) on delete cascade,
  code            text not null check (code ~ '^[A-Z0-9]{2,5}$'),
  name            text not null check (length(btrim(name)) between 1 and 120),
  description     text not null default '',
  owner_email     text not null,
  steward_emails  text[] not null check (cardinality(steward_emails) >= 1),
  retired_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (organization_id, code)
);
comment on table app.domains is 'Business processes of an organization (MM-020). Written only through app.save_domain, app.set_domain_retired and app.delete_domain.';

alter table app.domains enable row level security;
create policy "Members read the domains of their organization"
  on app.domains for select to authenticated
  using ((select app.is_member(organization_id)));
revoke insert, update, delete, truncate on app.domains from authenticated;

-- Whether a spec object of the organization uses the domain (a model, a rule or a value mapping).
create function app.domain_in_use(org uuid, domain_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from app.spec_objects o
     where o.organization_id = org and o.kind in ('model', 'rule', 'value_mapping') and o.content ->> 'domain' = domain_code
  );
$$;

-- ADM-050, ADM-053: creates or changes a domain. Owner and stewards must be active accounts of the organization.
create function app.save_domain(domain_code text, domain_name text, domain_description text, owner text, stewards text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  org uuid := app.require_admin();
  people text[] := array(select lower(btrim(s)) from unnest(stewards) s where btrim(s) <> '' group by lower(btrim(s)));
  person text;
begin
  if domain_code !~ '^[A-Z0-9]{2,5}$' then
    raise exception 'A domain code has 2 to 5 capital letters or digits (MM-020).' using errcode = 'P0001';
  end if;
  if cardinality(people) < 1 then
    raise exception 'A domain needs at least one steward (MM-021).' using errcode = 'P0001';
  end if;
  foreach person in array people || lower(btrim(owner)) loop
    if not exists (select 1 from app.memberships m where m.organization_id = org and m.email = person and m.status = 'active') then
      raise exception 'Owner and stewards must be active accounts of the organization (MM-022).' using errcode = 'P0001';
    end if;
  end loop;
  insert into app.domains (organization_id, code, name, description, owner_email, steward_emails)
  values (org, domain_code, btrim(domain_name), btrim(coalesce(domain_description, '')), lower(btrim(owner)), people)
  on conflict (organization_id, code) do update
    set name = excluded.name, description = excluded.description, owner_email = excluded.owner_email,
        steward_emails = excluded.steward_emails, updated_at = now();
end;
$$;

-- ADM-052: a retired domain stays readable; no new object can be assigned to it.
create function app.set_domain_retired(domain_code text, retired boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  org uuid := app.require_admin();
begin
  update app.domains set retired_at = case when retired then coalesce(retired_at, now()) end, updated_at = now()
   where organization_id = org and code = domain_code;
end;
$$;

-- ADM-052, MM-025: only a domain that no spec object uses can be deleted.
create function app.delete_domain(domain_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  org uuid := app.require_admin();
begin
  if app.domain_in_use(org, domain_code) then
    raise exception 'This domain is used: retire it instead (MM-025).' using errcode = 'P0001';
  end if;
  delete from app.domains where organization_id = org and code = domain_code;
end;
$$;

revoke execute on function app.domain_in_use(uuid, text) from public, anon, authenticated;
revoke execute on function app.save_domain(text, text, text, text, text[]), app.set_domain_retired(text, boolean), app.delete_domain(text) from public, anon;
grant execute on function app.save_domain(text, text, text, text, text[]), app.set_domain_retired(text, boolean), app.delete_domain(text) to authenticated;

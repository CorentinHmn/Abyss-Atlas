-- Spec objects and their history (docs/04-architecture.md §3.2, ARC-020, ARC-023; docs/05-modules/versioning.md).
--
-- One row per spec file of a project (system, dataset, later model, rule, value mapping): its content as JSON,
-- exactly as the export file reads (`json`, not `jsonb`, so that the order of keys is kept), and its content hash
-- (FMT-122, computed by packages/core). Every change is recorded in app.spec_versions:
--   * an edit by the same person within 2 minutes of the previous one extends that version (VER-002);
--   * an import, a copy, a restore or a deletion always starts a new version;
--   * a save that does not change the content records nothing.
-- Members of the organization read; Editors and Admins write, only through the two functions below; the operator
-- has no access (ADR 0002). Content is checked by the server with packages/core before it is saved.

create type app.spec_kind as enum ('system', 'dataset', 'model', 'rule', 'value_mapping');
create type app.spec_change as enum ('edit', 'import', 'copy', 'restore', 'delete');

create table app.spec_objects (
  project_id      uuid not null references app.projects (id) on delete cascade,
  organization_id uuid not null references licensing.organizations (id) on delete cascade,
  kind            app.spec_kind not null,
  key             text not null check (length(key) between 1 and 200),
  path            text not null check (length(path) between 1 and 400),
  content         json not null check (octet_length(content::text) <= 5000000),
  hash            text not null check (hash ~ '^sha256:[0-9a-f]{64}$'),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  updated_by      uuid,
  updated_by_name text,
  primary key (project_id, kind, key)
);
create index spec_objects_organization_idx on app.spec_objects (organization_id);
comment on table app.spec_objects is 'Current state of each spec file of a project (ARC-020). Written only through app.save_spec_objects and app.delete_spec_objects.';
comment on column app.spec_objects.updated_by is 'No foreign key: authors stay readable after their account is removed (ADM-022).';

create table app.spec_versions (
  id              bigint generated always as identity primary key,
  project_id      uuid not null references app.projects (id) on delete cascade,
  organization_id uuid not null references licensing.organizations (id) on delete cascade,
  kind            app.spec_kind not null,
  key             text not null,
  content         json,
  hash            text,
  change          app.spec_change not null,
  authors         jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check ((change = 'delete') = (content is null))
);
create index spec_versions_object_idx on app.spec_versions (project_id, kind, key, id desc);
create index spec_versions_project_idx on app.spec_versions (project_id, updated_at desc);
create index spec_versions_organization_idx on app.spec_versions (organization_id);
comment on table app.spec_versions is 'History of every spec object (VER-001…VER-005). A null content records a deletion.';

alter table app.spec_objects enable row level security;
alter table app.spec_versions enable row level security;

create policy "Members read the spec objects of their organization"
  on app.spec_objects for select to authenticated
  using ((select app.is_member(organization_id)));

create policy "Members read the history of their organization"
  on app.spec_versions for select to authenticated
  using ((select app.is_member(organization_id)));

revoke insert, update, delete, truncate on app.spec_objects, app.spec_versions from authenticated;

------------------------------------------------------------------------------------------------------------------------
-- Writing
------------------------------------------------------------------------------------------------------------------------

-- The organization of a project the caller may edit: an active Editor or Admin, and a project not archived.
create function app.require_editable_project(project uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org uuid;
  archived timestamptz;
begin
  select p.organization_id, p.archived_at into org, archived from app.projects p where p.id = project;
  if org is null or not app.has_role(org, array['admin', 'editor']::app.member_role[]) then
    raise exception 'Only an Editor or an Admin of this project can change it.' using errcode = '42501';
  end if;
  if archived is not null then
    raise exception 'This project is archived: restore it before changing it (ADM-042).' using errcode = 'P0001';
  end if;
  return org;
end;
$$;

-- Records a change of one object in its history (VER-002).
create function app.record_version(org uuid, project uuid, object_kind app.spec_kind, object_key text,
                                   new_content json, new_hash text, what app.spec_change)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  author jsonb;
  last app.spec_versions;
begin
  select jsonb_build_object('id', m.user_id, 'name', m.display_name, 'email', m.email) into author
    from app.memberships m where m.user_id = (select auth.uid());
  author := coalesce(author, jsonb_build_object('id', (select auth.uid())));

  select * into last from app.spec_versions v
   where v.project_id = project and v.kind = object_kind and v.key = object_key
   order by v.id desc limit 1;

  if what = 'edit' and last.change = 'edit' and last.updated_at > now() - interval '2 minutes'
     and last.authors @> jsonb_build_array(author) then
    update app.spec_versions set content = new_content, hash = new_hash, updated_at = now() where id = last.id;
  elsif what = 'edit' and last.change = 'edit' and last.updated_at > now() - interval '2 minutes' then
    -- VER-003: several people in the same burst are all recorded.
    update app.spec_versions
       set content = new_content, hash = new_hash, updated_at = now(), authors = authors || jsonb_build_array(author)
     where id = last.id;
  else
    insert into app.spec_versions (project_id, organization_id, kind, key, content, hash, change, authors)
    values (project, org, object_kind, object_key, new_content, new_hash, what, jsonb_build_array(author));
  end if;
end;
$$;

-- Saves objects (`[{kind, key, path, content, hash}]`) and returns how many really changed.
create function app.save_spec_objects(project uuid, objects json, what app.spec_change default 'edit')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  org uuid := app.require_editable_project(project);
  item json;
  object_kind app.spec_kind;
  object_key text;
  new_hash text;
  previous text;
  author_name text;
  changed integer := 0;
begin
  if what = 'delete' then
    raise exception 'Use app.delete_spec_objects to delete.' using errcode = 'P0001';
  end if;
  select m.display_name into author_name from app.memberships m where m.user_id = (select auth.uid());
  for item in select value from json_array_elements(objects) loop
    object_kind := (item ->> 'kind')::app.spec_kind;
    object_key := item ->> 'key';
    new_hash := item ->> 'hash';
    select o.hash into previous from app.spec_objects o
     where o.project_id = project and o.kind = object_kind and o.key = object_key;
    continue when previous is not distinct from new_hash;

    insert into app.spec_objects (project_id, organization_id, kind, key, path, content, hash, updated_by, updated_by_name)
    values (project, org, object_kind, object_key, item ->> 'path', item -> 'content', new_hash, (select auth.uid()), author_name)
    on conflict (project_id, kind, key) do update
      set path = excluded.path, content = excluded.content, hash = excluded.hash, updated_at = now(),
          updated_by = excluded.updated_by, updated_by_name = excluded.updated_by_name;
    perform app.record_version(org, project, object_kind, object_key, item -> 'content', new_hash, what);
    changed := changed + 1;
  end loop;
  return changed;
end;
$$;

-- Deletes objects (`[{kind, key}]`); they stay in the history and can be restored (VER-004). Returns how many.
create function app.delete_spec_objects(project uuid, objects json)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  org uuid := app.require_editable_project(project);
  item json;
  removed integer := 0;
  found_one boolean;
begin
  for item in select value from json_array_elements(objects) loop
    delete from app.spec_objects o
     where o.project_id = project and o.kind = (item ->> 'kind')::app.spec_kind and o.key = item ->> 'key'
    returning true into found_one;
    if found_one then
      perform app.record_version(org, project, (item ->> 'kind')::app.spec_kind, item ->> 'key', null, null, 'delete');
      removed := removed + 1;
      found_one := false;
    end if;
  end loop;
  return removed;
end;
$$;

revoke execute on function app.require_editable_project(uuid), app.record_version(uuid, uuid, app.spec_kind, text, json, text, app.spec_change)
  from public, anon, authenticated;
revoke execute on function app.save_spec_objects(uuid, json, app.spec_change), app.delete_spec_objects(uuid, json) from public, anon;
grant execute on function app.save_spec_objects(uuid, json, app.spec_change), app.delete_spec_objects(uuid, json) to authenticated;

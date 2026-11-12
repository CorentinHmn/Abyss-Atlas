-- Named versions and the project timeline (docs/05-modules/versioning.md VER-010, VER-022, VER-030…VER-041).
--
-- A named version marks the latest version of every object of the project at its creation (`last_version_id`); the
-- state of the project at that moment is, for each object, its latest version up to that mark. So that the mark never
-- moves, a version recorded before a named version is never extended afterwards (VER-002: naming a version closes the
-- current bursts). Members read; Editors and Admins create; Admins delete (VER-031); the operator sees nothing.

create table app.named_versions (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references app.projects (id) on delete cascade,
  organization_id uuid not null references licensing.organizations (id) on delete cascade,
  name            text not null check (length(btrim(name)) between 1 and 80),
  description     text not null default '' check (length(description) <= 2000),
  last_version_id bigint not null,
  created_at      timestamptz not null default now(),
  created_by      jsonb not null
);
create unique index named_versions_name_idx on app.named_versions (project_id, lower(btrim(name)));
create index named_versions_organization_idx on app.named_versions (organization_id);
comment on table app.named_versions is 'Named versions of a project (VER-030). Written only through app.create_named_version and app.delete_named_version.';

alter table app.named_versions enable row level security;
create policy "Members read the named versions of their organization"
  on app.named_versions for select to authenticated
  using ((select app.is_member(organization_id)));
revoke insert, update, delete, truncate on app.named_versions from authenticated;

-- VER-030, VER-031
create function app.create_named_version(project uuid, version_name text, version_description text default '')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  org uuid := app.require_editable_project(project);
  author jsonb;
  mark bigint;
  created uuid;
begin
  if exists (select 1 from app.named_versions n where n.project_id = project and lower(btrim(n.name)) = lower(btrim(version_name))) then
    raise exception 'A named version with this name already exists in the project (VER-031).' using errcode = '23505';
  end if;
  select jsonb_build_object('id', m.user_id, 'name', m.display_name, 'email', m.email) into author
    from app.memberships m where m.user_id = (select auth.uid());
  select coalesce(max(v.id), 0) into mark from app.spec_versions v where v.project_id = project;
  insert into app.named_versions (project_id, organization_id, name, description, last_version_id, created_by)
  values (project, org, btrim(version_name), coalesce(version_description, ''), mark, author)
  returning id into created;
  return created;
end;
$$;

-- VER-031: Admins only; the object versions stay.
create function app.delete_named_version(named uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  org uuid;
begin
  select n.organization_id into org from app.named_versions n where n.id = named;
  if org is null or not app.has_role(org, array['admin']::app.member_role[]) then
    raise exception 'Only an Admin can delete a named version (VER-031).' using errcode = '42501';
  end if;
  delete from app.named_versions where id = named;
end;
$$;

-- VER-002: a burst is not extended past a named version.
create or replace function app.record_version(org uuid, project uuid, object_kind app.spec_kind, object_key text,
                                              new_content json, new_hash text, what app.spec_change)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  author jsonb;
  last app.spec_versions;
  mark bigint;
  open_burst boolean;
begin
  select jsonb_build_object('id', m.user_id, 'name', m.display_name, 'email', m.email) into author
    from app.memberships m where m.user_id = (select auth.uid());
  author := coalesce(author, jsonb_build_object('id', (select auth.uid())));

  select * into last from app.spec_versions v
   where v.project_id = project and v.kind = object_kind and v.key = object_key
   order by v.id desc limit 1;
  select coalesce(max(n.last_version_id), 0) into mark from app.named_versions n where n.project_id = project;
  open_burst := what = 'edit' and last.change = 'edit' and last.updated_at > now() - interval '2 minutes' and last.id > mark;

  if open_burst and last.authors @> jsonb_build_array(author) then
    update app.spec_versions set content = new_content, hash = new_hash, updated_at = now() where id = last.id;
  elsif open_burst then
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

-- VER-010, VER-011: the timeline, newest first, each version with the content of the one before it (for its summary).
-- Runs with the caller's rights: the policies on app.spec_versions apply.
create function app.project_history(project uuid, before_id bigint default null, object_kind app.spec_kind default null,
                                    object_key text default null, author_email text default null, max_rows integer default 50)
returns table (id bigint, kind app.spec_kind, key text, change app.spec_change, authors jsonb, created_at timestamptz,
               updated_at timestamptz, content json, previous json)
language sql
stable
security invoker
set search_path = ''
as $$
  select v.id, v.kind, v.key, v.change, v.authors, v.created_at, v.updated_at, v.content,
         (select p.content from app.spec_versions p
           where p.project_id = v.project_id and p.kind = v.kind and p.key = v.key and p.id < v.id
           order by p.id desc limit 1)
    from app.spec_versions v
   where v.project_id = project
     and (before_id is null or v.id < before_id)
     and (object_kind is null or v.kind = object_kind)
     and (object_key is null or v.key = object_key)
     and (author_email is null or v.authors @> jsonb_build_array(jsonb_build_object('email', author_email)))
   order by v.id desc
   limit least(greatest(max_rows, 1), 200);
$$;

-- VER-022, VER-041: the objects of the project as they were at a version mark (deleted objects left out).
create function app.project_at(project uuid, mark bigint)
returns table (kind app.spec_kind, key text, content json, hash text)
language sql
stable
security invoker
set search_path = ''
as $$
  select s.kind, s.key, s.content, s.hash
    from (select distinct on (v.kind, v.key) v.kind, v.key, v.content, v.hash
            from app.spec_versions v
           where v.project_id = project and v.id <= mark
           order by v.kind, v.key, v.id desc) s
   where s.content is not null;
$$;

revoke execute on function app.create_named_version(uuid, text, text), app.delete_named_version(uuid),
  app.project_history(uuid, bigint, app.spec_kind, text, text, integer), app.project_at(uuid, bigint) from public, anon;
grant execute on function app.create_named_version(uuid, text, text), app.delete_named_version(uuid),
  app.project_history(uuid, bigint, app.spec_kind, text, text, integer), app.project_at(uuid, bigint) to authenticated;
revoke execute on function app.record_version(uuid, uuid, app.spec_kind, text, json, text, app.spec_change) from public, anon, authenticated;

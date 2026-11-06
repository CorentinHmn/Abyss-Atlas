-- Spec objects and history (ARC-020, ARC-023, VER-001…VER-005): members read their organization's objects only,
-- Editors and Admins write through the functions only, the operator sees nothing, and every change is a version.
--
-- Cast: organization A (alice admin, eve editor, bob viewer), organization B (carol admin), olga operator.
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@a.test'),
  ('22222222-2222-2222-2222-222222222222', 'bob@a.test'),
  ('33333333-3333-3333-3333-333333333333', 'carol@b.test'),
  ('55555555-5555-5555-5555-555555555555', 'eve@a.test'),
  ('99999999-9999-9999-9999-999999999999', 'olga@operator.test');
insert into licensing.organizations (id, name, credits_granted) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'Organization A', 10),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'Organization B', 10);
insert into licensing.operators (user_id) values ('99999999-9999-9999-9999-999999999999');
insert into app.memberships (organization_id, user_id, role, email, display_name) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'admin', 'alice@a.test', 'Alice'),
  ('aaaaaaaa-0000-0000-0000-00000000000a', '22222222-2222-2222-2222-222222222222', 'viewer', 'bob@a.test', 'Bob'),
  ('aaaaaaaa-0000-0000-0000-00000000000a', '55555555-5555-5555-5555-555555555555', 'editor', 'eve@a.test', 'Eve'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', '33333333-3333-3333-3333-333333333333', 'admin', 'carol@b.test', 'Carol');
insert into app.projects (id, organization_id, name, slug) values
  ('aaaaaaaa-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-00000000000a', 'Project of A', 'project-a'),
  ('aaaaaaaa-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-00000000000a', 'Archived of A', 'archived-a'),
  ('bbbbbbbb-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-00000000000b', 'Project of B', 'project-b');
update app.projects set archived_at = now() where id = 'aaaaaaaa-0000-0000-0000-0000000000a2';

-- A system object as the server sends it; hashes are fixed values here (packages/core computes them).
create temporary table sample (name text primary key, objects json);
grant select on sample to authenticated;
insert into sample values
  ('v1', '[{"kind":"system","key":"sap_fr","path":"systems/sap_fr/system.yaml","content":{"atlas":1,"kind":"system","id":"sap_fr","name":"SAP France","system_type":"erp"},"hash":"sha256:1111111111111111111111111111111111111111111111111111111111111111"}]'),
  ('v2', '[{"kind":"system","key":"sap_fr","path":"systems/sap_fr/system.yaml","content":{"atlas":1,"kind":"system","id":"sap_fr","name":"SAP France (S/4)","system_type":"erp"},"hash":"sha256:2222222222222222222222222222222222222222222222222222222222222222"}]'),
  ('v3', '[{"kind":"system","key":"sap_fr","path":"systems/sap_fr/system.yaml","content":{"atlas":1,"kind":"system","id":"sap_fr","name":"SAP FR","system_type":"erp"},"hash":"sha256:3333333333333333333333333333333333333333333333333333333333333333"}]');

------------------------------------------------------------------------------------------------------------------------
-- eve, Editor of A
------------------------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "55555555-5555-5555-5555-555555555555", "role": "authenticated"}';

select is(app.save_spec_objects('aaaaaaaa-0000-0000-0000-0000000000a1', (select objects from sample where name = 'v1')), 1,
  'An Editor saves a spec object');
select is(app.save_spec_objects('aaaaaaaa-0000-0000-0000-0000000000a1', (select objects from sample where name = 'v1')), 0,
  'Saving the same content changes nothing');
select is((select count(*)::int from app.spec_versions), 1, 'VER-001: the first save is one version');
select is((select content::text from app.spec_objects where key = 'sap_fr'),
  '{"atlas":1,"kind":"system","id":"sap_fr","name":"SAP France","system_type":"erp"}',
  'The content is kept exactly, keys in the order of the file');
select is((select updated_by_name from app.spec_objects where key = 'sap_fr'), 'Eve', 'The last author is recorded');

select is(app.save_spec_objects('aaaaaaaa-0000-0000-0000-0000000000a1', (select objects from sample where name = 'v2')), 1,
  'An Editor changes the object');
select is((select count(*)::int from app.spec_versions), 1, 'VER-002: a change within 2 minutes extends the same version');
select is((select content ->> 'name' from app.spec_versions), 'SAP France (S/4)', 'The version holds the latest content');

select is(app.save_spec_objects('aaaaaaaa-0000-0000-0000-0000000000a1', (select objects from sample where name = 'v3'), 'import'), 1,
  'An import is saved');
select is((select count(*)::int from app.spec_versions), 2, 'VER-002: an import always starts a new version');

select throws_ok(
  $$ select app.save_spec_objects('aaaaaaaa-0000-0000-0000-0000000000a2', (select objects from sample where name = 'v1')) $$,
  'P0001', null, 'ADM-042: an archived project cannot be changed');
select throws_ok(
  $$ select app.save_spec_objects('bbbbbbbb-0000-0000-0000-0000000000b1', (select objects from sample where name = 'v1')) $$,
  '42501', null, 'An Editor of A cannot write in a project of B');
select throws_ok(
  $$ insert into app.spec_objects (project_id, organization_id, kind, key, path, content, hash)
     values ('aaaaaaaa-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-00000000000a', 'system', 'x', 'x', '{}', 'sha256:1111111111111111111111111111111111111111111111111111111111111111') $$,
  '42501', null, 'Nobody writes the table directly');
select throws_ok($$ delete from app.spec_versions $$, '42501', null, 'Nobody rewrites the history');
reset role;

------------------------------------------------------------------------------------------------------------------------
-- bob, Viewer of A
------------------------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select count(*)::int from app.spec_objects), 1, 'A Viewer reads the spec objects of the organization');
select is((select count(*)::int from app.spec_versions), 2, 'A Viewer reads the history');
select throws_ok(
  $$ select app.save_spec_objects('aaaaaaaa-0000-0000-0000-0000000000a1', (select objects from sample where name = 'v1')) $$,
  '42501', null, 'A Viewer cannot change the spec');
select throws_ok(
  $$ select app.delete_spec_objects('aaaaaaaa-0000-0000-0000-0000000000a1', '[{"kind":"system","key":"sap_fr"}]') $$,
  '42501', null, 'A Viewer cannot delete');
reset role;

------------------------------------------------------------------------------------------------------------------------
-- carol, Admin of B, and olga, operator
------------------------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is_empty($$ select 1 from app.spec_objects $$, 'Another organization sees no spec object of A');
select is_empty($$ select 1 from app.spec_versions $$, 'Another organization sees no history of A');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "99999999-9999-9999-9999-999999999999", "role": "authenticated"}';
select is_empty($$ select 1 from app.spec_objects $$, 'RM-033: the operator reads no spec object');
select is_empty($$ select 1 from app.spec_versions $$, 'RM-033: the operator reads no history');
reset role;

------------------------------------------------------------------------------------------------------------------------
-- alice, Admin of A: deletion
------------------------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select is(app.delete_spec_objects('aaaaaaaa-0000-0000-0000-0000000000a1', '[{"kind":"system","key":"sap_fr"},{"kind":"system","key":"missing"}]'), 1,
  'An Admin deletes an object; an unknown one is ignored');
select is_empty($$ select 1 from app.spec_objects $$, 'The object is gone');
select results_eq($$ select change::text, content is null from app.spec_versions order by id desc limit 1 $$,
  $$ values ('delete', true) $$, 'VER-004: the deletion is a version, so the object can be restored');
select is((select (authors -> 0 ->> 'name') from app.spec_versions order by id desc limit 1), 'Alice',
  'VER-005: the author of each version is recorded');
reset role;

select * from finish();
rollback;

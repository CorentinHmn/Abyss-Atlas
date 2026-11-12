-- Named versions and the timeline (VER-002, VER-010, VER-030, VER-031, VER-041): members read their organization's
-- named versions only, Editors and Admins create them, Admins delete them, a named version closes the current bursts,
-- and the project can be read as it was at a named version. The operator sees nothing (RM-033).
--
-- Cast: organization A (alice admin, eve editor, bob viewer), organization B (carol admin), olga operator.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

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
  ('bbbbbbbb-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-00000000000b', 'Project of B', 'project-b');

create temporary table sample (name text primary key, objects json);
grant select on sample to authenticated;
insert into sample values
  ('v1', '[{"kind":"system","key":"sap_fr","path":"systems/sap_fr/system.yaml","content":{"atlas":1,"kind":"system","id":"sap_fr","name":"SAP France","system_type":"erp"},"hash":"sha256:1111111111111111111111111111111111111111111111111111111111111111"}]'),
  ('v2', '[{"kind":"system","key":"sap_fr","path":"systems/sap_fr/system.yaml","content":{"atlas":1,"kind":"system","id":"sap_fr","name":"SAP France (S/4)","system_type":"erp"},"hash":"sha256:2222222222222222222222222222222222222222222222222222222222222222"}]'),
  ('mes', '[{"kind":"system","key":"mes","path":"systems/mes/system.yaml","content":{"atlas":1,"kind":"system","id":"mes","name":"MES","system_type":"other"},"hash":"sha256:4444444444444444444444444444444444444444444444444444444444444444"}]');

------------------------------------------------------------------------------------------------------------------------
-- eve, Editor of A
------------------------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "55555555-5555-5555-5555-555555555555", "role": "authenticated"}';

select app.save_spec_objects('aaaaaaaa-0000-0000-0000-0000000000a1', (select objects from sample where name = 'v1'));
select isnt(app.create_named_version('aaaaaaaa-0000-0000-0000-0000000000a1', 'Release 1.0', 'First delivery'), null,
  'VER-030: an Editor creates a named version');
select is((select last_version_id from app.named_versions), (select max(id) from app.spec_versions),
  'The named version marks the latest version of the project');
select is((select created_by ->> 'name' from app.named_versions), 'Eve', 'Its author is recorded');
select throws_ok($$ select app.create_named_version('aaaaaaaa-0000-0000-0000-0000000000a1', ' release 1.0 ') $$, '23505', null,
  'VER-031: names are unique in the project, whatever their case');

select app.save_spec_objects('aaaaaaaa-0000-0000-0000-0000000000a1', (select objects from sample where name = 'v2'));
select is((select count(*)::int from app.spec_versions), 2,
  'VER-002: a change right after a named version starts a new version instead of extending the marked one');
select app.save_spec_objects('aaaaaaaa-0000-0000-0000-0000000000a1', (select objects from sample where name = 'mes'));

select is((select count(*)::int from app.project_at('aaaaaaaa-0000-0000-0000-0000000000a1', (select last_version_id from app.named_versions))), 1,
  'VER-041: the project at the named version holds the objects of that moment only');
select is((select content ->> 'name' from app.project_at('aaaaaaaa-0000-0000-0000-0000000000a1', (select last_version_id from app.named_versions))),
  'SAP France', 'Each object as it was at that moment');
select app.delete_spec_objects('aaaaaaaa-0000-0000-0000-0000000000a1', '[{"kind":"system","key":"mes"}]');
select is((select count(*)::int from app.project_at('aaaaaaaa-0000-0000-0000-0000000000a1', 1000000)), 1,
  'A deleted object is left out of the state of the project');

select is((select count(*)::int from app.project_history('aaaaaaaa-0000-0000-0000-0000000000a1')), 4,
  'VER-010: the timeline lists every version');
select is((select key from app.project_history('aaaaaaaa-0000-0000-0000-0000000000a1') limit 1), 'mes', 'Newest first');
select is((select previous ->> 'name' from app.project_history('aaaaaaaa-0000-0000-0000-0000000000a1', object_key => 'sap_fr') limit 1),
  'SAP France', 'Each version comes with the content before it');
select is((select count(*)::int from app.project_history('aaaaaaaa-0000-0000-0000-0000000000a1', author_email => 'alice@a.test')), 0,
  'VER-011: the timeline is filtered by author');

select throws_ok($$ select app.delete_named_version((select id from app.named_versions)) $$, '42501', null,
  'VER-031: an Editor cannot delete a named version');
select throws_ok($$ insert into app.named_versions (project_id, organization_id, name, last_version_id, created_by)
  values ('aaaaaaaa-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-00000000000a', 'Forged', 0, '{}') $$, '42501', null,
  'Nobody writes named versions directly');

------------------------------------------------------------------------------------------------------------------------
-- bob, Viewer of A
------------------------------------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select count(*)::int from app.named_versions), 1, 'A Viewer reads the named versions');
select throws_ok($$ select app.create_named_version('aaaaaaaa-0000-0000-0000-0000000000a1', 'Release 2') $$, '42501', null,
  'A Viewer cannot create a named version');

------------------------------------------------------------------------------------------------------------------------
-- carol, Admin of B, and olga, operator
------------------------------------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is_empty($$ select 1 from app.named_versions $$, 'Another organization reads none of them');
select is_empty($$ select 1 from app.project_history('aaaaaaaa-0000-0000-0000-0000000000a1') $$,
  'Another organization reads none of the timeline');
set local request.jwt.claims = '{"sub": "99999999-9999-9999-9999-999999999999", "role": "authenticated"}';
select is_empty($$ select 1 from app.project_at('aaaaaaaa-0000-0000-0000-0000000000a1', 1000000) $$,
  'RM-033: the operator reads no state of a project');

------------------------------------------------------------------------------------------------------------------------
-- alice, Admin of A
------------------------------------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select lives_ok($$ select app.delete_named_version((select id from app.named_versions)) $$, 'VER-031: an Admin deletes a named version');

select * from finish();
rollback;

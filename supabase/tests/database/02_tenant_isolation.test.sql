-- ARC-100…ARC-104, ADR 0002: organizations are isolated from each other, roles are enforced,
-- suspended accounts lose access, and the operator never reads customer content.
--
-- Cast (all fixtures are rolled back at the end):
--   Organization A: alice (admin), bob (viewer), eve (editor), dave (editor, suspended)
--   Organization B: carol (admin)
--   olga: operator, member of no organization
begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

------------------------------------------------------------------------------------------------------------------------
-- Fixtures, written as the database owner (RLS does not apply)
------------------------------------------------------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@a.test'),
  ('22222222-2222-2222-2222-222222222222', 'bob@a.test'),
  ('33333333-3333-3333-3333-333333333333', 'carol@b.test'),
  ('44444444-4444-4444-4444-444444444444', 'dave@a.test'),
  ('55555555-5555-5555-5555-555555555555', 'eve@a.test'),
  ('99999999-9999-9999-9999-999999999999', 'olga@operator.test');

insert into licensing.organizations (id, name, credits_granted) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'Organization A', 10),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'Organization B', 5);

insert into licensing.operators (user_id) values ('99999999-9999-9999-9999-999999999999');

insert into app.memberships (organization_id, user_id, role, status, email, display_name) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'admin', 'active', 'alice@a.test', 'Alice'),
  ('aaaaaaaa-0000-0000-0000-00000000000a', '22222222-2222-2222-2222-222222222222', 'viewer', 'active', 'bob@a.test', 'Bob'),
  ('aaaaaaaa-0000-0000-0000-00000000000a', '55555555-5555-5555-5555-555555555555', 'editor', 'active', 'eve@a.test', 'Eve'),
  ('aaaaaaaa-0000-0000-0000-00000000000a', '44444444-4444-4444-4444-444444444444', 'editor', 'suspended', 'dave@a.test', 'Dave'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', '33333333-3333-3333-3333-333333333333', 'admin', 'active', 'carol@b.test', 'Carol');

insert into app.projects (id, organization_id, name) values
  ('aaaaaaaa-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-00000000000a', 'Project of A'),
  ('bbbbbbbb-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-00000000000b', 'Project of B');

------------------------------------------------------------------------------------------------------------------------
-- alice, Admin of A
------------------------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select results_eq(
  $$ select id from app.projects $$,
  $$ values ('aaaaaaaa-0000-0000-0000-0000000000a1'::uuid) $$,
  'Admin of A sees only the projects of A'
);
select results_eq(
  $$ select id from licensing.organizations $$,
  $$ values ('aaaaaaaa-0000-0000-0000-00000000000a'::uuid) $$,
  'Admin of A sees only organization A'
);
select is((select count(*)::int from app.memberships), 4, 'Admin of A sees the 4 accounts of A and none of B');
select is_empty($$ select 1 from licensing.operators $$, 'A customer Admin cannot read the operator list');
select lives_ok(
  $$ insert into app.projects (organization_id, name) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'New project of A') $$,
  'Admin of A can create a project in A'
);
select throws_ok(
  $$ insert into app.projects (organization_id, name) values ('bbbbbbbb-0000-0000-0000-00000000000b', 'Intrusion') $$,
  '42501', null,
  'Admin of A cannot create a project in B'
);
select throws_ok(
  $$ insert into app.memberships (organization_id, user_id, role, email, display_name)
     values ('bbbbbbbb-0000-0000-0000-00000000000b', '11111111-1111-1111-1111-111111111111', 'admin', 'alice@a.test', 'Alice') $$,
  '42501', null,
  'Admin of A cannot add themselves to organization B'
);
select throws_ok(
  $$ update licensing.organizations set credits_granted = 1000 returning id $$,
  '42501', null,
  'A customer Admin cannot change the credits'
);
select is_empty(
  $$ update app.projects set name = 'Hacked' where organization_id = 'bbbbbbbb-0000-0000-0000-00000000000b' returning id $$,
  'Admin of A cannot rename a project of B'
);
select is_empty(
  $$ delete from app.projects where organization_id = 'bbbbbbbb-0000-0000-0000-00000000000b' returning id $$,
  'Admin of A cannot delete a project of B'
);
select lives_ok(
  $$ select app.reactivate_account('44444444-4444-4444-4444-444444444444') $$,
  'Admin of A can change the status of an account of A'
);
reset role;
-- Restore dave's suspension for the next checks.
update app.memberships set status = 'suspended' where user_id = '44444444-4444-4444-4444-444444444444';

------------------------------------------------------------------------------------------------------------------------
-- bob, Viewer of A
------------------------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

select isnt_empty(
  $$ select 1 from app.projects where id = 'aaaaaaaa-0000-0000-0000-0000000000a1' $$,
  'Viewer of A reads the projects of A'
);
select throws_ok(
  $$ insert into app.projects (organization_id, name) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'By a viewer') $$,
  '42501', null,
  'A Viewer cannot create a project'
);
select is_empty(
  $$ update app.projects set name = 'Renamed' where organization_id = 'aaaaaaaa-0000-0000-0000-00000000000a' returning id $$,
  'A Viewer cannot rename a project'
);
select is_empty(
  $$ delete from app.projects where organization_id = 'aaaaaaaa-0000-0000-0000-00000000000a' returning id $$,
  'A Viewer cannot delete a project'
);
select is_empty(
  $$ update app.memberships set role = 'admin' where user_id = '22222222-2222-2222-2222-222222222222' returning user_id $$,
  'A Viewer cannot promote themselves'
);
select throws_ok(
  $$ insert into app.memberships (organization_id, user_id, role, email, display_name)
     values ('aaaaaaaa-0000-0000-0000-00000000000a', '99999999-9999-9999-9999-999999999999', 'viewer', 'olga@operator.test', 'Olga') $$,
  '42501', null,
  'A Viewer cannot add an account'
);
reset role;

------------------------------------------------------------------------------------------------------------------------
-- eve, Editor of A
------------------------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "55555555-5555-5555-5555-555555555555", "role": "authenticated"}';

select lives_ok(
  $$ insert into app.projects (organization_id, name) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'By an editor') $$,
  'An Editor of A can create a project in A'
);
select throws_ok(
  $$ insert into app.memberships (organization_id, user_id, role, email, display_name)
     values ('aaaaaaaa-0000-0000-0000-00000000000a', '99999999-9999-9999-9999-999999999999', 'viewer', 'olga@operator.test', 'Olga') $$,
  '42501', null,
  'An Editor cannot add an account'
);
reset role;

------------------------------------------------------------------------------------------------------------------------
-- dave, suspended Editor of A
------------------------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';

select is_empty($$ select 1 from app.projects $$, 'A suspended account sees no project');
select is_empty($$ select 1 from licensing.organizations $$, 'A suspended account sees no organization');
select is_empty($$ select 1 from app.memberships $$, 'A suspended account sees no account');
select throws_ok(
  $$ insert into app.projects (organization_id, name) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'By a suspended account') $$,
  '42501', null,
  'A suspended account cannot create a project'
);
reset role;

------------------------------------------------------------------------------------------------------------------------
-- carol, Admin of B
------------------------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';

select results_eq(
  $$ select id from app.projects $$,
  $$ values ('bbbbbbbb-0000-0000-0000-0000000000b1'::uuid) $$,
  'Admin of B sees only the projects of B'
);
reset role;

------------------------------------------------------------------------------------------------------------------------
-- olga, operator (ADR 0002)
------------------------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "99999999-9999-9999-9999-999999999999", "role": "authenticated"}';

select is_empty($$ select 1 from app.projects $$, 'The operator cannot read any project');
select is_empty($$ select 1 from app.memberships $$, 'The operator cannot read any account of a customer');
select is((select count(*)::int from licensing.organizations), 2, 'The operator sees every organization');
select lives_ok(
  $$ select licensing.create_organization('Organization C', 3) $$,
  'The operator can create an organization'
);
select lives_ok(
  $$ select licensing.set_credits('aaaaaaaa-0000-0000-0000-00000000000a', 20) $$,
  'The operator can change the credits of an organization'
);
select throws_ok(
  $$ insert into app.projects (organization_id, name) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'By the operator') $$,
  '42501', null,
  'The operator cannot write customer content'
);
reset role;

------------------------------------------------------------------------------------------------------------------------
-- Anonymous visitor
------------------------------------------------------------------------------------------------------------------------
set local role anon;

select throws_ok($$ select 1 from app.projects $$, '42501', null, 'An anonymous visitor cannot reach app');
select throws_ok($$ select 1 from licensing.organizations $$, '42501', null, 'An anonymous visitor cannot reach licensing');
reset role;

select * from finish();
rollback;

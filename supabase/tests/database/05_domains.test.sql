-- Domains (ADM-050…ADM-054, MM-020…MM-025): members read, Admins write, owners and stewards are active accounts,
-- a used domain cannot be deleted, the operator sees nothing.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@a.test'),
  ('55555555-5555-5555-5555-555555555555', 'eve@a.test'),
  ('33333333-3333-3333-3333-333333333333', 'carol@b.test'),
  ('99999999-9999-9999-9999-999999999999', 'olga@operator.test');
insert into licensing.organizations (id, name, credits_granted) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'Organization A', 10),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'Organization B', 10);
insert into licensing.operators (user_id) values ('99999999-9999-9999-9999-999999999999');
insert into app.memberships (organization_id, user_id, role, email, display_name) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'admin', 'alice@a.test', 'Alice'),
  ('aaaaaaaa-0000-0000-0000-00000000000a', '55555555-5555-5555-5555-555555555555', 'editor', 'eve@a.test', 'Eve'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', '33333333-3333-3333-3333-333333333333', 'admin', 'carol@b.test', 'Carol');
insert into app.projects (id, organization_id, name, slug) values
  ('aaaaaaaa-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-00000000000a', 'Project of A', 'project-a');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select lives_ok($$ select app.save_domain('SEL', 'Sales', 'Customers and orders', 'Alice@A.test', array['eve@a.test']) $$,
  'ADM-050: an Admin creates a domain');
select lives_ok($$ select app.save_domain('MFG', 'Manufacture', '', 'alice@a.test', array['alice@a.test', 'eve@a.test', 'EVE@a.test']) $$,
  'ADM-050: and another one');
select is((select steward_emails from app.domains where code = 'MFG'), array['alice@a.test', 'eve@a.test'],
  'Stewards are stored once each, in lower case');
select throws_ok($$ select app.save_domain('sel', 'Sales', '', 'alice@a.test', array['eve@a.test']) $$,
  'P0001', null, 'MM-020: a code has 2 to 5 capitals or digits');
select throws_ok($$ select app.save_domain('GOV', 'Govern', '', 'alice@a.test', array[]::text[]) $$,
  'P0001', null, 'MM-021: a domain needs a steward');
select throws_ok($$ select app.save_domain('GOV', 'Govern', '', 'alice@a.test', array['carol@b.test']) $$,
  'P0001', null, 'MM-022: stewards are active accounts of the organization');
reset role;

-- A model of project A uses SEL.
insert into app.spec_objects (project_id, organization_id, kind, key, path, content, hash) values
  ('aaaaaaaa-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-00000000000a', 'model', 'dim_customer',
   'models/SEL/dim_customer.yaml', '{"kind":"model","id":"dim_customer","domain":"SEL"}',
   'sha256:1111111111111111111111111111111111111111111111111111111111111111');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select throws_ok($$ select app.delete_domain('SEL') $$, 'P0001', null, 'MM-025: a used domain cannot be deleted');
select lives_ok($$ select app.set_domain_retired('SEL', true) $$, 'ADM-052: it can be retired');
select isnt((select retired_at from app.domains where code = 'SEL'), null, 'The domain is retired');
select lives_ok($$ select app.delete_domain('MFG') $$, 'An unused domain can be deleted');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "55555555-5555-5555-5555-555555555555", "role": "authenticated"}';
select is((select count(*)::int from app.domains), 1, 'ADM-054: an Editor reads the catalogue');
select throws_ok($$ select app.save_domain('GOV', 'Govern', '', 'alice@a.test', array['alice@a.test']) $$,
  '42501', null, 'Only Admins change the catalogue (MM-024, MM-025)');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select is_empty($$ select 1 from app.domains $$, 'Another organization sees no domain of A');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "99999999-9999-9999-9999-999999999999", "role": "authenticated"}';
select is_empty($$ select 1 from app.domains $$, 'RM-033: the operator sees no domain');
reset role;

select * from finish();
rollback;

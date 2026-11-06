-- docs/05-modules/administration.md and docs/05-modules/control-tower.md: accounts use credits, deletion goes through
-- the operator who sees counts only, an organization keeps an active Admin, and every operator action is audited.
--
-- Cast (all fixtures are rolled back at the end):
--   Organization A (3 credits): alice (admin), bob (editor)
--   Organization B (1 credit): carol (admin)
--   olga: operator
--   new1, new2, new3: people just invited through Supabase Auth (no account yet)
--   old: a person who already signed in once, with no account
begin;
create extension if not exists pgtap with schema extensions;
select plan(45);

insert into auth.users (id, email, created_at, last_sign_in_at) values
  ('11111111-1111-1111-1111-111111111111', 'alice@a.test', now() - interval '1 day', now()),
  ('22222222-2222-2222-2222-222222222222', 'bob@a.test', now() - interval '1 day', now()),
  ('33333333-3333-3333-3333-333333333333', 'carol@b.test', now() - interval '1 day', now()),
  ('99999999-9999-9999-9999-999999999999', 'olga@operator.test', now() - interval '1 day', now()),
  ('a0000000-0000-0000-0000-000000000001', 'new1@a.test', now(), null),
  ('a0000000-0000-0000-0000-000000000002', 'new2@a.test', now(), null),
  ('a0000000-0000-0000-0000-000000000003', 'new3@b.test', now(), null),
  ('a0000000-0000-0000-0000-0000000000ff', 'old@x.test', now() - interval '1 day', now());

insert into licensing.organizations (id, name, credits_granted) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'Organization A', 3),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'Organization B', 1);
insert into licensing.operators (user_id) values ('99999999-9999-9999-9999-999999999999');
insert into app.memberships (organization_id, user_id, role, email, display_name, joined_at) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'admin', 'alice@a.test', 'Alice', now()),
  ('aaaaaaaa-0000-0000-0000-00000000000a', '22222222-2222-2222-2222-222222222222', 'editor', 'bob@a.test', 'Bob', now()),
  ('bbbbbbbb-0000-0000-0000-00000000000b', '33333333-3333-3333-3333-333333333333', 'admin', 'carol@b.test', 'Carol', now());
insert into auth.sessions (id, user_id) values ('5e550000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222');

------------------------------------------------------------------------------------------------------------------------
-- alice, Admin of A: counter and accounts
------------------------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select results_eq($$ select * from app.license_counter() $$, $$ values (3, 2, 1, 0) $$,
  'ADM-001: the Admin sees credits granted, used, remaining and waiting for deletion');
select is((select count(*)::int from app.list_accounts()), 2, 'SCR-080: the Admin lists the 2 accounts of A');
select is(app.credits_remaining(), 1, 'One credit remains before inviting');
select is(app.email_available('Carol@B.test'), false, 'ADM-013: an address used by any Atlas sign-in is not available');
select is(app.email_available('someone@new.test'), true, 'ADM-013: a new address is available');

select throws_ok($$ select app.add_account('a0000000-0000-0000-0000-0000000000ff', 'old@x.test', 'Old', 'viewer') $$,
  'P0001', null, 'ADM-013: a person who already signed in cannot be attached to the organization');
select throws_ok($$ select app.add_account('99999999-9999-9999-9999-999999999999', 'olga@operator.test', 'Olga', 'admin') $$,
  'P0001', null, 'CT-003: the operator can never become a member of an organization');
select throws_ok($$ select app.add_account('33333333-3333-3333-3333-333333333333', 'carol@b.test', 'Carol', 'viewer') $$,
  'P0001', null, 'ADM-030: an account of another organization cannot be attached');
select lives_ok($$ select app.add_account('a0000000-0000-0000-0000-000000000001', 'New1@A.test ', 'New One', 'viewer') $$,
  'ADM-010: the Admin creates an account for an invited person');
select is((select email from app.memberships where user_id = 'a0000000-0000-0000-0000-000000000001'), 'new1@a.test',
  'The e-mail is stored trimmed and in lower case');
select is((select joined_at from app.memberships where user_id = 'a0000000-0000-0000-0000-000000000001'), null,
  'ADM-012: the new account shows as invited until the person chooses a password');
select throws_ok($$ select app.add_account('a0000000-0000-0000-0000-000000000002', 'new2@a.test', 'New Two', 'viewer') $$,
  'P0001', 'No license credit remains (ADM-011).', 'ADM-011: no account without a remaining credit');

select throws_ok($$ select app.set_role('11111111-1111-1111-1111-111111111111', 'viewer') $$,
  'P0001', null, 'ADM-017: an Admin cannot change their own role');
select throws_ok($$ select app.suspend_account('11111111-1111-1111-1111-111111111111') $$,
  'P0001', null, 'ADM-017: an Admin cannot suspend themselves');
select throws_ok($$ select app.set_role('33333333-3333-3333-3333-333333333333', 'viewer') $$,
  'P0002', null, 'An Admin cannot touch an account of another organization');
select lives_ok($$ select app.set_role('22222222-2222-2222-2222-222222222222', 'admin') $$,
  'ADM-015: the Admin changes a role');
select lives_ok($$ select app.set_role('22222222-2222-2222-2222-222222222222', 'editor') $$,
  'ADM-015: and changes it back');

select lives_ok($$ select app.suspend_account('22222222-2222-2222-2222-222222222222') $$,
  'ADM-018: the Admin suspends an account');
reset role;
select is((select count(*)::int from auth.sessions where user_id = '22222222-2222-2222-2222-222222222222'), 0,
  'ADM-018: suspending ends the sessions of the account');
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select lives_ok($$ select app.reactivate_account('22222222-2222-2222-2222-222222222222') $$,
  'ADM-019: the Admin reactivates it');

select lives_ok($$ select app.request_deletion('a0000000-0000-0000-0000-000000000001') $$,
  'ADM-020: the Admin requests a deletion');
select results_eq($$ select status::text, deletion_requested_at is not null from app.memberships
                     where user_id = 'a0000000-0000-0000-0000-000000000001' $$,
  $$ values ('suspended', true) $$, 'ADM-020: the account is suspended at once and waits for deletion');
select throws_ok($$ select app.reactivate_account('a0000000-0000-0000-0000-000000000001') $$,
  'P0001', null, 'An account waiting for deletion cannot be reactivated before the request is cancelled');
select results_eq($$ select * from app.license_counter() $$, $$ values (3, 3, 0, 1) $$,
  'ADM-002: the credit stays used while the deletion waits');
reset role;

------------------------------------------------------------------------------------------------------------------------
-- bob, Editor of A
------------------------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

select throws_ok($$ select * from app.license_counter() $$, '42501', null, 'An Editor does not see the license counter');
select throws_ok($$ select * from app.list_accounts() $$, '42501', null, 'An Editor cannot use the account list of Admins');
select throws_ok($$ select app.suspend_account('11111111-1111-1111-1111-111111111111') $$,
  '42501', null, 'An Editor cannot suspend an account');
select throws_ok($$ select * from licensing.organization_figures() $$, '42501', null,
  'A customer cannot read the control tower figures');
select lives_ok($$ select app.set_my_display_name('Bob B.') $$, 'SCR-090: anyone changes their own display name');
select throws_ok($$ select app.email_available('carol@b.test') $$, '42501', null,
  'An Editor cannot check whether an address is used');
select throws_ok($$ select licensing.validate_deletions('aaaaaaaa-0000-0000-0000-00000000000a') $$, '42501', null,
  'A customer cannot validate deletions');
reset role;

------------------------------------------------------------------------------------------------------------------------
-- Last active Admin (ADM-016), checked even for the database owner
------------------------------------------------------------------------------------------------------------------------
select throws_ok($$ update app.memberships set status = 'suspended' where user_id = '33333333-3333-3333-3333-333333333333' $$,
  'P0001', null, 'ADM-016: the last active Admin of an organization cannot be suspended');
select throws_ok($$ update app.memberships set role = 'editor' where user_id = '33333333-3333-3333-3333-333333333333' $$,
  'P0001', null, 'ADM-016: the last active Admin cannot be demoted');

------------------------------------------------------------------------------------------------------------------------
-- olga, operator
------------------------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "99999999-9999-9999-9999-999999999999", "role": "authenticated"}';

select results_eq(
  $$ select name, credits_granted, accounts, credits_remaining, deletions_waiting from licensing.organization_figures()
     where id = 'aaaaaaaa-0000-0000-0000-00000000000a' $$,
  $$ values ('Organization A'::text, 3, 3, 0, 1) $$,
  'CT-010, CT-020: the operator sees the figures of each organization');
select throws_ok($$ select * from app.list_accounts() $$, '42501', null, 'The operator cannot list the accounts of a customer');
select is_empty($$ select 1 from app.memberships $$, 'The operator cannot read the accounts of a customer');
select throws_ok($$ select licensing.set_credits('aaaaaaaa-0000-0000-0000-00000000000a', 2) $$,
  'P0001', null, 'CT-013: credits cannot go below the number of accounts');
select is(licensing.validate_deletions('aaaaaaaa-0000-0000-0000-00000000000a'), 1,
  'CT-021: validating removes the waiting accounts and says only how many');
select results_eq(
  $$ select accounts, credits_remaining, deletions_waiting from licensing.organization_figures()
     where id = 'aaaaaaaa-0000-0000-0000-00000000000a' $$,
  $$ values (2, 1, 0) $$, 'CT-021: the credit is back');
select lives_ok($$ select licensing.create_organization('Organization C', 2) $$, 'CT-011: the operator creates an organization');
select throws_ok($$ select licensing.create_organization('Organization D', 0) $$,
  'P0001', null, 'CT-011: an organization starts with at least 1 credit');
select lives_ok(
  $$ select licensing.add_first_admin((select id from licensing.organizations where name = 'Organization C'),
                                      'a0000000-0000-0000-0000-000000000003', 'new3@b.test', 'Nina') $$,
  'CT-012: the operator invites the first Admin of the new organization');
select throws_ok(
  $$ select licensing.add_first_admin('bbbbbbbb-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-000000000002',
                                      'new2@a.test', 'Intruder') $$,
  'P0001', null, 'The operator cannot add an Admin to an organization that already has accounts');
select is(
  (select array_agg(action order by id) from licensing.operator_audit),
  array['deletions_validated', 'organization_created', 'first_admin_invited'],
  'CT-040: every successful operator action is in the audit log');
select is_empty($$ select 1 from licensing.operator_audit where details::text like '%@%' $$,
  'CT-012: the audit log never holds an e-mail address');
reset role;

select * from finish();
rollback;

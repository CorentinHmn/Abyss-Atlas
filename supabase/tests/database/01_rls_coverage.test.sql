-- RM-011 / ARC-100 / ARC-104: no table of `app` or `licensing` may exist without row-level security.
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

select is_empty(
  $$
    select c.oid::regclass::text
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('app', 'licensing')
      and c.relkind in ('r', 'p')
      and not c.relrowsecurity
  $$,
  'Every table of app and licensing has row-level security enabled'
);

select is_empty(
  $$
    select c.oid::regclass::text
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('app', 'licensing')
      and c.relkind in ('r', 'p')
      and not exists (select 1 from pg_policy p where p.polrelid = c.oid)
  $$,
  'Every table of app and licensing has at least one policy'
);

select is_empty(
  $$
    select table_schema || '.' || table_name || ': ' || privilege_type
    from information_schema.role_table_grants
    where grantee in ('anon', 'PUBLIC')
      and table_schema in ('app', 'licensing')
  $$,
  'Anonymous visitors have no privilege on app or licensing'
);

select * from finish();
rollback;

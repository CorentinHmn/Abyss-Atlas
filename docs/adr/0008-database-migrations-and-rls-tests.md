# ADR 0008 — Database migrations and RLS tests

Status: Accepted
Date: 2026-11-05
Deciders: founder

## 1. Context
- Tenant isolation and the operator boundary are enforced by PostgreSQL row-level security (ARC-100…ARC-104,
  ADR 0002). They must be versioned, reviewed and proven by automated tests before anything ships (RM-011).
- ADR 0001 chose Drizzle as ORM. Drizzle can also generate migrations, but RLS policies, `security definer`
  functions and grants are first-class in SQL and only partly covered by its migration generator.
- The hosted database is a Supabase project (`atlas`, Frankfurt). Supabase ships a CLI with a local stack, SQL
  migrations and pgTAP tests.

## 2. Options considered
| Option | Pros | Cons |
|---|---|---|
| Drizzle Kit migrations generated from a TypeScript schema | One schema language with the app code. | RLS, functions and grants partly outside the generator; the security-critical part would be split between generated and hand-written SQL. |
| **Supabase CLI: hand-written SQL migrations + pgTAP tests** | Security rules written exactly as they run; local stack identical to the hosted one; `supabase test db` runs pgTAP in CI. | Two languages (SQL for the schema, TypeScript for queries). |
| Prisma migrations | Mature tooling. | Same RLS gap as Drizzle; not in the chosen stack. |

## 3. Decision
1. **`supabase/migrations/*.sql` is the only source of truth** for the database: tables, types, functions,
   grants and RLS policies.
2. A migration is **never edited once applied** to the hosted project; changes go in a new migration.
3. **The file version equals the version recorded in the hosted project** (`supabase_migrations`), so the repository
   and the database always agree.
4. **`supabase/tests/database/*.test.sql` (pgTAP)** prove the security rules. At least:
   - every table of `app` and `licensing` has RLS enabled and at least one policy;
   - anonymous visitors have no privilege on these schemas;
   - isolation between organizations, roles, suspended accounts, and no operator access to `app`.
5. **CI** starts a fresh local database, applies all migrations and runs the tests on every push (`database` job).
6. **Drizzle** stays in the stack for **typed queries only** (from P2), with its schema introspected from the
   database. It never generates migrations.

## 4. Consequences
- Positive: security rules are reviewed as SQL and proven by tests; a table without RLS fails the build; the
  local database matches production.
- Negative: SQL and TypeScript types must be kept in sync (introspection, from P2); applying migrations to the
  hosted project is a deliberate step, done after the tests pass.

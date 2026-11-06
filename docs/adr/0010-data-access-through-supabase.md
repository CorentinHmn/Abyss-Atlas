# ADR 0010 — Data access through supabase-js and database functions, not Drizzle

Status: Accepted
Date: 2026-11-06
Deciders: founder (plan of P2, step "accounts and credits")
Amends: ADR 0001 (Drizzle "for typed queries only, from P2")

## 1. Context
- ADR 0001 planned Drizzle for typed queries from P2.
- Tenant isolation, roles and the operator boundary are enforced by row-level security and by database functions
  (ADR 0002, ADR 0008). They apply only when a query runs **as the signed-in user** (their JWT).
- Drizzle connects to PostgreSQL directly, as one database role: every query would bypass RLS unless the app switches
  role and claims per request, which moves the security boundary back into application code.

## 2. Options considered
| Option | Pros | Cons |
|---|---|---|
| A. Drizzle over a direct connection | One typed query builder. | Bypasses RLS by default; per-request role switching to get it back; a connection pool to run from Vercel functions. |
| **B. supabase-js with the user's session, types generated from the database** | RLS and function checks always apply; no direct database connection from the app; types follow the migrations. | Two exposed schemas (`app`, `licensing`) in the Data API; complex writes go through SQL functions. |

## 3. Decision
**Option B.**

1. The web app reads and writes through supabase-js **with the user's session**: RLS applies to every query.
2. Writes with rules (credits, last Admin, operator actions) go through **SQL functions** that check the caller and
   are tested with pgTAP (`supabase/migrations/20261106100000_accounts_and_credits.sql`).
3. TypeScript types are **generated** from the local database (`pnpm db:types` →
   `apps/web/src/lib/database/types.ts`); CI fails when they are out of date.
4. The schemas `app` and `licensing` are exposed in the Data API. Anonymous visitors have no privilege on them;
   signed-in users see what RLS allows.
5. The secret key is used on the server only, for Supabase Auth administration (sending invitations, removing an
   unused sign-in), never to read customer content.

## 4. Consequences
- Positive: one security boundary, in the database, proven by tests; no connection pool to operate.
- Negative: logic with several steps is written in SQL; the Data API settings of the hosted project must list the
  two schemas (done once in the Supabase dashboard).
- The worker (P3) may use a direct connection for co-editing storage; it will be decided in its own ADR.

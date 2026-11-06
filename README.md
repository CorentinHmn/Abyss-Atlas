# Atlas

Source-to-target specifications for data platforms (provisional codename). Product documentation is in
[`docs/`](docs/); working rules for contributors and AI agents are in [`CLAUDE.md`](CLAUDE.md).

## Layout
| Path | Content |
|---|---|
| `apps/web` | SaaS application (Next.js), deployed on Vercel (region `fra1`) |
| `packages/core` | Business core: metamodel, YAML format, validation, generators |
| `examples/reference/` | Reference project: multi-ERP spec used as the acceptance test of every phase |
| `supabase/` | Database migrations (SQL, source of truth) and RLS tests (pgTAP), see ADR 0008 |
| `packages/cli` | Command line `atlas`, internal tool (tests, CI, reference runs): validate, generate dbt and docs, import dictionaries, diff |
| `examples/reference-data/` | Fictitious source data and expected results of the reference project |
| `scripts/` | Repository checks: generated dbt project, reference runs offline (DuckDB) and on Snowflake (`scripts/reference-run/README.md`) |
| `docs/` | Product specifications and architecture decisions (`docs/adr/`) |

Proprietary: nothing in this repository is open source (ADR 0009).

`apps/worker` arrives in a later phase (`docs/07-roadmap.md`).

## Getting started
Requirements: Node.js 22.12+ and pnpm 10 (`corepack enable`).

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
pnpm dev            # http://localhost:3000
```

## Command line
```bash
pnpm --filter @atlas/cli build
node packages/cli/dist/atlas.js validate examples/reference
node packages/cli/dist/atlas.js generate dbt examples/reference --out /tmp/dbt
node packages/cli/dist/atlas.js generate docs examples/reference --out /tmp/docs
node packages/cli/dist/atlas.js import dictionary catalog.csv --system sap_fr --dialect sap examples/reference
```
Catalog queries to produce `catalog.csv` from PostgreSQL or SQL Server: `packages/core/src/import/catalog-queries.ts` (also shown in Atlas).

## Checks
```bash
pnpm check          # lint + typecheck + tests
pnpm build          # production build
```

End-to-end tests (Playwright) run against a local Supabase stack and the web app:
```bash
pnpm db:start                                   # local Supabase (Docker), with Mailpit for e-mails
pnpm exec supabase status -o env                # local URL, publishable and secret keys
export NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<local> SUPABASE_SECRET_KEY=<local>
pnpm --filter @atlas/web e2e                    # starts the app if needed
```
After a migration, regenerate the database types: `pnpm db:types`.

Database (needs Docker):
```bash
pnpm db:start      # local Supabase database with every migration applied
pnpm db:test       # RLS and isolation tests (pgTAP)
pnpm db:reset      # rebuild the local database from the migrations
```
Generated dbt project (needs Python and `pip install -r scripts/generated-dbt/requirements.txt`):
```bash
scripts/generated-dbt/check.sh
```

The same checks run in GitHub Actions on every push and pull request.

Database changes: add a new file in `supabase/migrations/` (never edit an applied one), make `pnpm db:test` pass,
then apply it to the hosted project and keep the file version equal to the version recorded there (ADR 0008).

## Environments
| Environment | Web | Database |
|---|---|---|
| Local | `pnpm dev` | Supabase project `atlas` (EU, Frankfurt) |
| Preview | Vercel, one per branch | Supabase project `atlas` |
| Production | Vercel, branch `main` | Supabase project `atlas` until a dedicated production project exists (P4) |

## Conventions
English everywhere, Conventional Commits, no hard-coded UI text (enforced by lint; strings live in
`apps/web/messages/`). See `CLAUDE.md`.

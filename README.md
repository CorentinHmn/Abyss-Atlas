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
| `docs/` | Product specifications and architecture decisions (`docs/adr/`) |

`apps/worker` and `packages/cli` arrive in later phases (`docs/07-roadmap.md`).

## Getting started
Requirements: Node.js 22.12+ and pnpm 10 (`corepack enable`).

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
pnpm dev            # http://localhost:3000
```

## Checks
```bash
pnpm check          # lint + typecheck + tests
pnpm build          # production build
```
Database (needs Docker):
```bash
pnpm db:start      # local Supabase database with every migration applied
pnpm db:test       # RLS and isolation tests (pgTAP)
pnpm db:reset      # rebuild the local database from the migrations
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

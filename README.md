# Atlas

Source-to-target specifications for data platforms (provisional codename). Product documentation is in
[`docs/`](docs/); working rules for contributors and AI agents are in [`CLAUDE.md`](CLAUDE.md).

## Layout
| Path | Content |
|---|---|
| `apps/web` | SaaS application (Next.js), deployed on Vercel (region `fra1`) |
| `packages/core` | Business core: metamodel, YAML format, validation, generators |
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
The same checks run in GitHub Actions on every push and pull request.

## Environments
| Environment | Web | Database |
|---|---|---|
| Local | `pnpm dev` | Supabase project `atlas` (EU, Frankfurt) |
| Preview | Vercel, one per branch | Supabase project `atlas` |
| Production | Vercel, branch `main` | Supabase project `atlas` until a dedicated production project exists (P4) |

## Conventions
English everywhere, Conventional Commits, no hard-coded UI text (enforced by lint; strings live in
`apps/web/messages/`). See `CLAUDE.md`.

# CLAUDE.md — Atlas (provisional codename)

## The product in one sentence
**Source-to-target specification "as code"** SaaS for data platforms: for each column of a target table,
we describe in a **structured** way (not free text) its provenance (system/ERP → table → column),
the joins, the type conversions and the business rules. The spec is versioned in Git,
validated, and generates code (dbt / SQL) and documentation.

## Differentiating principle (never lose sight of it)
- **Joins, types, rules and multi-system provenance are first-class objects**,
  not strings.
- **ODCS-compatible** (Open Data Contract Standard, Bitol / Linux Foundation) for import/export,
  without depending on it: our format is richer, ODCS is an output.
- **Git-native**: the source of truth is a readable, diffable text format (YAML).
- **Metadata only**: Atlas never stores customer data and never connects to customer systems
  (see docs/00-vision.md).
- **Customer confidentiality**: the operator never sees customer content; the control tower sees licensing
  figures only, enforced in the database (ADR 0002).

## Stack (see docs/adr/0001-stack.md)
- **pnpm + Turborepo** monorepo, strict **TypeScript** everywhere.
- `apps/web`: **Next.js** (App Router), **Tailwind CSS**, **shadcn/ui**,
  **React Flow** (join / lineage graphs), **Monaco** (YAML/SQL editor).
- i18n: **next-intl** from day one. English-only UI at launch, but no hard-coded UI text;
  French and German planned next.
- `packages/core`: metamodel (**Zod** schemas), YAML parser/serializer, validation,
  generators (dbt, SQL, ODCS, Markdown). **No UI dependency.**
- `packages/cli`: CLI `atlas validate | generate | import | diff`.
- `apps/worker`: Node.js service: real-time co-editing (**Yjs** + Hocuspocus, ADR 0005) and background jobs
  (**Supabase Queues**, ADR 0006).
- AI: **Claude on Amazon Bedrock**, EU region, through one AI gateway; off by default per organization (ADR 0004).
- Data: **PostgreSQL** (Supabase), **Drizzle** ORM, multi-tenant per organization with RLS.
- Auth: Supabase Auth. Payments (later): Stripe.
- Hosting: **EU only** (GDPR): Vercel + Supabase in an EU region, worker on AWS Frankfurt; sovereign host (Scaleway, OVHcloud) as a future option.
- Tests: **Vitest** (unit), **Playwright** (e2e).
- Later, if advanced SQL analysis is needed: a small, isolated Python service (sqlglot).

## Directory layout
```
apps/web/            SaaS application
apps/worker/         co-editing server and background jobs
packages/core/       business core (metamodel, validation, generators)
packages/cli/        command line
docs/                product specifications (functional source of truth)
docs/adr/            architecture decisions (one decision = one dated file)
```

## Product documentation (read ONLY what concerns the task)
| File | Content |
|---|---|
| docs/00-vision.md | ambitions, problem, positioning, non-goals |
| docs/01-scope.md | personas, use cases, out of scope |
| docs/02-metamodel.md | domain objects and their relations (**core of the product**) |
| docs/03-spec-format.md | YAML grammar + ODCS mapping |
| docs/04-architecture.md | components, flows, security, multi-tenancy |
| docs/05-modules/*.md | one file per functional module |
| docs/06-ux/navigation-menus.md | menu and screen tree |
| docs/06-ux/screens/*.md | one file per screen |
| docs/07-roadmap.md | phases, milestones, exit criteria |

## Working rules (efficiency)
1. **Read the minimum**: only load the docs files relevant to the current task.
2. **Plan first** for any task touching more than 2 files: propose the plan, wait for validation.
3. **Edit, don't rewrite**: targeted edits; never regenerate a whole file without an explicit request.
4. **One structural decision = one ADR** in docs/adr/ (context, options, decision, consequences).
5. **The metamodel is authoritative**: any concept change goes first through docs/02-metamodel.md,
   then through the Zod schemas in packages/core.
6. When a spec is ambiguous: ask the question, don't invent.
7. Update this file if the stack or the directory layout changes (keep it < 100 lines).

## Conventions
- **Everything in English** (European market): product docs, code, file names, comments, commits and UI.
  Conversations with the founder may be in French.
- Commits: Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`).
- Docs format: numbered headings, stable requirement identifiers (`MAP-012`, `UX-004`…),
  status at the top of the file (`Draft` / `Validated`).
- Each roadmap feature references its requirement identifiers.

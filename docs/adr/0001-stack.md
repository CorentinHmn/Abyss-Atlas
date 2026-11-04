# ADR 0001 — Technical stack

Status: Accepted
Date: 2026-11-04
Deciders: founder

## 1. Context
Atlas is a source-to-target specification SaaS (see `docs/00-vision.md`). The stack must support:

1. **A business core shared by the web app and the CLI**: the metamodel, YAML parsing, validation and generators run
   the same way in the browser, on the server and in CI.
2. **Open core**: the spec format, `packages/core` and the CLI are open source. They must build and ship without the
   SaaS (no dependency on the web app, the database or the auth provider).
3. **Rich editing UI**: join and lineage graphs, YAML/SQL code editing, forms.
4. **Multi-tenant SaaS**: organizations isolated from each other, with roles.
5. **European market**: EU hosting and GDPR as a selling point; metadata only, never customer data.
6. **Multilingual UI**: English at launch, then French and German.
7. **A very small team**: favor mainstream, well-documented tools with low operating cost.

## 2. Options considered

### 2.1 Monorepo tooling
| Option | Pros | Cons |
|---|---|---|
| **pnpm + Turborepo** | Simple config; fast, strict installs; task caching; easy to publish packages separately. | Fewer built-in generators and boundary rules than Nx. |
| Nx | Powerful: generators, dependency graph, module boundary rules. | Heavier config and concepts; more lock-in to Nx conventions. |

### 2.2 Web framework
| Option | Pros | Cons |
|---|---|---|
| **Next.js (App Router)** | Largest React ecosystem; server components and server actions; first-class Vercel hosting; mature i18n (next-intl). | Framework complexity (caching, server/client boundaries); tied to Vercel's roadmap. |
| Remix / React Router 7 | Simple web-standard data model. | Smaller ecosystem; framework in transition (Remix merged into React Router). |
| SvelteKit | Light and fast. | React Flow, Monaco wrappers and shadcn/ui are React-first; smaller hiring pool. |

### 2.3 Data access
| Option | Pros | Cons |
|---|---|---|
| **Drizzle** | SQL-first, light runtime, typed schema in TypeScript, fits well with Postgres features (RLS policies, SQL functions). | Younger; fewer high-level features. |
| Prisma | Mature, good developer experience. | Heavier abstraction; Postgres RLS and custom SQL are less natural. |

### 2.4 Authentication
| Option | Pros | Cons |
|---|---|---|
| **Supabase Auth** | Same platform as the database; user identity directly usable in RLS policies; EU region available. | Enterprise SSO depends on the Supabase plan. |
| Clerk | Polished UI components, organizations built in. | Extra external vendor and cost; another processor of personal data to cover for GDPR. |
| Auth.js | Open source, self-managed. | More to build and maintain (organizations, SSO, security). |

### 2.5 Internationalization
| Option | Pros | Cons |
|---|---|---|
| **next-intl** | Built for the Next.js App Router (server and client components); ICU messages; typed keys. | Specific to Next.js (only the web app needs it). |
| i18next / react-i18next | Very widespread, framework-agnostic. | More setup for server components. |

## 3. Decision
| Area | Choice |
|---|---|
| Language | **TypeScript**, strict mode, everywhere. |
| Monorepo | **pnpm + Turborepo**. |
| Web app (`apps/web`) | **Next.js** (App Router), **Tailwind CSS**, **shadcn/ui**, **React Flow** (join / lineage graphs), **Monaco** (YAML/SQL editor). |
| i18n | **next-intl** from day one. English UI at launch; no hard-coded UI text; French and German next. |
| Business core (`packages/core`) | Metamodel as **Zod** schemas, YAML parser/serializer, validation, generators (dbt, SQL, ODCS, Markdown). **No UI dependency.** |
| CLI (`packages/cli`) | `atlas validate \| generate \| import \| diff`, built on `packages/core`. |
| Database | **PostgreSQL** on **Supabase**, **Drizzle** ORM, multi-tenant per organization with **row-level security**. |
| Auth | **Supabase Auth**. |
| Payments | **Stripe**, later. |
| Tests | **Vitest** (unit), **Playwright** (end-to-end). |
| Hosting | **Vercel** (web app) and **Supabase**, both in an **EU region**. A sovereign EU host (Scaleway, OVHcloud) is a future option. |
| Advanced SQL analysis | Later, only if needed: a small, isolated **Python** service using **sqlglot**. |

## 4. Consequences

### 4.1 Positive
- One TypeScript codebase for the web app, the CLI and the core: validation and generation behave the same
  everywhere.
- `packages/core` and `packages/cli` can be published as open source on their own.
- Tenant isolation is enforced in the database (RLS), not only in application code.
- Adding French and German later is a translation task, not a refactor.
- Mainstream tools: plenty of documentation, examples and hiring options.

### 4.2 Negative / risks
- **Vercel and Supabase are US companies.** EU regions keep the data in Europe, but the providers remain subject to
  US law (e.g. the CLOUD Act). The risk is reduced by storing metadata only. A sovereign host (Scaleway, OVHcloud)
  stays an option if customers require it. Staying portable (standard Postgres, no Vercel-only APIs in the core)
  keeps that option open.
- Next.js App Router complexity (caching, server/client boundaries) needs clear conventions.
- Enterprise SSO depends on Supabase capabilities and plan.

### 4.3 Rules that follow from this decision
- `packages/core` must not import from `apps/web`, Supabase, Drizzle or any UI library.
- `packages/cli` depends only on `packages/core` (and CLI utilities); it must work offline, without an account.
- Every UI string goes through next-intl message files; no hard-coded text in components.
- Every tenant-scoped table has an RLS policy; there are no exceptions without an ADR.

## 5. Follow-up decisions
- Open-source license for the spec format, `packages/core` and the CLI.
- How the in-app approval workflow syncs with Git: decided in ADR 0003.
- Whether and when to add the Python sqlglot service.

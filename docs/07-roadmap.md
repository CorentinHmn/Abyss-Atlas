# 07 — Roadmap

Status: Draft
Last updated: 2026-11-04

This document orders the work into phases, each closed by exit criteria. It references the requirement
identifiers of the other documents (`UC-`, `MM-`, `FMT-`, `ARC-`, `OOS-`). Identifiers of this document: `RM-xxx`.

## 1. Principles
- RM-001: Phases are done **in order**. A phase is closed only when all its exit criteria are met.
- RM-002: There is **no target date**. Durations are hypotheses (`RH-xx`) for **one founder developing with Claude
  Code**; they are revised at the end of each phase.
- RM-003: Module and screen documents (`docs/05-modules/`, `docs/06-ux/`) are written **just before the phase that
  needs them**, not all upfront (§4).
- RM-004: Without design partners yet, every phase is accepted against the **reference project** (§2). Recruiting
  design partners is a parallel track (§5).
- RM-005: v1 is complete at the end of phase 4. The AI assistant comes **after v1 is validated** (§6).
- RM-006: **Supabase and Vercel only, until they are not enough.** The other providers of the target
  architecture join when a phase needs them: AWS (worker) in P3 for multi-user co-editing, Sentry before the
  first external users (end of P2), Bedrock in v1.1. Until then, logs come from Vercel and Supabase, and
  validation and generation of the reference project run in Vercel functions.

## 2. Reference project
A realistic project, written in phase 0 and used as the acceptance test of every phase.

| Element | Content |
|---|---|
| Systems | `sap_fr`, `sap_de` (SAP S/4HANA), `oracle` (Oracle EBS), `mes` (a manufacturing execution system). |
| Domains | `SEL` Sales, `MFG` Manufacture, `GOV` Govern (shared reference data, finance). |
| Target models | 7, 61 columns: `dim_customer`, `fact_sales_order_line` (SEL); `dim_material`, `int_mes_order_output` (intermediate, chained), `fact_production_order` (MFG); `dim_plant`, `fact_exchange_rate` (GOV). Location: `examples/reference/`. |
| Coverage | Every step kind (`docs/02-metamodel.md` §5.2), joins of each cardinality (one confirmed many-to-many), union of branches with consolidation and survivorship, at least one business rule, one value mapping, one `not_provided`, one `sql` escape hatch. |
| Outputs | dbt models for Snowflake that compile and run on a test Snowflake account with sample data; Markdown documentation. |

## 3. Phases

### 3.1 Overview
| Phase | Goal | Duration (hypothesis) |
|---|---|---|
| P0 Foundations | Deliver safely | RH-01: 1–2 weeks |
| P1 Core and CLI | The engine, open source, no UI | RH-02: 4–6 weeks |
| P2 SaaS minimum | Specify a whole model in Atlas, alone | RH-03: 8–10 weeks |
| P3 Governance and collaboration | Review, approval, co-editing | RH-04: 8–10 weeks |
| P4 v1 launch | Ready to sell | RH-05: 4–6 weeks |
| v1.1 | AI assistant | RH-06: 3–4 weeks |

### 3.2 P0 — Foundations
Content:
- Monorepo (pnpm, Turborepo, strict TypeScript), lint, Vitest, Playwright; CI on every pull request (ARC-401).
- Environments local, preview, staging (ARC-400); Supabase (EU region) and Vercel accounts only (RM-006). On the
  Supabase free plan, one hosted project (`atlas`, Frankfurt) serves every environment until a dedicated production
  project is created before launch (P4); production data never goes elsewhere (ARC-400).
- Supabase Auth sign-in; `app` and `licensing` schemas with versioned migrations (ARC-402).
- RLS test harness running in CI (ARC-104, ADR 0002 §3.4).
- next-intl set up, no hard-coded UI text (ADR 0001).
- Reference project written in YAML (§2).

Exit criteria:
- RM-010: A page with sign-in is deployed to staging, in the EU.
- RM-011: The RLS test harness runs in CI and fails on a table without a policy.
- RM-012: The reference project exists as YAML files following `docs/03-spec-format.md`.

### 3.3 P1 — Core and CLI (open source)
Content:
- `packages/core`: Zod schemas of the metamodel (MM-*), YAML parser and serializer with short forms (FMT-*),
  literal handling (FMT-020), canonical form and hashes (FMT-122, MM-603, MM-700).
- Validation: references, types and conversions, joins and cardinality, branch completeness, aggregation, escape
  hatch reporting (UC-020, MM-100…MM-702).
- Generators: dbt models and sources for Snowflake (UC-030), Markdown documentation (UC-032).
- CLI: `atlas validate`, `generate`, `diff`, `import` of dictionary files (UC-001, UC-034).
- Catalog queries for PostgreSQL and SQL Server, documented, and the matching CSV import (UC-003).
- Before release: product name and open-source license decided (§5).

Exit criteria:
- RM-020: The reference project validates with no error; every validation rule has unit tests with a failing
  example.
- RM-021: The generated dbt project of the reference project compiles and runs on Snowflake.
- RM-022: A dictionary CSV produced by the catalog query imports into dataset files.
- RM-023: Validation of the reference project takes under 1 second on a laptop.

### 3.4 P2 — SaaS minimum
Content:
- Control tower, minimum: create an organization, grant credits, validate deletions (UC-050, UC-051, UC-052).
- Accounts and roles: counter, creation using credits, suspension, deletion request (UC-040, UC-041, UC-043,
  UC-046); projects (UC-044).
- Source registry: manual entry and dictionary import in the browser (UC-001, UC-002, UC-003).
- Mapping editor: target models, branches, joins, column mappings, rules, value mappings; forms and YAML view in sync
  (UC-011…UC-015). Built on the co-editing document from the start (ADR 0005), single user in practice, saved
  through `apps/web` (no worker yet, RM-006).
- Error tracking (Sentry, EU) before the first external users (ARC-500).
- Live validation in the browser, reference validation on the server (ARC-010…ARC-013).
- History, diffs, named versions, restore (UC-023, ARC-023).
- Downloads of generated outputs and full export (UC-030, UC-032, UC-036, ADR 0007).

Exit criteria:
- RM-030: The founder writes the whole reference project in Atlas, without editing YAML outside it.
- RM-031: The downloaded dbt output is identical to the CLI output on the exported project.
- RM-032: RLS tests cover every `app` and `licensing` table; no cross-organization access.
- RM-033: The operator role cannot read any `app` table (ADR 0002 §3.4).

### 3.5 P3 — Governance and collaboration
Content:
- Domains, owners and stewards, Admin-only changes (MM-020…MM-024).
- Review and approval at every level, Approver and Self-approval permissions, outdated approvals (UC-021,
  MM-700…MM-702, `docs/01-scope.md` §2.3).
- `apps/worker` on AWS Frankfurt (ADR 0006): co-editing server and background jobs.
- Real-time co-editing with presence, read-only Viewers (UC-017, ADR 0005, ARC-102).
- Lineage and join graphs (UC-035).
- ODCS export and import (UC-033, `docs/03-spec-format.md` §8).
- Support: messages with Admin validation (UC-047, UC-055), support access (UC-045, UC-053), customer contact details
  (UC-054); control tower complete.

Exit criteria:
- RM-040: On the reference project, two people co-edit the same model and every change appears on the other screen
  in under 300 ms (ARC-303).
- RM-041: A steward approves a column mapping; changing a rule it uses marks the approval as outdated.
- RM-042: A support access opens only after a customer Admin's approval, expires on time and appears in the
  customer's log.
- RM-043: The ODCS export of the reference project passes the official ODCS schema validation.

### 3.6 P4 — v1 launch
Content:
- SSO (UC-042); MFA required for Admins and the operator (ARC-200).
- Performance targets checked on a generated project of the maximum size (ARC-300…ARC-306).
- External security review (penetration test) and fixes.
- GDPR documents: data processing agreements with each provider, list of sub-processors, customer terms and DPA
  (ARC-205).
- Paid tiers and prices (`docs/00-vision.md` §7.2); credits stay managed by the operator (payments by Stripe later).
- Website teaser and demonstration project (§5).

Exit criteria:
- RM-050: The performance targets ARC-300…ARC-306 are met.
- RM-051: No high or critical finding remains open from the security review.
- RM-052: The legal documents are signed with every provider and ready for customers.
- RM-053: v1 is validated by the founder on the reference project and on one design partner's real project.

## 4. Documents to write before each phase
| Before | Documents |
|---|---|
| P1 | `05-modules/validation.md`, `05-modules/generation.md`, `05-modules/import-export.md` |
| P2 | `05-modules/source-registry.md`, `05-modules/mapping-editor.md`, `05-modules/versioning.md`, `05-modules/administration.md`, `05-modules/control-tower.md` (minimum), `06-ux/navigation-menus.md`, screens of P2 |
| P3 | `05-modules/review-approval.md`, `05-modules/lineage.md`, `05-modules/control-tower.md` (complete), screens of P3 |
| v1.1 | `05-modules/ai-assistant.md` |

## 5. Parallel business track
| ID | Item | Needed by |
|---|---|---|
| RM-060 | Final product name, trademark check, domain name, npm organization. | End of P1 (first public release) |
| RM-061 | Open-source license of the format, `packages/core` and the CLI (ADR). | End of P1 |
| RM-062 | Recruit 3 to 5 design partners, at least 2 consulting firms (H-01). | During P2–P3, needed for RM-053 |
| RM-063 | Website teaser and a demonstration project (Q-07 of `docs/01-scope.md`). | P4 |
| RM-064 | Paid tiers and prices. | P4 |

## 6. After v1
| Item | Requirement | Order |
|---|---|---|
| **AI assistant** (Claude on Bedrock, off by default) | UC-016, ADR 0004 | v1.1, first after v1 is validated |
| Generation for Databricks, BigQuery, PostgreSQL | UC-031 | Later |
| `atlas import` reading a database catalog directly | UC-005 | Later |
| ERP data dictionaries (e.g. SAP) | UC-004, OOS-004 | Later (v2) |
| `scd2` historization | Q-MM-04 of `docs/02-metamodel.md` | Later |
| French and German UI | OOS-007 | Later |
| API to fetch generated outputs | ADR 0007 §5 | If customers ask |
| Online payments (Stripe) | ADR 0001 | Later |
| Per-organization encryption of content | ADR 0002 §5 | Later |
| Sovereign hosting, on-premise | ADR 0001, OOS-003 | On demand of large customers |

## 7. Traceability
Every use case of `docs/01-scope.md` and its phase:

| Phase | Use cases |
|---|---|
| P1 | UC-001, UC-003, UC-020, UC-030, UC-032, UC-034 |
| P2 | UC-001, UC-002, UC-003 (in the browser), UC-011…UC-015, UC-023, UC-030, UC-032 (download), UC-036, UC-040, UC-041, UC-043, UC-044, UC-046, UC-048, UC-050…UC-052 |
| P3 | UC-017, UC-021, UC-033, UC-035, UC-045, UC-047, UC-053…UC-055 |
| P4 | UC-042 |
| v1.1 | UC-016 |
| Later | UC-004, UC-005, UC-031 |
| Removed | UC-010, UC-022 |

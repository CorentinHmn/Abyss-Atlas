# 01 — Scope

Status: Draft
Last updated: 2026-11-04

This document defines who Atlas is for, what it must do first, and what it will not do. Product-level non-goals are
in `docs/00-vision.md` §8. Requirement identifiers:

- `PER-xxx`: personas
- `UC-xxx`: use cases
- `OOS-xxx`: out of scope

## 1. Personas

### 1.1 Buyers
These people decide to buy Atlas. They rarely use it day to day.

| ID | Persona | What they care about |
|---|---|---|
| PER-101 | **Head of data** | Delivery on time, auditability of figures, fewer specification errors, team knowledge that survives turnover. |
| PER-102 | **Data architect** | Consistency of models and rules across projects, standards, integration with the existing toolchain (dbt, Git, CI). |
| PER-103 | **Project director at a consulting firm** | Delivering migrations and multi-ERP projects faster and with fewer defects, a reusable method across clients, a professional deliverable for the client. |

### 1.2 Users

#### PER-001 — Data engineer
- **Role**: builds the target models and pipelines from the specification.
- **Uses Git**: yes, daily.
- **Today**:
  - writes or receives the Excel mapping;
  - translates it by hand into SQL or dbt;
  - keeps both in sync as best they can.
- **Pains**:
  - errors in the spreadsheet found late (P-1);
  - joins and rules as free text that must be interpreted (P-2);
  - drift between spec and code (P-6).
- **What Atlas gives them**:
  - a structured, validated spec;
  - generated dbt models;
  - a CLI that runs in CI;
  - diffs of the spec in pull requests.

#### PER-002 — Analyst (business / data analyst)
- **Role**: knows the source systems and the business meaning of the data. Writes most of the mapping and the
  business rules.
- **Uses Git**: not necessarily.
- **Today**: fills the Excel mapping and answers the data engineers' questions.
- **Pains**:
  - no help to find source columns;
  - no way to know which version is current (P-4);
  - the same rules rewritten again and again (P-2).
- **What Atlas gives them**:
  - a guided editor;
  - search across source metadata;
  - reusable rules;
  - AI suggestions to accept or reject;
  - validation while they type.

#### PER-003 — Data steward
- **Role**: owns the business definitions and approves the business rules for their domain.
- **Uses Git**: **no**. Never needs to see Git.
- **Today**: validates rules in meetings and by e-mail, with no trace of what was approved (P-5).
- **What Atlas gives them**:
  - a review and approval workflow in the application: Draft → In review → Approved;
  - a clear view of what changed;
  - a record of who approved what and when.

## 2. Use cases

Priority levels:

- **v1**: confirmed for the first release.
- **v1?**: candidate for v1, to be confirmed (see §4).
- **Later**: after v1. The timing goes in `docs/07-roadmap.md`.

### 2.1 Getting source metadata in
| ID | Use case | Persona | Priority |
|---|---|---|---|
| UC-001 | Import source metadata from a CSV or Excel data dictionary (systems, tables, columns, types, descriptions). | PER-001, PER-002 | v1 |
| UC-002 | Enter or edit source metadata manually. | PER-002 | v1 |
| UC-003 | Connect to a PostgreSQL or SQL Server database and read its catalog (`information_schema`). No data is read. | PER-001 | v1 |
| UC-004 | Import an ERP data dictionary (e.g. SAP). | PER-001, PER-002 | Later (v2) |

### 2.2 Writing the specification
| ID | Use case | Persona | Priority |
|---|---|---|---|
| UC-010 | **Import existing Excel source-to-target mappings** into a structured spec, with a report of what could not be interpreted. | PER-001, PER-002 | v1 (priority) |
| UC-011 | Define a target table and, for each target column, its provenance (system → table → column, possibly from several systems). | PER-002 | v1 |
| UC-012 | Define joins between source tables as structured objects (tables, keys, join type, cardinality). | PER-001, PER-002 | v1 |
| UC-013 | Define type conversions as structured objects. | PER-001, PER-002 | v1 |
| UC-014 | Define business rules as structured objects, and reuse a rule across columns. | PER-002 | v1 |
| UC-015 | Edit the spec as YAML (Monaco editor) and through forms, with both views in sync. | PER-001 | v1 |
| UC-016 | Get AI suggestions for mappings, and accept or reject each one. | PER-002 | v1? |

### 2.3 Checking and approving
| ID | Use case | Persona | Priority |
|---|---|---|---|
| UC-020 | Validate a spec: references to sources exist, types are compatible, joins are consistent, required fields are filled. | All users | v1 |
| UC-021 | Submit a spec or part of it for review, then approve or reject it (Draft → In review → Approved), with comments. | PER-002, PER-003 | v1 |
| UC-022 | Keep the approval status in sync with Git. | PER-001 | v1 |
| UC-023 | See the history of a spec and the diff between two versions. | All users | v1 |

### 2.4 Producing outputs
| ID | Use case | Persona | Priority |
|---|---|---|---|
| UC-030 | Generate dbt models from an approved spec, **Snowflake dialect first**. | PER-001 | v1 |
| UC-031 | Generate dbt models for Databricks, BigQuery and PostgreSQL. | PER-001 | Later |
| UC-032 | Generate human-readable documentation (Markdown). | All | v1 |
| UC-033 | Export a target table as an ODCS data contract; import an ODCS contract. | PER-001, PER-102 | v1 |
| UC-034 | Run `atlas validate`, `generate`, `import` and `diff` in a CI pipeline, without the SaaS. | PER-001 | v1 |
| UC-035 | Visualize joins and lineage as a graph. | All | v1? |

### 2.5 Organization
| ID | Use case | Persona | Priority |
|---|---|---|---|
| UC-040 | Create an organization, invite members, assign roles. | PER-101, PER-103 | v1 |
| UC-041 | Work on several projects in one organization (one project in the free tier). | All | v1 |
| UC-042 | Sign in with SSO. | PER-101 | v1? |

## 3. Out of scope

The non-goals in `docs/00-vision.md` §8 also apply. In addition:

| ID | Out of scope | Note |
|---|---|---|
| OOS-001 | Reading, sampling or profiling customer data. | Connectors read the catalog only (principle "metadata only"). |
| OOS-002 | Running the generated code. | It runs in the customer's toolchain (dbt, warehouse, orchestrator). |
| OOS-003 | On-premise deployment. | Not in v1; may come later for large enterprises. |
| OOS-004 | ERP-specific connectors and dictionaries in v1. | Planned for v2 (UC-004). |
| OOS-005 | Generation targets other than dbt on Snowflake in v1. | Other warehouses later (UC-031). |
| OOS-006 | Source connectors other than PostgreSQL and SQL Server in v1. | |
| OOS-007 | UI in languages other than English at launch. | French and German next. The UI is internationalized from day one. |

## 4. Open questions
- Q-01: Are the AI assistant (UC-016), the lineage graph (UC-035) and SSO (UC-042) part of v1, or later?
- Q-02: Which roles exist in an organization (e.g. admin, editor, reviewer/steward, viewer)? To be defined in
  `docs/05-modules/administration.md`.
- Q-03: What is the unit of review: a whole spec, a target table, or a single column mapping?
- Q-04: How exactly does the in-app approval sync with Git? Options include a status stored in the YAML, a pull
  request per review, or both. This decision belongs in `docs/05-modules/review-approval.md` and an ADR.

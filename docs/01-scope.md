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

### 1.3 Operator
#### PER-201 — Platform operator
- **Who**: the Atlas company itself (founder, later its staff), through a superuser account.
- **Role**: grants license credits to customer organizations, processes account deletion requests, follows license
  usage and the customer relationship. Not a user of the product.
- **Sees**: licensing figures and the customer's contact details (see §2.6). **Never** customer content
  (`docs/00-vision.md` principle 8).

## 2. Use cases

Priority levels:

- **v1**: confirmed for the first release.
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
| UC-016 | Get AI suggestions for mappings, and accept or reject each one. | PER-002 | v1 |

### 2.3 Checking and approving
| ID | Use case | Persona | Priority |
|---|---|---|---|
| UC-020 | Validate a spec: references to sources exist, types are compatible, joins are consistent, required fields are filled. | All users | v1 |
| UC-021 | Submit for review, then approve or reject (Draft → In review → Approved), with comments. The unit of review can be a whole spec, a target table or a single column mapping. | PER-002, PER-003 | v1 |
| UC-022 | Keep the approval status in sync with Git. | PER-001 | v1 |
| UC-023 | See the history of a spec and the diff between two versions. | All users | v1 |

Review rules:
- Approving requires the **Approver** permission, given per project to Editors or Admins (the data steward,
  PER-003, is typically an Editor with this permission).
- A project can have several approvers, and any one of them can approve, so one absent person does not block a
  review. An Admin can grant the permission at any time.
- The author of a change cannot approve it, unless an Admin has given them the **Self-approval** permission.
- Review must not slow down creation: drafting and editing never wait for an approval.

### 2.4 Producing outputs
| ID | Use case | Persona | Priority |
|---|---|---|---|
| UC-030 | Generate dbt models from an approved spec, **Snowflake dialect first**. | PER-001 | v1 |
| UC-031 | Generate dbt models for Databricks, BigQuery and PostgreSQL. | PER-001 | Later |
| UC-032 | Generate human-readable documentation (Markdown). | All | v1 |
| UC-033 | Export a target table as an ODCS data contract; import an ODCS contract. | PER-001, PER-102 | v1 |
| UC-034 | Run `atlas validate`, `generate`, `import` and `diff` in a CI pipeline, without the SaaS. | PER-001 | v1 |
| UC-035 | Visualize joins and lineage as a graph. | All | v1 |

### 2.5 Organization (customer side)
Roles:

| Role | Can |
|---|---|
| **Admin** | Everything an Editor can do, plus manage user accounts, roles, the Approver permission and organization settings, and answer support access requests. |
| **Editor** | Create and edit specs, submit them for review; approve if given the Approver permission. |
| **Viewer** | Read only. |

| ID | Use case | Persona | Priority |
|---|---|---|---|
| UC-040 | See the license counter: credits granted, used and remaining. | Admin | v1 |
| UC-041 | Create a user account, which uses 1 credit; assign its role (Admin, Editor, Viewer) and the Approver permission. No account can be created without a remaining credit. | Admin | v1 |
| UC-042 | Sign in with SSO. | All users | v1 |
| UC-043 | Request the deletion of an account; the credit comes back once the operator has validated the request. | Admin | v1 |
| UC-044 | Work on several projects in one organization. | All users | v1 |
| UC-045 | Approve or refuse a support access request (see UC-053). | Admin | v1 |
| UC-046 | Suspend an account immediately (e.g. an employee leaves). The credit stays used until the account is deleted (UC-043). | Admin | v1 |

### 2.6 Control tower (operator side)
The control tower is a superuser area for PER-201, separated from customer content (ADR 0002). It shows only
information that is not private to the customer.

| ID | Use case | Priority |
|---|---|---|
| UC-050 | Create a customer organization and grant or change its license credits. There is no self sign-up. | v1 |
| UC-051 | See, per organization, the credits granted, the accounts created and the credits remaining. No names of projects, no user names or e-mails, no content. | v1 |
| UC-052 | See, per organization, the number of licenses waiting for deletion, and validate them; the credits go back to the organization. The operator never sees which accounts they are. | v1 |
| UC-053 | Request temporary support access to an organization's content. Access opens only after approval by a customer Admin, is limited in time, and every access is logged and visible to the customer. | v1 |
| UC-054 | Record and see the customer's contact details: contact person (referent), phone number. | v1 |
| UC-055 | See the support tickets raised by the customer. | Later (to confirm, Q-10) |

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
| OOS-008 | Any operator access to customer content outside the support access procedure (UC-053). | Principle 8 of `docs/00-vision.md`. |

## 4. Open questions

### 4.1 Resolved
- Q-01: The AI assistant (UC-016), the lineage graph (UC-035) and SSO (UC-042) are in v1.
- Q-02: Three roles: Admin, Editor, Viewer, plus an Approver permission per project (§2.5).
- Q-03: Review works at three levels: whole spec, target table, single column mapping (UC-021).
- Q-04: Approvals are synced with Git as described in ADR 0003.
- Q-05: An author cannot approve their own change, unless an Admin gives them the Self-approval permission.
- Q-06: Yes, a customer Admin can suspend an account immediately (UC-046).
- Q-07: No free tier in the SaaS (0 credits); prospects see a teaser on the website and a demonstration. No self
  sign-up: the operator creates organizations (UC-050).
- Q-08: One customer Admin approval is enough for support access, for now.
- Q-09: The deletion request is linked to the account on the customer side; the operator only sees a number of
  licenses to validate (UC-052).

### 4.2 Open
- Q-10: Support tickets in the control tower (UC-055): built into Atlas, or taken from an external help desk tool?
  When?
- Q-11: Which Git providers in v1? Proposal: GitHub and GitLab, then Azure DevOps and Bitbucket (ADR 0003).
- Q-12: Can a project work without a connected Git repository (history kept in Atlas only)?

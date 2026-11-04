# 00 — Vision

Status: Draft
Last updated: 2026-11-04

## 1. Problem

### 1.1 Where it comes from
Atlas starts from the founder's own experience as a data engineer with a business background: first-hand knowledge
of how the operational side of a company works, where its money is made, and now a role on the support side, in
large data projects. On those projects, one critical piece of work is done in **Excel** by everyone: the
**source-to-target mapping**. This spreadsheet says, for every column of every target table, where the data comes
from and how it is transformed.

### 1.2 What goes wrong with Excel
| # | Gap | What it looks like on a project |
|---|---|---|
| P-1 | **Reliability** | Nothing checks the content. Misspelled tables and columns, wrong types and impossible joins are only discovered when the code is built or tested. |
| P-2 | **Features** | Joins, type conversions and business rules are free text in a cell. Nothing can be reused, queried or generated from them. Copy and paste is the main tool. |
| P-3 | **Intelligence** | No suggestions, no detection of inconsistencies and no impact analysis when a source changes. |
| P-4 | **History** | No reliable record of who changed what, when and why. Versions travel by e-mail (`mapping_v12_final_FINAL.xlsx`). |
| P-5 | **Process** | Business validation of the rules happens in meetings and e-mails. Nobody can tell which version was approved. |
| P-6 | **Drift** | The spreadsheet and the code (SQL, dbt) diverge as soon as the build starts. The spreadsheet stops being the truth, but it is still used for documentation and testing. |

### 1.3 Consequences
- Rework and delays during build and testing (UAT).
- Knowledge is lost when consultants or team members leave.
- Projects are hard to audit: nobody can show why a figure is computed the way it is.
- Documentation is written twice, and is outdated as soon as it is written.

These problems get worse with the number of source systems. Migrations, multi-ERP consolidations and data platform
builds are exactly the projects where they cost the most.

## 2. Vision statement
Atlas makes the source-to-target specification **the reliable source of truth** of a data project:

- structured;
- validated;
- versioned in Git;
- approved by the business;
- turned directly into code and documentation.

Atlas does not import Excel mappings: a spec is written fresh in Atlas, the right way, rather than carrying over
the defects of the spreadsheet.

## 3. Ambitions

All figures below are **hypotheses** (`H-xx`), meant to frame the effort. They are not commitments and must be
revisited with real data at each roadmap milestone.

### 3.1 At 1 year
Qualitative milestones:
- The spec format, `packages/core` and the CLI are published as open source and usable without the SaaS.
- A v1 of the SaaS runs in production, hosted in the EU, covering the v1 use cases of `docs/01-scope.md`.
- A first real project has moved off Excel.
- The first consulting firms use Atlas on client projects.

Indicative figures:
| ID | Hypothesis |
|---|---|
| H-01 | 3 to 5 design partners, including at least 2 consulting firms. |
| H-02 | 10 to 20 paying organizations. |
| H-03 | Annual recurring revenue of €100k to €200k. |

### 3.2 At 3 years
Qualitative milestones:
- The Atlas format is a recognized way to write source-to-target specifications, used beyond the customer base and
  interoperable with ODCS.
- Atlas is the default tool of a network of partner consulting firms across the target markets.
- The paid layer has the full set of SaaS features: collaboration (real-time co-editing), review, AI assistant, Git
  integrations, ERP dictionaries, governance and SSO.

Indicative figures:
| ID | Hypothesis |
|---|---|
| H-04 | 150 to 300 paying organizations. |
| H-05 | Annual recurring revenue of €3M to €5M. |
| H-06 | 20 or more active partner consulting firms. |

## 4. Market
- **Geography**: Europe from launch: UK, DACH, Benelux, France and the Nordics.
- **Target customers**:
  - mid-market companies;
  - large enterprises;
  - data consulting firms and IT services companies.
- **Acquisition channel**: consulting firms. They run the migrations and the multi-ERP projects, and they bring Atlas
  to their clients.

## 5. Positioning

> Competitor descriptions are based on their public positioning as of November 2026 and have not been tested
> hands-on. They must be checked before any external use.

### 5.1 Summary
| Alternative | What it is | Where it falls short for our problem | Atlas's stance |
|---|---|---|---|
| **Excel** | The default tool for source-to-target mappings. | No validation, no structure, no history, no process (see 1.2). | **Replace**. No import of old spreadsheets: specs are rewritten in Atlas, guided and validated. |
| **erwin** (Quest) | Enterprise data modeling and data intelligence suite, including mapping management. | Complete but heavy and expensive. Long sales cycles, not Git-native, built for the enterprise first. | Lighter, Git-native, priced for mid-market companies and consulting firms. |
| **VaultSpeed** | Data warehouse automation that generates code from source metadata. | Tied to the Data Vault methodology. | Independent of the modeling method: any target model, starting with dbt. |
| **WhereScape** | Metadata-driven data warehouse automation (design, generation, operation). | A proprietary environment you build inside. Heavy to adopt for a single project. | A spec layer that generates into the team's own toolchain (dbt, Git, CI). |
| **dbt** | A framework for SQL transformations with tests and docs. | Starts at the code. The mapping and business rules end up buried in SQL; there is no structured spec before the build and no business approval. | **Complement**. Atlas generates dbt models: the spec comes first, dbt runs it. |
| **Catalogs** (Collibra, DataHub, OpenMetadata) | Discovery, governance and harvested lineage of existing assets. | They describe what exists after the build, not the design of new transformations. | **Complement**. Possible future integration: push specs and lineage to them. |
| **ODCS** (Bitol / Linux Foundation) | An open standard for data contracts: schema, quality, SLAs, ownership. | Describes the interface of a dataset, not how it is built from its sources. | **Interoperate**. Import/export ODCS; the Atlas format is richer. |
| **AI mapping agents** (phData Toolkit, Astera) | AI-assisted generation of mappings or pipelines. | Usually tied to their own platform or services. The result is not a governed, versioned and approved spec. | AI suggestions inside a governed spec, always **validated by a human**. |

### 5.2 Positioning statement
For data teams and consulting firms running data platform projects, **Atlas is the source-to-target specification
layer**. Mappings, joins, types and business rules are structured objects. Every change is validated, reviewed by
the business and versioned in Git, and the spec generates the dbt code and the documentation. Unlike modeling
suites and warehouse automation tools, Atlas is:

- **open** (open-source format and CLI);
- **lightweight** (fits the existing dbt and Git toolchain);
- **European** (EU-hosted, metadata only).

## 6. Product principles
1. **First-class objects**: joins, types, rules and multi-system provenance are structured objects, never free text.
2. **Git-native**: the spec is readable, diffable YAML; Git is the source of truth.
3. **Open format**: the spec format, `packages/core` and the CLI are open source. Adoption of the format is the moat.
4. **ODCS-compatible, not ODCS-dependent**: ODCS is an import/export format.
5. **Metadata only**: Atlas stores metadata only, **never customer data**. The Atlas service never connects to customer
   databases or source systems: sources are **specified**. Their metadata is entered by hand or imported from
   files the customer produces on its side (e.g. the result of a catalog query provided by Atlas).
6. **Human in the loop**: every AI suggestion must be accepted by a person before it enters the spec.
7. **European by design**: hosted in the EU, GDPR as a selling point.
8. **Customer confidentiality**: the Atlas operator (the company and its staff) never sees what customers do in
   Atlas: specs, sources, rules or Git repositories. The operator only sees licensing figures and its own
   commercial information about the customer (contact person). Support may access a customer's content only with
   the customer's explicit approval, granted by a customer Admin, for a limited time, and every access is logged
   (see ADR 0002).

## 7. Business model

### 7.1 Open core
| Open source (free) | SaaS (paid) |
|---|---|
| Spec format | Collaborative web interface, with real-time co-editing |
| `packages/core` (metamodel, validation, generators) | Review and approval workflow |
| CLI (`validate`, `generate`, `import`, `diff`) | AI assistant |
| | Git integrations (GitHub, GitLab) |
| | Governance |
| | SSO |

This is the model dbt uses: the open format drives adoption, and the SaaS sells collaboration and governance. The
open-source license is still open; it will be decided in a dedicated ADR.

### 7.2 Pricing
- **Per organization**, with tiers based on the number of licenses, priced in **euros**.
- **License credits**:
  - the customer asks for a number of licenses, and the operator grants the same number of credits (1 license =
    1 credit);
  - the customer's admins create user accounts themselves, and each account uses 1 credit; nobody signs in
    without an account, so nobody signs in without a license;
  - to get a credit back, the customer asks the operator to delete the account.
- **No free tier in the SaaS** (0 credits). What is free is the open-source part (format, core, CLI).
  Prospects discover the SaaS through a teaser on the website and a live demonstration.
- Customers do not sign up on their own: the operator creates the organization when it grants the first credits.
- Paid tiers, license ranges and prices will be defined later; they are not set in this document.
- **On-premise**: not in v1. It may be offered later to large enterprises.

## 8. Non-goals
| ID | Atlas is not… |
|---|---|
| NG-001 | An engine that executes or orchestrates pipelines. Generated code runs in the customer's own toolchain. |
| NG-002 | An ingestion or ETL tool. |
| NG-003 | A data catalog. |
| NG-004 | A data quality monitoring tool for production data. |
| NG-005 | A general-purpose conceptual data modeling tool. |
| NG-006 | A store of customer data. Atlas holds metadata only (see principle 6.5). |

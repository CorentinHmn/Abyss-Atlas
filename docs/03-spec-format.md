# 03 — Spec format

Status: Draft
Last updated: 2026-11-05

This document defines how the objects of `docs/02-metamodel.md` are written as YAML. Specs live in Atlas
(ADR 0007); YAML is the format of the **YAML view** of the editor and of the **project export**, which
`packages/core` reads. The metamodel is
authoritative for **concepts**; this document is authoritative for **spelling and layout**. Requirement
identifiers: `FMT-xxx`.

## 1. Principles
1. **Readable**: an analyst or a steward can read a file without training; the most frequent cases have a short
   form.
2. **Comparable**: one object per file, stable key order, so two versions or two exports compare line by line.
3. **Strict**: unknown keys are errors (except extensions, FMT-012); every reference is checked.
4. **Versioned**: every file declares the format version it is written in.
5. **Tooled**: a JSON Schema, generated from the Zod schemas of `packages/core`, gives autocompletion and inline
   errors in editors (VS Code YAML extension, Monaco in the SaaS).

## 2. General rules

### 2.1 Files
- FMT-001: Files use YAML 1.2, UTF-8, extension `.yaml`.
- FMT-002: Every file starts with two keys: `atlas` (format version, an integer, `1` today) and `kind` (`project`,
  `domain`, `system`, `dataset`, `model`, `rule`, `value_mapping`, `approvals`). The object's attributes follow at
  the top level.
- FMT-003: The file name is the object's id (`dim_customer.yaml` holds the model `dim_customer`), or its code for a
  domain (`SEL.yaml`). The folder must match the owner (system or domain code) declared in the file.

### 2.2 Naming
- FMT-010: Keys and enumerated values are written in `snake_case`, like dbt. Metamodel names convert directly:
  `targetPlatform` → `target_platform`, `union-all` → `union_all`, `many-to-one` → `many_to_one`,
  `mapValues` → `map_values`.
- FMT-011: A few keys are shortened for readability:

  | Metamodel | YAML |
  |---|---|
  | logicalType | `type` |
  | qualityChecks | `quality` |
  | column mappings of a target column | `from` (under the column, §4.3) |

- FMT-012: Keys starting with `x_` are extensions: kept as is, ignored by validation and generators. Customers can
  use them for their own annotations.

### 2.3 Values
- FMT-020: **No implicit YAML typing for literals.** YAML turns `NO` into `false` (Norway's country code) and `007`
  into `7`. Atlas reads every literal as text and converts it according to the expected logical type (the type of
  the column it is compared with, of the parameter, of the value mapping…). Editors warn on unquoted literals that
  YAML would reinterpret.
- FMT-021: `null` is a YAML keyword. Where the metamodel uses "null" as a behaviour, YAML spells it `set_null`
  (e.g. `on_error: set_null`).
- FMT-022: Logical types are written as text: `string`, `string(40)`, `integer`, `bigint`, `decimal(18,2)`,
  `float`, `boolean`, `date`, `time`, `timestamp`, `timestamp_tz`, `binary`, `json`.
- FMT-023: People are written as the e-mail of their Atlas account (MM-022).

### 2.4 References
- FMT-030: A source column is `system.dataset.COLUMN` (e.g. `sap_fr.kna1.KUNNR`); a dataset is `system.dataset`.
  A target model is `model_id`; a target column is `model_id.column`.
- FMT-031: Inside a branch, columns are written `alias.COLUMN` (e.g. `c.KUNNR`). Column names keep the case of the
  source.

### 2.5 Operands
An operand is a value used by a step or a condition.

| Form | Meaning |
|---|---|
| `c.KUNNR` (plain text) | A column, `alias.COLUMN`. |
| `current` | The value produced by the previous steps of the pipeline. |
| `{ value: "FR01" }` | A literal (FMT-020). |
| `{ param: blocked_flag }` | A parameter of the business rule being defined. |
| `{ calculate: { function: divide, args: [{ value: "1" }, current] } }` | One calculation whose arguments are operands without calculation (`docs/02-metamodel.md` §5.3). |

- FMT-040: Literals are only ever written with `value` (or `values`), so a literal can never be mistaken for a
  column.

## 3. Export layout
```
atlas.yaml                                   project
domains/<CODE>.yaml                          domains used by the project (copied from the organization, MM-026)
systems/<system>/system.yaml                 source systems
systems/<system>/datasets/<dataset>.yaml     source datasets (one file per table)
models/<CODE>/<model>.yaml                   target models, by domain code
rules/<CODE>/<rule>.yaml                     business rules
value-mappings/<CODE>/<mapping>.yaml         value mappings
approvals/…                                  approval records (§7), mirroring the paths above
```
- FMT-050: An export is an archive whose root holds `atlas.yaml`. The customer stores it where its own policy
  requires; Atlas never pushes it anywhere (ADR 0007).
- FMT-051: Generated code (dbt models, documentation) is a separate download, never mixed with these folders.

## 4. Objects

### 4.1 Context objects
**Project** (`atlas.yaml`)
```yaml
atlas: 1
kind: project
id: group_consolidation
name: Group consolidation 2027
target_platform: snowflake
defaults:
  materialization: table
```

**Domain** (`domains/SEL.yaml`). Domains belong to the organization (MM-025); an export carries a copy of the ones it uses.
```yaml
atlas: 1
kind: domain
code: SEL
name: Sales
description: Customers, orders, invoicing.
owner: anna.schmidt@example.com
stewards: [marc.dupont@example.com, lena.berg@example.com]
```

**System** (`systems/sap_fr/system.yaml`)
```yaml
atlas: 1
kind: system
id: sap_fr
name: SAP France
system_type: erp
product: SAP S/4HANA 2023
landing:                     # where raw data lands in the warehouse
  database: RAW
  schema: SAP_FR
```
- FMT-060: Because `kind` is reserved for the file kind, the metamodel attribute `kind` is written `system_type`
  for a system and `dataset_type` for a dataset.

**Source dataset** (`systems/sap_fr/datasets/kna1.yaml`)
```yaml
atlas: 1
kind: dataset
id: kna1
system: sap_fr
name: KNA1
dataset_type: table
description: Customer master, general data.
primary_key: [MANDT, KUNNR]
metadata_origin: { method: file_import, date: "2026-11-04" }
columns:
  MANDT: { native_type: CHAR(3),  type: string(3),  nullable: false, description: Client }
  KUNNR: { native_type: CHAR(10), type: string(10), nullable: false, description: Customer number }
  LAND1: { native_type: CHAR(3),  type: string(3),  description: Country key }
  STCEG: { native_type: CHAR(20), type: string(20), description: VAT registration number }
```
- FMT-061: Columns are a map keyed by column name; the order of the file is the display order.

### 4.2 Target model: header, branches, consolidation
A model file reads top to bottom like a mapping workbook: **what the table is**, **where rows come from**,
**how sources are combined**, then **column by column**.

```yaml
atlas: 1
kind: model
id: dim_customer
name: Customer
domain: SEL
description: One row per customer of the group, across all ERPs.
grain:
  description: One customer of the group.
  key: [customer_id]
layer: mart
materialization: table

branches:
  sap_fr:
    label: SAP France
    source_tag: SAP_FR
    datasets:                       # the first dataset drives the grain
      - c: sap_fr.kna1
      - s: sap_fr.knvv
    joins:
      - left: c
        right: s
        type: left
        condition:                  # full form; the short form is shown in branch `oracle`
          all:
            - { left: c.KUNNR, op: eq, right: s.KUNNR }
            - { left: s.VKORG, op: eq, value: "FR01" }
        cardinality: one_to_many
        description: Sales area data of the customer, French sales organization.
    filter: { left: c.KTOKD, op: in, values: ["0001", "0002"] }
    deduplicate:
      key: [c.KUNNR]
      order_by: [{ column: s.ERDAT, direction: desc }]
      keep: first

  sap_de:
    label: SAP Germany
    source_tag: SAP_DE
    datasets:
      - c: sap_de.kna1
    filter: { left: c.LOEVM, op: is_null }

  oracle:
    label: Oracle EBS
    source_tag: ORACLE
    datasets:
      - a: oracle.hz_cust_accounts
      - p: oracle.hz_parties
    joins:
      - left: a
        right: p
        type: inner
        condition: { a.PARTY_ID: p.PARTY_ID }    # short form: equality of key columns
        cardinality: many_to_one

consolidation:
  combine: union_all
  add_source_column: source_system
  match: [vat_number]
  survivorship:
    priority: [sap_fr, sap_de, oracle]
    columns:
      email: { strategy: first_not_null, priority: [oracle, sap_fr, sap_de] }
```
- FMT-070: `datasets` is a list, so the order (first = driving dataset) is explicit.
- FMT-071: `condition` accepts the short form (a map of equal columns, combined with "and") or a full condition (§5.3).
  The key is not called `on`: YAML 1.1 tools still in use read `on` as the boolean `true`.
- FMT-072: Survivorship strategies: `priority`, `first_not_null`, `most_recent` (with `by`), `rule` (with
  `rule`).
- FMT-073: A join with `cardinality: many_to_many` must also carry `confirmed: true` (MM-121).

### 4.3 Target model: columns and their mappings
Each column carries its meaning first, then `from`: one entry per branch.

```yaml
columns:
  customer_id:
    definition: Group-wide customer identifier.
    type: string(20)
    nullable: false
    key: true
    classification: internal
    from:
      sap_fr: c.KUNNR
      sap_de: c.KUNNR
      oracle: a.ACCOUNT_NUMBER

  country_code:
    definition: Country of the customer's head office, ISO 3166-1 alpha-2.
    type: string(2)
    nullable: false
    quality: [not_null, { accepted_values: { mapping: country_codes_oracle_to_iso } }]
    from:
      sap_fr: c.LAND1
      sap_de: c.LAND1
      oracle:
        inputs: [p.COUNTRY]
        steps:
          - map_values: { mapping: country_codes_oracle_to_iso, on_unmatched: fail }

  customer_status:
    definition: ACTIVE, BLOCKED or DELETED, from the blocking flags of the ERP.
    type: string(10)
    nullable: false
    from:
      "*":                          # every branch not listed explicitly
        steps:
          - rule:
              id: customer_status_from_flags
              args: { blocked_flag: c.AUFSD, deletion_flag: c.LOEVM }
      oracle:
        steps:
          - case:
              when:
                - if: { left: a.STATUS, op: eq, value: "I" }
                  then: { value: "BLOCKED" }
              else: { value: "ACTIVE" }

  credit_limit:
    definition: Credit limit granted to the customer, in EUR.
    type: decimal(15,2)
    nullable: true
    from:
      sap_fr: { not_provided: Held in the credit management module, phase 2. }
      sap_de: { not_provided: Held in the credit management module, phase 2. }
      oracle:
        steps:
          - lookup:
              dataset: oracle.hz_cust_profile_amts
              alias: k
              match: { k.CUST_ACCOUNT_ID: a.CUST_ACCOUNT_ID }
              return: k.OVERALL_CREDIT_LIMIT
              on_missing: set_null
          - convert: { to: decimal(15,2), method: cast, on_error: fail }
```
- FMT-080: Short forms of a mapping:
  - a column name (`sap_fr: c.KUNNR`) = direct copy;
  - `{ not_provided: reason }` = the branch cannot provide the column (MM-100).
- FMT-081: Full form: `inputs` (list of columns, optional) and `steps` (ordered list). With one input, the first
  step receives it as `current`.
- FMT-082: The key `"*"` gives the mapping of every branch not listed explicitly. After expansion, each branch has
  exactly one mapping (MM-100).
- FMT-083: A model's own checks are written under a top-level `quality` key (e.g. `unique_combination`).

## 5. Steps and conditions

### 5.1 Steps
Each step is a one-key map: the key is the step kind.

| Kind | Syntax |
|---|---|
| `copy` | `- copy` (only needed to make it explicit) |
| `constant` | `- constant: { value: "EUR" }` |
| `default` | `- default: { value: "N/A", also_empty: true }` |
| `convert` | `- convert: { to: date, method: parse, pattern: YYYYMMDD, on_error: set_null }` |
| `map_values` | `- map_values: { mapping: <value_mapping_id>, on_unmatched: keep \| set_null \| use_default \| fail }` |
| `case` | `- case: { when: [ { if: <condition>, then: <operand> }, … ], else: <operand> }` |
| `calculate` | `- calculate: { function: round, args: [current, { value: "2" }] }` |
| `concat` | `- concat: { parts: [c.NAME1, { value: " " }, c.NAME2] }` |
| `lookup` | `- lookup: { dataset, alias, match, return, on_missing }` |
| `aggregate` | `- aggregate: sum` |
| `rule` | `- rule: { id: <rule_id>, args: { <param>: <operand>, … } }` |
| `sql` | `- sql: { expression: "...", reason: "..." }` |

### 5.2 Conditions
| Form | Example |
|---|---|
| Comparison with a literal | `{ left: s.VKORG, op: eq, value: "FR01" }` |
| Comparison with a list | `{ left: c.KTOKD, op: in, values: ["0001", "0002"] }` |
| Comparison between columns | `{ left: c.KUNNR, op: eq, right: s.KUNNR }` |
| Unary | `{ left: c.LOEVM, op: is_null }` |
| Groups | `{ all: [<condition>, …] }`, `{ any: [ … ] }`, `{ not: <condition> }` |
| Escape hatch | `{ sql: "...", reason: "..." }` |

- FMT-090: Operators: `eq`, `ne`, `lt`, `le`, `gt`, `ge`, `in`, `not_in`, `between` (two `values`), `like`,
  `is_null`, `is_not_null`.

### 5.3 Escape hatch
- FMT-100: In a `sql` expression, columns are written with the branch aliases (`c.KUNNR`) and the pipeline value
  as `{{ current }}`. The expression is copied into the generated code for the project's target platform.
- FMT-101: `reason` is mandatory (MM-210).

### 5.4 Quality checks
`not_null`, `unique` (short forms), `{ accepted_values: { values: [...] } }` or `{ accepted_values: { mapping: id } }`,
`{ relationship: { to: model.column } }`, `{ unique_combination: { columns: [...] } }`. Any of them can take
`severity: warn` (default `error`), e.g. `{ not_null: { severity: warn } }`.

## 6. Reusable logic

**Business rule** (`rules/SEL/customer_status_from_flags.yaml`)
```yaml
atlas: 1
kind: rule
id: customer_status_from_flags
name: Customer status from blocking flags
domain: SEL
statement: >
  A customer flagged for deletion is DELETED. Otherwise, a customer with an order block is BLOCKED.
  Otherwise the customer is ACTIVE.
parameters:
  blocked_flag: string(2)
  deletion_flag: string(1)
returns: string(10)
logic:
  - case:
      when:
        - if: { left: { param: deletion_flag }, op: eq, value: "X" }
          then: { value: "DELETED" }
        - if: { left: { param: blocked_flag }, op: is_not_null }
          then: { value: "BLOCKED" }
      else: { value: "ACTIVE" }
```

**Value mapping** (`value-mappings/SEL/country_codes_oracle_to_iso.yaml`)
```yaml
atlas: 1
kind: value_mapping
id: country_codes_oracle_to_iso
name: Oracle country codes to ISO 3166-1 alpha-2
domain: SEL
from_type: string(3)
to_type: string(2)
entries:
  "FRA": "FR"
  "DEU": "DE"
  "NOR": "NO"
```
- FMT-110: `entries` is a map, so duplicate source values are impossible (MM-311). At most 1,000 entries
  (MM-310); beyond that, `reference: { dataset: <ref>, key: <column>, value: <column> }`.
- FMT-111: Entries are only written in YAML: no side files (CSV or other).

## 7. Approvals in an export
Approvals live in Atlas's approval log (ADR 0007). An export includes them under `approvals/`, mirroring the path
of the file they concern, so the CLI can tell which units are approved.

```yaml
# approvals/models/SEL/dim_customer.yaml
atlas: 1
kind: approvals
of: models/SEL/dim_customer.yaml
model:
  decision: approved
  by: marc.dupont@example.com
  at: "2026-11-04T10:12:00Z"
  hash: sha256:9f2c…
  log_id: apv_01JC…
columns:
  country_code:
    decision: approved
    by: lena.berg@example.com
    at: "2026-11-03T16:40:00Z"
    hash: sha256:41aa…
    log_id: apv_01JB…
```
- FMT-120: An export keeps only the latest record per unit; the full history stays in Atlas's approval log.
- FMT-121: `log_id` points to the entry of the Atlas approval log. If an export is ever read back into Atlas, a
  record without a matching entry is ignored: approvals can only be given in Atlas.
- FMT-122: `hash` is the SHA-256 of the canonical form of the unit: the object serialized as JSON with RFC 8785
  (JSON Canonicalization Scheme), after expansion of short forms. Per MM-700 it includes the hashes of the rules
  and value mappings used; for a column mapping, it also includes the definition of the branches it maps from
  (datasets, joins, filter, deduplication, grouping).
- FMT-123: The project-level approval is in `approvals/project.yaml`.

## 8. Correspondence with ODCS
Atlas exports and imports ODCS (Open Data Contract Standard) **v3**; the exact minor version is fixed at
implementation time. Field names below must be checked against that version.

### 8.1 Export: one contract per target model
| Atlas | ODCS |
|---|---|
| model `id`, `name`, `description` | contract `id`, `name`, `description.purpose`; one `schema` object (`physicalType: table`) |
| `grain` | schema `dataGranularityDescription` |
| `domain` | `domain` |
| domain owner and stewards | `team` (with their role) |
| column `definition` | property `description` |
| column `type` | property `logicalType` (`string`, `integer`, `number`, `boolean`, `date`, `object`) and `physicalType` (type on the target platform) |
| `nullable: false` | `required: true` |
| `key` | `primaryKey: true` + `primaryKeyPosition` |
| `classification` | `classification` |
| quality checks | `quality` rules (library rules where ODCS has an equivalent, otherwise `sql`) |
| sources of the column, all branches | `transformSourceObjects` |
| generated expression | `transformLogic` |
| plain-language summary of branches, steps and rules | `transformDescription` |
| effective approval status | contract `status` (`draft`, `proposed`, `active`) |
| Atlas ids | `customProperties` (`atlas_id`), for round trips |

- FMT-130: What ODCS cannot hold is flattened or summarized: branches, consolidation, structured steps, business
  rules and approval records. **The Atlas files remain the source of truth**; an ODCS export is an output.

### 8.2 Import
- FMT-140: Importing an ODCS contract creates target models with their columns (definition, type, nullable, key,
  classification) and quality checks. It creates **no branch and no mapping**: validation then lists every column
  still to be mapped.

## 9. Format evolution
- FMT-150: Adding an optional key does not change the format version.
- FMT-151: Any change that can break existing files increases `atlas` (2, 3…). Atlas reads the current version and
  the previous one, and provides an automatic upgrade of the files (a CLI command to add when version 2 exists).
- FMT-152: A JSON Schema is maintained per format version.

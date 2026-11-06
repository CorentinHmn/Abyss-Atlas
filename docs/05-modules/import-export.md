# 05.05 — Module: Import / export

Status: Draft
Last updated: 2026-11-05

What enters and leaves Atlas as files. Atlas never connects to a customer system (OOS-006) and never imports
Excel mappings (OOS-009). Requirement identifiers: `IE-xxx`.

## 1. Source metadata: dictionary files (UC-001, UC-003)

### 1.1 Dictionary CSV
One row per source column:

| Column | Required | Content |
|---|---|---|
| `dataset` | yes | Table name as in the source (e.g. `KNA1`) |
| `column` | yes | Column name (case kept) |
| `native_type` | yes | Type as declared in the source (e.g. `CHAR(10)`, `varchar(40)`, `numeric(15,2)`) |
| `nullable` | no | `true` / `false` (also `YES` / `NO`, `Y` / `N`) |
| `primary_key_position` | no | 1, 2… for the columns of the primary key |
| `description` | no | Column description |
| `dataset_description` | no | Table description (read from the first row of the table) |
| `namespace` | no | Schema or database of the table in the source |

- IE-001: Files are UTF-8 (a byte-order mark is accepted). The separator is detected: `,` or `;` (European Excel
  uses `;`). In Atlas, the same table may also come as an Excel `.xlsx` sheet (SRC-021).
- IE-002: The import targets one system, given by the user; the dataset id is the table name in lowercase, made
  valid for MM-600.
- IE-003: The logical type is derived from the native type with the dialect chosen by the user (§1.3); a type that
  cannot be derived is imported as `string` and reported, so that the user fixes it.
- IE-004: Re-importing a dictionary updates existing datasets: new columns are added, changed types are updated,
  descriptions written in Atlas are kept, and columns missing from the file are reported, never deleted silently.
- IE-005: The import never reads data: only the dictionary file (OOS-001).

### 1.2 Catalog queries (UC-003)
Atlas provides one read-only query per database engine. The customer runs it with its own tools and access and
saves the result as the dictionary CSV of §1.1.

- IE-010: Queries are provided for **PostgreSQL** and **SQL Server**, in `packages/core/src/import/catalog-queries.ts`, shown in Atlas next to the import (SRC-020). They only
  read the catalog (`information_schema` and system views).
- IE-011: Their output columns are exactly those of §1.1, in that order.

### 1.3 Native type dialects
| Dialect | Examples of native types → logical types |
|---|---|
| `postgresql` | `varchar(n)`/`character varying(n)` → `string(n)`, `text` → `string`, `integer` → `integer`, `bigint` → `bigint`, `numeric(p,s)` → `decimal(p,s)`, `timestamp with time zone` → `timestamp_tz` |
| `sqlserver` | `nvarchar(n)`/`varchar(n)` → `string(n)`, `int` → `integer`, `bigint` → `bigint`, `decimal(p,s)` → `decimal(p,s)`, `datetime2` → `timestamp`, `bit` → `boolean` |
| `sap` | `CHAR(n)`, `NUMC(n)` → `string(n)`; `DATS` → `string(8)`; `QUAN(p,s)`, `CURR(p,s)`, `DEC(p,s)` → `decimal(p,s)`; `INT4` → `integer` |
| `oracle` | `VARCHAR2(n)` → `string(n)`, `NUMBER(p)` → `bigint` or `decimal(p,0)`, `NUMBER(p,s)` → `decimal(p,s)`, `NUMBER` → `decimal(38,10)`, `DATE` → `timestamp` |

- IE-012: SAP `DATS` and `NUMC` are kept as text on purpose: converting them is a mapping decision, flagged by
  VAL-044.

## 2. Project export (UC-036)
- IE-020: A project is exported as a zip archive in the export layout (FMT-050), with approval records (§7 of the
  format) and the domains it uses (MM-026).
- IE-021: The internal CLI works on an extracted export (RM-031 compares its output with the downloads).

## 3. Generated outputs (UC-030, UC-032)
- IE-030: dbt and documentation are downloaded as zip archives; see `docs/05-modules/generation.md`.

## 4. ODCS (UC-033, P3)
Export and import as described in `docs/03-spec-format.md` §8.

## 5. CLI commands (internal tool, ADR 0009)
| Command | Effect |
|---|---|
| `atlas validate [dir]` | Validates the project; exit code 1 when there is an error. |
| `atlas generate dbt [dir] --out <dir>` | Writes the dbt project (refused when validation has errors). |
| `atlas generate docs [dir] --out <dir>` | Writes the Markdown documentation. |
| `atlas import dictionary <file.csv> --system <id> --dialect <dialect> [dir]` | Creates or updates dataset files. |
| `atlas diff <dir-a> <dir-b>` | Lists the objects added, removed and changed, attribute by attribute. |

- IE-040: Every command works offline, without an account (ADR 0001 §4.3).

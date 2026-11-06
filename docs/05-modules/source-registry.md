# 05.01 — Module: Source registry

Status: Draft
Last updated: 2026-11-05

The description of the source systems a project reads: systems, their datasets (tables, views, files) and columns,
with types and keys. It is **metadata only**: Atlas never connects to a source and never reads data (OOS-001,
OOS-006). Objects: `docs/02-metamodel.md` §3.3–3.4. File import: `docs/05-modules/import-export.md` §1.
Screens: SCR-030, SCR-031, SCR-032 (`docs/06-ux/navigation-menus.md`). Requirement identifiers: `SRC-xxx`.

Phase: P2 (UC-001, UC-002, UC-003 in the browser). Decisions are in §7. Storage: ADR 0011.

Implementation status (2026-11-06): §1–§3 and §5 are in the app. The "used / not used" filter and "where used"
(SRC-010, SRC-030) wait for the mapping editor, which creates the uses.

## 1. Systems (UC-002)
- SRC-001: Editors and Admins create a system: id (e.g. `sap_fr`, MM-600), name, kind, product, description, and
  its **landing location** in the warehouse (database, schema, naming pattern), needed to generate code.
- SRC-002: The id of a system cannot be changed once datasets exist (references use it, MM-600); its name can.
- SRC-003: Deleting a system deletes its datasets. It asks for confirmation and lists the models that use it
  (§4).
- SRC-004: The sources screen lists the systems with their number of datasets and of models using them.
- SRC-005: An action copies systems and their datasets from another project of the organization into this one
  (Q-SRC-02); the copies are then independent.

## 2. Datasets and columns (UC-002)
- SRC-010: Each system lists its datasets with search (name, description, column name) and a filter "used by a
  model / not used". Lists stay fast up to 20,000 datasets per project (ARC-300).
- SRC-011: Editors and Admins create a dataset by hand: name as in the source, kind, namespace, description,
  landing name if it differs from the pattern (MM §3.4). Its origin is `manual`.
- SRC-012: Columns are edited in a grid: name, native type, logical type, nullable, primary-key position,
  description. Keyboard navigation as in a spreadsheet.
- SRC-013: When a native type is typed, the logical type is derived with the system's dialect (IE §1.3); the user
  can override it. A column whose type is unknown is flagged.
- SRC-014: Rows copied from a spreadsheet (same columns as the dictionary file, IE §1.1) can be pasted into the grid.
- SRC-015: The primary key is the ordered set of columns with a key position; it feeds the join and lookup checks
  (VAL-033, VAL-034).
- SRC-016: Viewers read everything and change nothing.

## 3. Import of a dictionary file (UC-001, UC-003)
- SRC-020: The import screen (SCR-032) shows the **catalog queries** for PostgreSQL and SQL Server, ready to copy,
  with a one-line instruction: run it with your own tools and access, save the result as CSV, import it here
  (IE-010). Atlas never runs them.
- SRC-021: The user chooses the system, the dialect (`postgresql`, `sqlserver`, `sap`, `oracle`) and the file: CSV,
  or Excel `.xlsx` (first sheet, or a sheet the user picks, same columns; Q-SRC-01). The file is read **in the browser** (IE-001…IE-005); only the resulting metadata is saved.
- SRC-022: Before anything is saved, a **preview** lists: datasets to create, datasets to update (columns added,
  types changed), columns present in Atlas but missing from the file (kept, IE-004), and types that could not be
  translated (imported as `string`, IE-003). The user confirms or cancels.
- SRC-023: Re-importing the same dictionary later updates the datasets as in IE-004: descriptions written in Atlas
  are kept, nothing is deleted silently.
- SRC-024: The import is one change in the history (UC-023): it can be compared and undone like any other.
- SRC-025: Files up to 20 MB (about 200,000 columns) are accepted.

## 4. Where used
- SRC-030: Each dataset and each column shows the models, rules and lookups that use it, with links.
- SRC-031: Deleting a dataset or a column that is used asks for confirmation and lists the uses; validation then
  reports the broken references (MM-040). Editing is never blocked by validation (ARC-013).
- SRC-032: Changing a column's type re-validates every mapping that uses it at once (MM-040).

## 5. Validation shown in the registry
- SRC-040: Errors and warnings about sources (unknown types, duplicate column names, key columns that do not exist,
  missing landing location) are shown next to the object, with their code (`docs/05-modules/validation.md`).

## 6. Permissions
| Action | Viewer | Editor | Admin |
|---|---|---|---|
| Read systems, datasets, columns, where used | yes | yes | yes |
| Create, change, delete; import a dictionary | no | yes | yes |

## 7. Decisions (2026-11-06)
- Q-SRC-01: Dictionary files may be CSV or Excel `.xlsx` (SRC-021). This is only a dictionary of source columns, not
  an import of Excel mappings (OOS-009).
- Q-SRC-02: Sources belong to a project (MM-010); systems and datasets can be copied from another project (SRC-005).
- Q-SRC-03: A column used by mappings can be deleted after a confirmation that lists its uses (SRC-031).

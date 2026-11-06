# 05.02 — Module: Mapping editor

Status: Draft
Last updated: 2026-11-06

Where target models, their branches, joins, column mappings and consolidation are written, together with business
rules and value mappings. Everything is a **structured object** (`docs/02-metamodel.md` §4–6), edited through forms,
and also through a YAML view of the same object. Screens: SCR-020, SCR-021, SCR-022, SCR-040, SCR-041
(`docs/06-ux/navigation-menus.md`). Requirement identifiers: `MAP-xxx`.

Phase: P2 (UC-011…UC-015), single user in practice; real-time co-editing with presence comes in P3 (UC-017,
ADR 0005). Decisions are in §10.

## 1. Principles
- MAP-001: **Forms first**: every attribute of the metamodel has a field; nobody needs to write YAML or SQL. The
  YAML view (§7) is an alternative for those who prefer text.
- MAP-002: **One document per object** (model, rule, value mapping): forms and YAML view edit the same document,
  behind one layer of the editor (`useSpecDocument`). In P2 this layer keeps the object in the browser and saves it
  automatically through `apps/web` (RM-006); in P3 the co-editing document of ADR 0005 (Yjs, worker) replaces it
  behind the same layer, without changing the screens (Q-MAP-04).
- MAP-003: **Never blocked by validation** (ARC-013): incomplete or invalid content is saved as it is; problems are
  shown, not enforced.
- MAP-004: **Types everywhere**: every column, operand and step shows its logical type; the type after each step is
  inferred and shown (MM-200).
- MAP-005: **Pick, don't type**: source columns, datasets, rules, value mappings, domains and functions are chosen
  from lists filtered by what is valid at that place, with search; free typing is only for names, texts and literals.
- MAP-006: Viewers see every screen read only.

## 2. Models list (SCR-020)
- MAP-010: Models are listed by domain, with their branches, number of columns, completeness (mapped cells / all
  cells) and validation status (errors, warnings).
- MAP-011: Filters: domain, layer, status (errors, warnings, incomplete), text search on names and definitions.
- MAP-012: **New model**: id, name, domain (active domains only, ADM-052), description, grain. Two ways to start:
  empty, or **from a source dataset** (its columns become target columns with their types, and a first branch with
  copy mappings), see Q-MAP-02.

## 3. Model editor (SCR-021)
```
┌ dim_customer · SEL Sales · mart · table ─────────────── 2 errors · 3 warnings ┐
│ [Overview] [Columns] [Branches] [Mappings] [Consolidation] [Checks] [YAML] [SQL]│
├────────────────────────────────────────────────────────────┬──────────────────┤
│                                                            │ Problems         │
│                     tab content                            │  VAL-021 …       │
│                                                            │  VAL-044 …       │
└────────────────────────────────────────────────────────────┴──────────────────┘
```
- MAP-020: **Overview**: name, domain, description, grain (text and key columns), layer, materialization, tags.
- MAP-021: **Columns** (the target contract, written first): a grid of name, definition, logical type, nullable, key,
  classification, tags; keyboard navigation and reordering; pasting rows from a spreadsheet.
- MAP-022: **Branches**: one card per branch with its id, label, source tag, dataset uses (dataset or another model,
  with alias; the first one drives the grain), joins (§4), filter (condition builder, §5.3), deduplication and
  grouping.
- MAP-023: **Mappings**: a matrix with one row per target column and one column per branch. Each cell shows a
  one-line summary (e.g. `p.COUNTRY → map_values country_codes_oracle_to_iso`) and its state: mapped, not provided
  (with its reason), empty, error, warning, unstructured (`sql`). Opening a cell opens the column mapping panel
  (§5). Empty cells are counted in the model's completeness (MM-100).
- MAP-024: **Consolidation** (with 2 branches or more): combine mode, source column, match columns, branch priority
  (drag to reorder) and per-column survivorship (MM-130…MM-133).
- MAP-025: **Checks**: quality checks of the model and its columns (§8 of the metamodel); the automatic checks of the
  grain key are listed, not editable (MM-101).
- MAP-026: **SQL**: read-only preview of the generated dbt model for this model (ARC-030), refreshed after each change
  when the model has no validation error; otherwise the errors are listed instead.
- MAP-027: The **Problems** panel lists the model's validation issues with their code; clicking one goes to the field.
  The same issues are marked on the fields themselves.

## 4. Joins
- MAP-030: A join is edited as a form: left and right dataset uses, type, condition, cardinality, `confirmed` for
  many-to-many, description in business words.
- MAP-031: The condition builder proposes equalities between key columns of the two datasets, with their types;
  pairs of incompatible types are refused at once (MM-120).
- MAP-032: The checks on joins are shown next to the join: many-to-many not confirmed (VAL-031), cardinality versus
  declared keys (VAL-033), types (VAL-032).
- MAP-033: A diagram of the branch's datasets and joins is in P3, with lineage (UC-035).

## 5. Column mapping panel (SCR-022)
- MAP-040: The panel shows one target column (definition, type, nullable) and, side by side, its mapping in every
  branch, so that branches can be compared.
- MAP-041: In one branch, the user picks the **inputs** among the columns of the branch's datasets (alias, name,
  type, description), or marks the column **not provided** with a mandatory reason (MM-100).
- MAP-042: The **steps** form a vertical pipeline: add a step from the list of kinds (§5.2 of the metamodel), reorder
  by dragging, remove. Each step has its own small form; the inferred type appears after each step, and the last type
  is compared with the target type (MM-200).
- MAP-043: Each step form offers only what is valid there: the value mappings whose `from` type fits, the rules whose
  parameters fit, the catalog functions with their signatures, the datasets that can be looked up.
- MAP-044: **Conditions** (`case`, `lookup`, filters) use one builder: operand, operator, operand(s); groups `all`,
  `any`, `not`; operands are columns, `current`, typed literals, rule parameters or one calculation (§5.3).
- MAP-045: The **`sql` escape hatch** is a step like the others, with a mandatory reason; it is shown in a distinct
  style everywhere as **unstructured** (MM-211), and counted in the project's share of unstructured logic (MM-212).
- MAP-046: "Copy to other branches" copies a branch's mapping into the other branches when their datasets have
  columns of the same names, for the user to adjust.

## 6. Business rules (SCR-040) and value mappings (SCR-041)
- MAP-050: **Rules**: list by domain with where used; the editor has name, domain, statement in business words,
  typed parameters, logic (the same pipeline as §5, on the parameters) and return type (§6.1 of the metamodel).
- MAP-051: A rule shows every column mapping that uses it; changing its parameters marks those uses that no longer
  fit (validation).
- MAP-052: **Value mappings**: name, domain, from and to types, default, and either inline entries (grid, pasting
  from a spreadsheet, at most 1,000, unique `from` values: MM-310, MM-311) or a reference dataset with its key and
  value columns.

## 7. YAML view
- MAP-060: Each object has a YAML tab (Monaco), in the format of `docs/03-spec-format.md`, showing exactly the file of
  the project export.
- MAP-061: Edits in the YAML view are applied to the document as structured changes **as soon as the YAML parses**
  (ADR 0005 §3.3); while it does not, the view shows the parsing error and the forms keep the last valid state.
- MAP-062: Schema errors are shown in the YAML view with the same codes as the forms (`docs/05-modules/validation.md`).
- MAP-063: Read only for Viewers.

## 8. Saving, validation, history
- MAP-070: **No save button**: every change is saved automatically within a few seconds (Q-MAP-01); the screen shows
  "Saved" or "Saving…", and warns when the connection is lost (changes kept in the browser until it comes back).
- MAP-071: Validation runs **in the browser** on every change (Web Worker, under 200 ms per model, ARC-010, ARC-302);
  the server re-validates what is saved and its result is the reference (ARC-011).
- MAP-072: Undo and redo work per user and per object (Q-MAP-03).
- MAP-073: Each burst of changes becomes a version in the history (`docs/05-modules/versioning.md`, ARC-023).
- MAP-074: Opening a model of 200 columns takes under 1 second (ARC-304).

## 9. Permissions
| Action | Viewer | Editor | Admin |
|---|---|---|---|
| Read models, rules, value mappings, YAML and SQL previews | yes | yes | yes |
| Create, change, delete them | no | yes | yes |

## 10. Decisions (2026-11-06)
- Q-MAP-01: Changes are saved automatically, without a save button (MAP-070); the history gives the way back.
- Q-MAP-02: Both starting helpers are in P2: new model from a source dataset (MAP-012) and copy to other branches
  (MAP-046). They are deterministic and always confirmed by the user; AI suggestions stay in v1.1.
- Q-MAP-03: Each person undoes only their own changes, object by object (MAP-072).
- Q-MAP-04: No co-editing document in P2: the editor works on a plain object with automatic saving; Yjs and the
  worker come in P3 behind the same layer (MAP-002, ADR 0005 §5).

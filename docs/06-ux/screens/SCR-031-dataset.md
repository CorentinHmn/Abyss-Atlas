# SCR-031 — Dataset

Status: Draft
Last updated: 2026-11-06

| Address | Who | Phase | Requirements |
|---|---|---|---|
| `/p/<project>/sources/<system>/<dataset>` | members | P2 | SRC-010…SRC-032 |

## 1. Purpose
Describe one source table: columns, types, keys.

## 2. Content
- Header: name, kind, namespace, landing name, origin and date (manual or import), description.
- Column grid: name, native type, logical type, nullable, key position, description (SRC-012).
- Where used: models, rules, lookups (SRC-030).

## 3. Actions
- Edit in the grid, paste rows from a spreadsheet (SRC-014), delete a column (uses listed, SRC-031).

## 4. States and errors
- Unknown native type: the cell is marked and the logical type must be chosen (SRC-013).
- Common rules: `docs/06-ux/screens/README.md` §2.

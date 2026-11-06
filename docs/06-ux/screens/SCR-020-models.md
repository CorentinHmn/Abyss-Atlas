# SCR-020 — Models list

Status: Draft
Last updated: 2026-11-06

| Address | Who | Phase | Requirements |
|---|---|---|---|
| `/p/<project>/models` | members | P2 | MAP-010…MAP-012 |

## 1. Purpose
List the target models of the project and create new ones.

## 2. Content
- Models grouped by domain: name, layer, branches, columns, completeness, errors and warnings (MAP-010).
- Filters: domain, layer, status, text (MAP-011).

## 3. Actions
- **New model** (Editors, Admins): empty or from a source dataset (MAP-012).
- Delete a model (confirmation lists the models that read it, MM-111).

## 4. States and errors
- No model: explanation and **New model**; when the project has no sources yet, a link to SCR-030 first.
- Common rules: `docs/06-ux/screens/README.md` §2.

# SCR-060 — Downloads

Status: Draft
Last updated: 2026-11-06

| Address | Who | Phase | Requirements |
|---|---|---|---|
| `/p/<project>/downloads` | members | P2 | GEN-001, IE-020, IE-030, VER-032 |

## 1. Purpose
Take the project's outputs away: dbt project, documentation, full export.

## 2. Content
- Version picker: current state or a named version (VER-032).
- Three downloads: dbt project (Snowflake), Markdown documentation, full export in YAML (UC-030, UC-032, UC-036). ODCS contracts come in P3 (UC-033).

## 3. Actions
- **Download** each archive.

## 4. States and errors
- Validation errors: the dbt project and the documentation cannot be generated (GEN-001); the errors are listed with links. The export is always available.
- Common rules: `docs/06-ux/screens/README.md` §2.

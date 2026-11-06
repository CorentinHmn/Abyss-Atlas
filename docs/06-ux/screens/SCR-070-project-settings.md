# SCR-070 — Project settings

Status: Draft
Last updated: 2026-11-06

| Address | Who | Phase | Requirements |
|---|---|---|---|
| `/p/<project>/settings` | Editors, Admins (delete: Admins) | P2 | ADM-040…ADM-042 |

## 1. Purpose
Rename, describe, archive or delete a project.

## 2. Content
- Name, description, target platform (Snowflake in v1), project defaults (MM §3.1).

## 3. Actions
- Save; **Archive** / restore from archive (ADM-042); **Delete** (Admins): export offered first, then the project's name to type (ADM-041).

## 4. States and errors
- Delete refused while the typed name differs.
- Common rules: `docs/06-ux/screens/README.md` §2.

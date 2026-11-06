# SCR-040 — Business rules

Status: Draft
Last updated: 2026-11-06

| Address | Who | Phase | Requirements |
|---|---|---|---|
| `/p/<project>/rules[/<rule>]` | members (Viewers read only) | P2 | MAP-050, MAP-051 |

## 1. Purpose
List and write the reusable business rules of the project.

## 2. Content
- List by domain: name, statement, number of uses, status.
- Editor: name, domain, statement, parameters, logic pipeline, return type, where used (MAP-050, MAP-051), YAML tab.

## 3. Actions
- New rule, edit, delete (uses listed first).

## 4. States and errors
- Rule used by mappings that no longer fit after a change: those uses are listed as problems (MAP-051).
- Common rules: `docs/06-ux/screens/README.md` §2.

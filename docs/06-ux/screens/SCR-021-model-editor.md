# SCR-021 — Model editor

Status: Draft
Last updated: 2026-11-06

| Address | Who | Phase | Requirements |
|---|---|---|---|
| `/p/<project>/models/<model>` | members (Viewers read only) | P2 | MAP-020…MAP-074 |

## 1. Purpose
Write one target model completely: contract, branches, joins, mappings, consolidation, checks.

## 2. Content
- Header: name, domain, layer, materialization, problem counts, save state (MAP-070).
- Tabs: Overview, Columns, Branches, Mappings, Consolidation, Checks, YAML, SQL (MAP-020…MAP-026, MAP-060).
- Problems panel on the right, collapsible (MAP-027).

## 3. Actions
- Edit any field; open a mapping cell (SCR-022); undo and redo (MAP-072); open the model's history (VER-012).

## 4. States and errors
- Model with errors: the SQL tab lists them instead of the code (MAP-026).
- Connection lost: banner, changes kept in the browser (MAP-070).
- Viewer: same screen, fields read only (MAP-006).
- Common rules: `docs/06-ux/screens/README.md` §2.

# SCR-050 — History

Status: Draft
Last updated: 2026-11-06

| Address | Who | Phase | Requirements |
|---|---|---|---|
| `/p/<project>/history` | members (restore: Editors, Admins) | P2 | VER-001…VER-051 |

## 1. Purpose
Follow who changed what, compare versions, create named versions, restore.

## 2. Content
- Timeline of bursts of changes, newest first, with filters (VER-010, VER-011).
- Named versions (VER-030).
- Comparison view: structured changes, YAML side by side (VER-020…VER-022).

## 3. Actions
- Compare two versions; **Create a named version**; **Restore** an object or the whole project to a named version (VER-040, VER-041), with the list of changes before confirming.

## 4. States and errors
- Restore that breaks references: the problems are shown after the restore (VER-042).
- Common rules: `docs/06-ux/screens/README.md` §2.

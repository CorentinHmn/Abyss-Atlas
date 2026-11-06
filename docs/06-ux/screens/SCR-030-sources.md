# SCR-030 — Sources

Status: Draft
Last updated: 2026-11-06

| Address | Who | Phase | Requirements |
|---|---|---|---|
| `/p/<project>/sources` | members | P2 | SRC-001…SRC-016 |

## 1. Purpose
See and manage the systems of the project and their datasets.

## 2. Content
- Systems: name, kind, product, landing location, number of datasets, models using them (SRC-004).
- For the selected system: its datasets with search and the "used / not used" filter (SRC-010).

## 3. Actions
- **New system**, **New dataset**, **Import a dictionary** (SCR-032), **Copy from another project** (SRC-005) — Editors, Admins.
- Delete a system or a dataset (uses listed, SRC-003, SRC-031).

## 4. States and errors
- No system: explanation of what a system is and the two ways to add sources (by hand, by import).
- Common rules: `docs/06-ux/screens/README.md` §2.

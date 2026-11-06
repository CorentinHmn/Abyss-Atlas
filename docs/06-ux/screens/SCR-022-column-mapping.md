# SCR-022 — Column mapping panel

Status: Draft
Last updated: 2026-11-06

| Address | Who | Phase | Requirements |
|---|---|---|---|
| `/p/<project>/models/<model>#<column>` | members | P2 | MAP-040…MAP-046 |

## 1. Purpose
Write and compare the mapping of one target column in every branch.

## 2. Content
- Target column: name, definition, type, nullable.
- One area per branch, side by side: inputs, step pipeline with the type after each step, or "not provided" with its reason (MAP-040…MAP-045).

## 3. Actions
- Pick inputs; add, reorder, remove steps; build conditions; mark not provided; copy to other branches (MAP-046).
- Next and previous column without closing the panel.

## 4. States and errors
- Type mismatch at the end of the pipeline: the last step is marked and a `convert` step is proposed (MM-200).
- `sql` step: distinct style and mandatory reason (MAP-045).
- Common rules: `docs/06-ux/screens/README.md` §2.

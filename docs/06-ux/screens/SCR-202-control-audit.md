# SCR-202 — Control tower: audit log

Status: Draft
Last updated: 2026-11-06

| Address | Who | Phase | Requirements |
|---|---|---|---|
| `/control/audit` | operator | P2 | CT-040, CT-041 |

## 1. Purpose
Read every operator action.

## 2. Content
- Entries newest first: time, operator, action, organization, figures before and after (CT-040).

## 3. Actions
- Filter by organization, operator, period.

## 4. States and errors
- The log is append-only: nothing can be edited or deleted (ARC-203).
- Common rules: `docs/06-ux/screens/README.md` §2.

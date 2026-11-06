# SCR-201 — Control tower: organization

Status: Draft
Last updated: 2026-11-06

| Address | Who | Phase | Requirements |
|---|---|---|---|
| `/control/o/<organization>` | operator | P2 | CT-013, CT-014, CT-020…CT-022 |

## 1. Purpose
Manage one organization's credits and validate its deletions.

## 2. Content
- Name, figures (CT-010), deletions waiting (a number only, CT-020).

## 3. Actions
- Rename (CT-014); change credits, never below the accounts that exist (CT-013); **Validate the deletions** (CT-021), which returns the credits.

## 4. States and errors
- Nothing waiting: the validate action is hidden.
- Common rules: `docs/06-ux/screens/README.md` §2.

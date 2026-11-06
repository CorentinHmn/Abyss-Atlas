# SCR-080 — Organization: licenses and accounts

Status: Draft
Last updated: 2026-11-06

| Address | Who | Phase | Requirements |
|---|---|---|---|
| `/org/accounts` | Admins | P2 | ADM-001…ADM-023 |

## 1. Purpose
Manage the organization's accounts within its license credits.

## 2. Content
- License counter: granted, used, remaining, waiting for deletion (ADM-001).
- Accounts: display name, e-mail, role, status (invited, active, suspended, waiting for deletion), last sign-in.

## 3. Actions
- **New account** (refused without a remaining credit, ADM-010, ADM-011); change role (ADM-015); suspend, reactivate (ADM-018, ADM-019); request or cancel a deletion (ADM-020); resend an invitation (ADM-014).

## 4. States and errors
- No credit left: the button explains that more licenses are asked from Atlas.
- Last active Admin: demote, suspend and delete are disabled with the reason (ADM-016).
- Common rules: `docs/06-ux/screens/README.md` §2.

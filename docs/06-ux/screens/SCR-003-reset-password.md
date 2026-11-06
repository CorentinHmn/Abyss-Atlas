# SCR-003 — Forgotten password and new password

Status: Draft
Last updated: 2026-11-06

| Address | Who | Phase | Requirements |
|---|---|---|---|
| `/reset-password` | everyone | P2 | ADM-018, ARC-200 |

## 1. Purpose
Let a user who forgot their password set a new one through an e-mail link.

## 2. Content
- Step 1: e-mail field.
- Step 2 (from the e-mail link): new password and confirmation.

## 3. Actions
- **Send the link**: always answers "If an account exists, an e-mail was sent" (never says whether the address exists).
- **Save**: sets the password and signs in.

## 4. States and errors
- Expired link: back to step 1.
- Suspended account: the reset works but sign-in stays refused (ADM-018).
- Common rules: `docs/06-ux/screens/README.md` §2.

# SCR-002 — Accept invitation

Status: Draft
Last updated: 2026-11-06

| Address | Who | Phase | Requirements |
|---|---|---|---|
| `/invite` | the person invited (link from the e-mail) | P2 | ADM-012, ADM-014 |

## 1. Purpose
Let an invited person choose their password and enter Atlas.

## 2. Content
- Organization name and the e-mail of the invitation (not editable).
- Display name (prefilled by the Admin, editable), password and confirmation, with the password rules shown.

## 3. Actions
- **Join**: sets the password, signs in, opens the projects list (SCR-010).

## 4. States and errors
- Expired or already used link: message and a way to ask the Admin for a new invitation (ADM-014).
- Account suspended or deleted meanwhile: the link no longer works.
- Common rules: `docs/06-ux/screens/README.md` §2.

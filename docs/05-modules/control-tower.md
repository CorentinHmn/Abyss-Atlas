# 05.11 — Module: Control tower

Status: Draft
Last updated: 2026-11-05

The operator's area of Atlas (ADR 0002): organizations, license credits, deletions to validate. The operator never
sees customer content: no project names, no user names or e-mails, no specs (`docs/00-vision.md` principle 8).
Requirement identifiers: `CT-xxx`.

P2 delivers the **minimum** (UC-050, UC-051, UC-052). Contact details, support messages and support access come in
P3 (§4).

## 1. Access
- CT-001: The control tower is the route area `/control` of `apps/web`. Every page checks on the server that the
  user is an operator (`licensing.operators`); anyone else gets a "not found" page.
- CT-002: Operator accounts are added by migration or by a database admin only, never from the application
  (ADR 0002 §3.2).
- CT-003: An operator account is not a member of any customer organization (ADR 0002 §3.1).
- CT-004: Control tower pages read only the `licensing` schema, through views and functions that return counts.
  They never import screens or components that load customer content (ADR 0002 §3.2).
- CT-005 (P4): Multi-factor authentication is required for operators (ARC-200).

## 2. Organizations (UC-050, UC-051)
- CT-010: The operator sees the list of organizations with, for each: name, credits granted, accounts created,
  credits remaining, deletions waiting, creation date.
- CT-011: The operator creates an organization: name and the number of credits granted (at least 1).
- CT-012: When creating it, the operator enters the e-mail and name of the customer's first Admin, usually the
  contact person; Atlas sends the invitation and uses the first credit (Q-ADM-03 of
  `docs/05-modules/administration.md`). The e-mail must not be used by another Atlas account (ADM-013). The
  control tower does not keep or show this e-mail afterwards.
- CT-013: The operator changes the credits granted. Credits cannot go below the number of accounts that exist; to
  lower them further, the customer must first request deletions.
- CT-014: The operator renames an organization.
- CT-015: There is no deletion of an organization in P2 (end of contract: later decision, with the export offered to
  the customer first).

## 3. Deletions to validate (UC-052)
- CT-020: For each organization, the operator sees the **number** of accounts waiting for deletion, never which
  ones (ADR 0002 §3.2).
- CT-021: The operator validates the waiting deletions of an organization in one action. A database function removes
  those accounts and returns their credits; it returns only the number removed.
- CT-022: If a customer Admin cancels a request before the validation, it is no longer counted.

## 4. Later (P3)
- CT-030: Customer contact details: contact person and phone number (UC-054).
- CT-031: Support messages and replies (UC-055).
- CT-032: Support access requests (UC-053, ADR 0002 §3.3).

## 5. Audit
- CT-040: Every operator action (organization created or renamed, credits changed, deletions validated) is written
  to an append-only operator audit log in `licensing`, with the operator, the time and the figures before and after
  (ARC-203).
- CT-041: The operator reads the audit log in the control tower.

## 6. Proof of separation
- CT-050: pgTAP tests prove that an operator session reads no `app` table and that every control tower function
  returns counts only (RM-033, ADR 0002 §3.4).

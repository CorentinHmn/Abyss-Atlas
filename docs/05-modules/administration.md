# 05.08 — Module: Administration

Status: Draft
Last updated: 2026-11-05

What a customer Admin manages for the organization: accounts and licenses, projects, the catalogue of domains, and
the organization's settings. The operator side (creating organizations, granting credits, validating deletions) is
`docs/05-modules/control-tower.md`. Requirement identifiers: `ADM-xxx`.

Phases: P2 unless marked otherwise (`docs/07-roadmap.md` §3.4). Open points are in §7.

## 1. Accounts and licenses (UC-040, UC-041, UC-043, UC-046)

### 1.1 License counter
- ADM-001: Admins see the counter of their organization: credits **granted**, **used**, **remaining**, and the number
  of accounts **waiting for deletion**.
- ADM-002: A credit is used by every account that exists, whatever its status (active, suspended, waiting for
  deletion). It comes back only when the operator validates the deletion (ADM-020).

### 1.2 Creating an account
- ADM-010: An Admin creates an account with an e-mail address, a display name and a role (Admin, Editor, Viewer).
- ADM-011: Creation is refused when no credit remains; the check and the use of the credit happen in one database
  transaction, so two Admins can never use the last credit twice (`docs/04-architecture.md` §4.7).
- ADM-012: The new user receives an **invitation e-mail** with a link to choose a password (see Q-ADM-01). Until then
  the account shows as **invited**; it already uses its credit.
- ADM-013: An e-mail already used by an account of the organization is refused.
- ADM-014: Admins can resend an invitation that has not been accepted.

### 1.3 Changing an account
- ADM-015: An Admin changes an account's role at any time. The change applies to the next request (no sign-out).
- ADM-016: The organization always keeps **at least one active Admin**: the last active Admin cannot be demoted,
  suspended or deleted (enforced in the database).
- ADM-017: An Admin cannot change their own role or suspend themselves (another Admin must do it).

### 1.4 Suspending an account (UC-046)
- ADM-018: An Admin suspends an account at once: its sessions are revoked and it can no longer sign in or read
  anything. The credit stays used.
- ADM-019: An Admin reactivates a suspended account.

### 1.5 Deleting an account (UC-043)
- ADM-020: An Admin requests the deletion of an account. The account is **suspended immediately** and shows as
  **waiting for deletion**; the request can be cancelled until the operator validates it.
- ADM-021: The operator only sees how many deletions are waiting (ADR 0002 §3.2). When they are validated, a database
  function removes the accounts and returns their credits.
- ADM-022: Removing an account keeps the history readable: past versions and approvals keep the author's display
  name and e-mail as recorded at the time (no foreign key to the removed account).
- ADM-023: A person with accounts in several organizations (§2) keeps their sign-in until their last account is
  removed.

## 2. Several organizations (see Q-ADM-02)
- ADM-030: One person signs in once and may hold accounts in several organizations (e.g. a consultant working for
  two customers). Each account belongs to one organization, uses one credit of that organization and has its own
  role there.
- ADM-031: The user picks the current organization in a switcher; everything shown belongs to that organization.

## 3. Projects (UC-044)
- ADM-040: Editors and Admins create a project (name, description) and rename it.
- ADM-041: Only Admins delete a project. Deleting asks to type the project's name; it removes its specs, history
  and downloads (see Q-ADM-04).
- ADM-042: Projects can be **archived** by Editors and Admins: they stay readable and leave the main list.
- ADM-043: Every active member of the organization sees every project (no per-project access list in v1). The
  project-level Approver permission comes in P3 (`docs/01-scope.md` §2.3).

## 4. Domains (UC-048)
- ADM-050: Admins manage the organization's catalogue of domains: code (2 to 5 capitals or digits), name,
  description (MM-020…MM-026).
- ADM-051: The catalogue is set up when the organization starts using Atlas and shared by all projects. It has no
  fixed list: each organization defines its own processes (`SEL` Sales, `MFG` Manufacture and `GOV` Govern are only
  examples).
- ADM-052: A domain used by a project cannot be deleted, only **retired**: no new object can be assigned to it
  (MM-025). A code cannot be changed once used.
- ADM-053 (P3): Owners and stewards of each domain, Admin-only changes (MM-021…MM-024), are added with review and
  approval.

## 5. Organization settings
- ADM-060: Admins see the organization's name (set by the operator) and its contact person as recorded by the
  operator (P3, UC-054).
- ADM-061 (v1.1): The AI switch, off by default (UC-016, ARC-040).
- ADM-062 (P3): Support access requests and the support access log (UC-045, ADR 0002 §3.3).

## 6. Permissions summary
| Action | Viewer | Editor | Admin |
|---|---|---|---|
| See the license counter | no | no | yes |
| Create, change, suspend, reactivate accounts; request deletions | no | no | yes |
| Create, rename, archive projects | no | yes | yes |
| Delete projects | no | no | yes |
| Manage domains | no | no | yes |

Every rule is enforced by RLS policies and database functions, then proven by pgTAP tests (ADR 0008, RM-032);
the screens only hide what a role cannot do.

## 7. Open points
- Q-ADM-01: **Invitation e-mails** need an e-mail sender. Supabase's built-in sender is limited to a few e-mails per
  hour and meant for tests: enough while only the founder uses Atlas, not for customers. Proposal: built-in sender in
  P2, an EU e-mail provider (new sub-processor, ARC-205) before the first external users.
- Q-ADM-02: Can one person hold accounts in several organizations (§2)? Proposal: yes, useful for consulting firms.
- Q-ADM-03: Who creates the **first Admin** of a new organization? Proposal: the operator, with the e-mail of the
  customer's contact person, when creating the organization; it uses the first credit. The control tower then never
  shows it again (`docs/05-modules/control-tower.md` CT-012).
- Q-ADM-04: Deleting a project is final. Proposal: Admins only, with the typed confirmation of ADM-041, and the
  export (UC-036) offered first.

# ADR 0003 — Syncing specs and approvals with Git

Status: Superseded by ADR 0007 (no Git integration). Kept for history.
Date: 2026-11-04
Deciders: founder (delegated to the proposal below)

## 1. Context
- Git is the source of truth: the spec is readable, diffable YAML (`CLAUDE.md`, principle "Git-native").
- Data stewards never use Git. They review and approve in the application: Draft → In review → Approved, on a whole
  spec, a target table or a single column mapping (`docs/01-scope.md` UC-021).
- Data engineers also edit the YAML directly in Git and run the CLI in CI (UC-034).
- dbt models are generated from approved specs (UC-030).
- The operator must never see customer content or repositories (`docs/00-vision.md` principle 8, ADR 0002).

## 2. Options considered
| Option | Pros | Cons |
|---|---|---|
| A. Approvals stored only in the Atlas database | Simple. | Git is no longer the whole truth; CI and the CLI cannot know what is approved. |
| **B. Approvals stored in Git next to the spec, written by Atlas** | Git holds spec and approvals; approvals are diffable and auditable; CI can check them; independent of Git provider APIs. | Anyone with write access to the repo could edit an approval record (see §3.5). |
| C. One pull request per review; approving = approving the PR | Familiar to engineers. | Depends on each provider's PR API; very noisy for column-level reviews (many small PRs); stewards would need Git accounts or a proxy. |

## 3. Decision
**Option B in v1.** A pull request mode (C) may be added later as a per-project setting.

### 3.1 The repository belongs to the customer
1. A project can be linked to a repository and a branch on the customer's own Git provider (optional, see §3.6).
2. The customer connects it with an app installation or token limited to the chosen repositories.
3. Git credentials are encrypted and used only by the sync process, in the context of the customer's
   organization. The operator role has no access to them and no access to the repository (ADR 0002).
4. Providers supported in v1: **GitHub and GitLab**. Their APIs are free to use; each customer uses its own
   account and plan. Azure DevOps and Bitbucket may follow.

### 3.2 What is stored in Git
1. The spec files (YAML).
2. **Approval records**, as structured data. For each approved unit (spec, target table or column mapping):
   - the unit;
   - the approver;
   - the date;
   - a **content hash** of the unit as approved.
3. The exact file layout is defined in `docs/03-spec-format.md`. The hash requires a canonical serialization,
   provided by `packages/core`.

### 3.3 From the application to Git
1. Changes saved in the application become commits on the project's branch. The commit author is the user; the
   committer is Atlas.
2. Submitting, approving and rejecting are also commits, so the Git history shows the review trail.

### 3.4 From Git to the application
1. A webhook tells Atlas about each push. Atlas reads the new version, validates it and updates its working copy.
2. If an approved unit's content changed, its hash no longer matches: the unit goes back to **Draft** ("approval
   outdated") and needs a new review.
3. If the same unit was changed both in the application and in Git, Atlas never overwrites silently: it shows a
   conflict to resolve in the application.

### 3.5 Integrity of approvals
1. Approvals are only made in the application. Atlas keeps the authoritative approval log in its database.
2. An approval record that appears in Git without a matching entry in that log is flagged as **invalid** and
   ignored.
3. The CLI checks that each approval's hash matches the current content, and can restrict generation to approved
   units, so a CI pipeline can block unapproved changes.
4. Limit: working offline, the CLI cannot tell a forged approval record from a real one. Signed approval records
   (Atlas signs, the CLI verifies with a public key) would close this gap; see §5.

### 3.6 Projects without a repository
1. A project can work without a connected repository. Atlas then keeps the version history (UC-023) and the
   approval log itself.
2. The spec can be exported as YAML at any time.
3. When a repository is connected later, Atlas writes the current spec and its approval records as a first commit,
   and the sync of §3.3 and §3.4 starts.
4. In every case, the customer's data stays on its side, in its own platforms, run by its own data engineers:
   Atlas holds metadata only.

## 4. Consequences

### 4.1 Positive
- Git holds the full picture: the spec, who approved what, and when.
- Stewards stay in the application; engineers keep their Git and CI workflow.
- The core does not depend on any Git provider's pull request API.
- The operator stays out: the repository is the customer's, and so are the credentials.

### 4.2 Negative / risks
- Atlas needs write access to the customer's repository. Access must be limited to the chosen repositories, and
  the credentials are sensitive secrets (the infrastructure access risk of ADR 0002 applies).
- Two-way sync and conflict handling add complexity.
- Until approvals are signed, an offline CLI cannot detect a forged approval record (§3.5).

## 5. Follow-up decisions
- Signed approval records.
- Pull request mode as a per-project option.
- Azure DevOps and Bitbucket support.

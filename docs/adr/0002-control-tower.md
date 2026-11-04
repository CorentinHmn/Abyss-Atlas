# ADR 0002 — Control tower and operator access to customer content

Status: Accepted
Date: 2026-11-04
Deciders: founder

## 1. Context
- Atlas sells **license credits** per organization (1 license = 1 credit). The customer's Admins create accounts
  that use credits; credits come back only when the operator deletes an account (`docs/00-vision.md` §7.2).
- The operator (the Atlas company) needs a superuser **control tower** to grant credits, process deletion requests
  and see license usage per organization (`docs/01-scope.md` §2.6).
- The operator must **never see customer content** (`docs/00-vision.md` principle 8). The control tower shows only
  figures that are not private to the customer: credits granted, accounts created, credits remaining.
- Support may need to see a customer's content to help. This is allowed only with the customer's explicit approval
  by several Admins, for a limited time, with every access logged.
- The founder prefers the control tower as an area of the main application, **provided the separation is
  reliable**.

## 2. Options considered
| Option | Pros | Cons |
|---|---|---|
| A. Separate application (`apps/console`) with its own accounts | Strongest separation; operator code never ships with the product. | A second app to build, deploy and secure; duplicated auth and UI setup. |
| **B. Restricted area in `apps/web`, separation enforced in the database** | One app, one deployment; the boundary is enforced by Postgres, not by UI code, so it holds even if application code has a bug. | Operator and product code live in the same app; requires discipline and tests. |
| C. Use the database console (Supabase dashboard) directly | Nothing to build. | Full access to all data: breaks principle 8. Rejected. |

## 3. Decision
**Option B**, made reliable by the following rules.

### 3.1 Data separation
1. Licensing data lives in its own schema (working name `licensing`): organizations, credit grants, account counts,
   deletion requests, support access requests and grants, operator audit log.
2. The operator role can read and write **only** this schema. Account figures are exposed as aggregates (counts)
   through views or SQL functions; the operator never queries user or content tables directly.
3. **No RLS policy on any customer content table grants access to the operator role**, except the support access
   policy in §3.3.
4. The operator is not a member of any customer organization.

### 3.2 Operator accounts
1. The operator role is assigned server-side only (never from the client), to a short allow-list of accounts.
2. Multi-factor authentication is mandatory for operator accounts.
3. The control tower is a separate route area of `apps/web`, checked on the server. It does not reuse components
   that load customer content.
4. Every operator action is written to the audit log.
5. Deletion requests identify accounts by an opaque reference, never by name or e-mail (to be confirmed,
   `docs/01-scope.md` Q-09).

### 3.3 Support access
1. The operator requests access to one organization, with a reason and a duration.
2. Access opens only after approval by several of the customer's Admins (number to be decided, Q-08).
3. While the grant is valid, an RLS policy lets the operator **read** that organization's content; nothing else.
4. The grant expires automatically. The customer can revoke it at any time.
5. Every access is logged and the log is visible to the customer's Admins.

### 3.4 Proof of separation
Automated tests must show that an operator session cannot read any customer content table without a valid support
grant, and can only see aggregates in the licensing schema. These tests are required in CI before the control
tower ships.

## 4. Consequences

### 4.1 Positive
- One application to build and deploy.
- The separation is enforced by the database, and tested.
- The boundary is a schema, so the control tower can move to a separate app (option A) later without changing the
  data model.

### 4.2 Negative / risks
- Operator and product code share a codebase: a careless change could add a leak. This is mitigated by the
  database rules and the tests in §3.4, and by code review of any change touching the operator role.
- People with infrastructure access (database admin, Supabase service key) can technically read everything. This
  access must be kept to a minimum and logged. Per-organization encryption of content is a possible later decision
  (separate ADR).

## 5. Follow-up decisions
- Number of customer Admin approvals for support access, and the single-Admin case (`docs/01-scope.md` Q-08).
- Per-organization encryption of customer content.

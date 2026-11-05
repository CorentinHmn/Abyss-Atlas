# ADR 0007 — Atlas is the only workspace; no Git integration

Status: Accepted
Date: 2026-11-04
Deciders: founder
Supersedes: ADR 0003
Amended by: ADR 0009 (not open source)

## 1. Context
- ADR 0003 made the customer's Git repository the source of truth, with two-way sync of specs and approvals.
- The founder rejects this: customers must **never** open or modify anything in Git for Atlas. Nothing belonging
  to a customer is stored in any Git repository, neither the customer's nor Atlas's own (which holds only the
  product's source code). Atlas pushes nothing to the customer.
- What a customer wants to keep on its side, it downloads and stores according to its own policy and
  infrastructure.
- Specs must still be versioned, reviewable, approvable and protected from the operator (ADR 0002).
- Customers must not be locked in, and the open-core strategy (open format, `packages/core`, CLI) is kept
  *(dropped by ADR 0009: the product is proprietary)*.

## 2. Options considered
| Option | Pros | Cons |
|---|---|---|
| A. Customer Git as source of truth (ADR 0003) | Familiar to engineers; diffs in pull requests. | Rejected by the founder: customers would have to work with Git. |
| B. Atlas pushes outputs one way into the customer's repository | Automatic delivery. | Still stores customer material in Git; rejected. |
| **C. Atlas is the only workspace; outputs are downloaded; full export to the open YAML format** | One place to work, no Git for anyone; simpler sync and co-editing; approvals cannot be forged outside Atlas. | Atlas must provide history, diffs and versions itself; no automatic delivery into the customer's toolchain. |

## 3. Decision
**Option C.**

1. **Specs live in Atlas**: in the EU database, isolated per organization, unreadable by the operator (ADR 0002).
2. **History in Atlas**: every change is kept as a version; users see who changed what, when, and the diff between
   any two versions. Named versions (e.g. "Release 1.0") can be created.
3. **Approvals in Atlas**: approval records and their content hashes are stored in Atlas's approval log only. A
   change to an approved unit still makes its approval outdated (`docs/02-metamodel.md` MM-700).
4. **No Git integration**: Atlas never reads from or writes to any Git repository of a customer. Atlas's own
   repository contains only the product's code.
5. **Outputs are downloaded**: generated dbt models, documentation, ODCS contracts and the full spec export are
   downloaded by the customer, who stores them as its policy requires.
6. **Open export**: a project can be exported at any time as an archive in plain YAML
   (`docs/03-spec-format.md`), including approval records. This is the guarantee against lock-in. *(Amended by
   ADR 0009: the CLI that was to read such an export on the customer's side is an internal tool.)*

## 4. Consequences
- Positive:
  - nobody needs Git: analysts, stewards and engineers work only in Atlas;
  - the two-way sync, webhooks, conflict handling and Git credentials of ADR 0003 disappear;
  - approvals can only be made in Atlas, so they cannot be forged in files;
  - nothing of a customer is ever in a Git repository.
- Negative:
  - Atlas must build versioning and diffs itself (`docs/04-architecture.md`);
  - delivery into the customer's dbt project is manual (download); an automated delivery API may be considered
    later, without Git;
  - the "spec as code in Git" positioning is replaced by "one governed workspace, open export".

## 5. Follow-up decisions
- An API for customers to fetch generated outputs automatically (later, if asked).

# ADR 0009 — Proprietary product; the command line is an internal tool

Status: Accepted
Date: 2026-11-05
Deciders: founder
Amends: ADR 0001 (§1.2, §4.1, §5), ADR 0007 (§1, §3.6)

## 1. Context
- ADR 0001 and ADR 0007 assumed an **open core**: the spec format, `packages/core` and the CLI published as open
  source, the CLI letting customers validate and generate from an export without the SaaS.
- The founder decided that Atlas is **not open source**.
- Customers must still not be locked in (ADR 0007), and the core must stay independent of the SaaS so that the
  browser, the server, the worker and the tests share one engine.

## 2. Options considered
| Option | Pros | Cons |
|---|---|---|
| A. Open core (ADR 0001) | Adoption of the format; customers can generate without Atlas. | Rejected by the founder: the product is not open source. |
| **B. Proprietary; the CLI is an internal tool** | Simple: one product, the SaaS; nothing to publish, license or support outside Atlas. | Customers cannot regenerate code outside Atlas; their guarantee against lock-in is the export and the code they already downloaded. |
| C. Proprietary CLI delivered to customers under their license | Offline generation and CI checks on the customer side. | Distribution, license terms, behavior when a subscription ends; to reconsider only if customers ask. |

## 3. Decision
**Option B.**

1. The spec format, `packages/core`, `packages/cli` and the web app are **proprietary**. Nothing is published
   (packages are `private`, license `UNLICENSED`).
2. `packages/cli` is an **internal tool**: Atlas's tests, CI and reference runs (`scripts/`). It is not distributed
   to customers. It keeps working offline, from files only (ADR 0001 §4.3), which keeps `packages/core`
   independent of the SaaS.
3. **No lock-in** (ADR 0007): a project can be exported at any time as plain YAML with its approvals (UC-036),
   target tables as ODCS contracts (UC-033), and the generated dbt code and documentation belong to the customer.
4. Use cases removed: UC-034 (CLI on the customer side) and UC-005 (CLI reading a database catalog). Catalog queries
   provided by Atlas (UC-003) stay: the customer runs them with its own tools and imports the CSV in the browser.

## 4. Consequences
- Positive: one product to build, sell and support; no license to choose; no public release to prepare in P1.
- Negative:
  - no adoption effect of an open format;
  - a customer who leaves keeps its export, ODCS contracts and generated code, but no Atlas tool to regenerate.
- The product name (RM-060) is no longer needed for a public CLI release; it is needed before the website teaser
  (P4). "Atlas" is kept for now.

## 5. Follow-up decisions
- A command line for customers under a commercial license (option C), if customers ask (would bring back UC-034).
- Whether a description of the YAML format is given to customers (customer documentation, P4).

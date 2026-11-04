# ADR 0006 — Worker service and background jobs

Status: Accepted
Date: 2026-11-04
Deciders: founder

## 1. Context
- Some work cannot run in Vercel functions, which are time-limited and cannot hold connections:
  - the real-time co-editing server (ADR 0005);
  - Git sync in both directions (ADR 0003);
  - validation and generation of large projects (`docs/04-architecture.md` §7);
  - batch AI suggestions (ADR 0004).
- Constraints: EU hosting, few sub-processors, runs the same TypeScript code (`packages/core`).

## 2. Options considered
### 2.1 Queue
| Option | Pros | Cons |
|---|---|---|
| **Supabase Queues** (Postgres-based) | Already in the stack; transactional with the data; EU. | Fewer features than a dedicated queue (scheduling, dashboards). |
| A hosted job service (e.g. Inngest, Trigger.dev) | Rich features. | One more sub-processor; data residency to check. |
| Redis-based queue | Fast, mature. | One more component to host. |

### 2.2 Hosting of the worker
| Option | Pros | Cons |
|---|---|---|
| **AWS, Frankfurt** (container service) | AWS is already a sub-processor for AI (ADR 0004); mature; EU. | US-headquartered (CLOUD Act). |
| Scaleway (France) | European, sovereign; matches the future sovereign option (ADR 0001). | One more sub-processor now. |
| Supabase Edge Functions | No extra vendor. | Time-limited, no long-lived WebSocket server; different runtime (Deno). |

## 3. Decision
1. **Supabase Queues** carry jobs from `apps/web` to the worker.
2. A new application, **`apps/worker`** (Node.js, TypeScript), hosts:
   - the co-editing server (ADR 0005);
   - the job consumers: Git sync, large validations and generations, batch AI.
3. The worker runs as a container on **AWS in Frankfurt**, with at least two instances for availability.
4. The worker only uses `packages/core` and the database; it is portable to any container host, which keeps the
   sovereign option (Scaleway, OVHcloud) open.

## 4. Consequences
- Positive: no extra sub-processor; one place for long-running work; same code as the web app and the CLI.
- Negative: a container service to operate (deployment, scaling, monitoring); WebSocket connections must be routed
  so that all editors of a document share state (handled by Hocuspocus with a shared store, or by routing a
  document to one instance).

## 5. Follow-up decisions
- Scaling strategy of the co-editing server across instances.
- Move to a sovereign host if customers require it.

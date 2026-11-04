# ADR 0005 — Real-time co-editing

Status: Accepted
Date: 2026-11-04
Deciders: founder

## 1. Context
- Several people must be able to work on the same spec **at the same time**, seeing each other's changes live
  (UC-017, founder requirement).
- The spec is structured data (`docs/02-metamodel.md`), shown both as forms and as YAML (UC-015).
- The structured content is the truth: approvals hash its canonical form (ADR 0003), Git receives YAML files.
- Viewers can read but never change anything.
- Vercel functions cannot hold long-lived connections.

## 2. Options considered
| Option | Pros | Cons |
|---|---|---|
| Optimistic locking per object, with presence | Simple. | Not real-time co-editing: the second person waits or gets a conflict. Rejected by the requirement. |
| **CRDT (Yjs) on the structured objects, with a sync server (Hocuspocus)** | Proven open-source stack (MIT); changes merge automatically, offline-tolerant; presence (who is where) built in; server can enforce read-only. | A long-running server to host; mapping between CRDT and canonical JSON to maintain. |
| Yjs over Supabase Realtime (broadcast) | No extra server. | No server-side authority over changes or persistence; community integration, less proven. |
| Hosted service (e.g. Liveblocks) | Nothing to host. | Another US sub-processor seeing customer content; cost per user. |
| Operational transformation on YAML text | Familiar from code editors. | Text merges can produce invalid YAML; the structure is not the source of truth. |

## 3. Decision
**Yjs on the structured objects, synchronized by a Hocuspocus server in `apps/worker`** (hosting: ADR 0006).

1. One co-editing document per spec file (model, rule, value mapping, dataset, domain, project).
2. The document mirrors the object's structure (maps and lists); long text fields (definitions, descriptions,
   rule statements) are shared texts, merged character by character.
3. The forms and the YAML view both work on this document. Edits in the YAML view are parsed and applied as
   structured changes once the YAML is valid; the view never merges raw text.
4. The server checks the session and the role when a document is opened, opens it read-only for Viewers, and
   rejects changes from them.
5. After a burst of edits, the server stores the document state, then the canonical JSON and its hash
   (`docs/04-architecture.md` §3.2), which feed validation, reviews and Git sync.
6. Presence shows who is on which model and which column.

## 4. Consequences
- Positive: true simultaneous work; no lost edits; presence helps coordination; works on unstable connections.
- Negative: a long-running service to operate; two representations (co-editing document and canonical JSON) must
  stay consistent, so the conversion lives in `packages/core` and is tested both ways.
- Git: commits are grouped after a quiet period rather than per keystroke (`docs/04-architecture.md` §4.3).

## 5. Follow-up decisions
- Undo/redo scope (per user, per document).
- Behaviour of comments anchored to a field that another user deletes.

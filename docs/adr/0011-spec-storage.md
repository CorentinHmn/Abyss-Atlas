# ADR 0011 — Storage of spec objects and their history

Status: Accepted
Date: 2026-11-06
Deciders: founder (plan of P2, step "source registry")

## 1. Context
- Specs live in Atlas (ADR 0007). Each spec file of an export (system, dataset, model, rule, value mapping) must be
  stored per project, isolated per organization, versioned (UC-023, VER-001…VER-005) and turned back into the exact
  export files for validation, generation and the YAML view.
- ADR 0005 plans one co-editing document (Yjs) per spec object; real co-editing comes in P3.

## 2. Decision
1. **One row per spec file** in `app.spec_objects`: project, kind, key, path, content and content hash (FMT-122,
   computed by `packages/core`). The content is stored as `json`, not `jsonb`, so that the order of keys is kept and
   a stored object reads like its file.
2. **History in the database**: `app.spec_versions`, written only by the save and delete functions. An edit by the
   same person within 2 minutes extends the last version (VER-002); imports, copies, restores and deletions always
   start a new one; a save without change records nothing; deletions are versions with no content (VER-004).
3. **Writes through two functions** (`app.save_spec_objects`, `app.delete_spec_objects`) that check the caller
   (Editor or Admin, project not archived); members read through RLS; the operator has no access (ADR 0002).
4. **Validation on the server** with `packages/core` on the files rebuilt from the rows (`specToFile`); content is
   saved even when invalid (ARC-013) and the problems are shown.
5. **Sources are saved directly in P2**; the co-editing document of ADR 0005 arrives with the mapping editor and
   covers sources in P3, without changing this storage (the document is kept next to the row, ARC-022).
6. **Large imports are computed in the browser** (the same `packages/core` code) and sent in batches, so that files up
   to 20 MB (SRC-025) never travel and requests stay within the platform's size limits.

## 3. Consequences
- Positive: the export, the CLI and the app read the same files; history and permissions are enforced in one
  place and tested with pgTAP; no conversion layer between the database and the format.
- Negative: queries inside contents use `json` operators (no `jsonb` indexes); if search inside contents becomes
  slow at the maximum project size (ARC-300), derived tables will be added (ARC-021).

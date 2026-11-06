# 05.06 — Module: Versioning

Status: Draft
Last updated: 2026-11-06

History of a project in Atlas: who changed what and when, comparison of any two versions, named versions, restore.
Atlas is the only workspace, with no Git (ADR 0007): history lives in the database (`app.spec_versions`, ARC-023).
Screen: SCR-050 (`docs/06-ux/navigation-menus.md`). Requirement identifiers: `VER-xxx`.

Phase: P2 (UC-023). Open points are in §8.

## 1. What is a version
- VER-001: A **version** is the state of one object (model, rule, value mapping, dataset, system, project settings)
  after a change: its canonical JSON, its content hash, the authors of the change and the time.
- VER-002: A version is recorded after a **quiet period** of 2 minutes without edits on the object, so that a burst of
  typing gives one version, not hundreds (`docs/04-architecture.md` §4.3). It is also recorded at once when:
  a dictionary import is confirmed (SRC-024), an object is restored (§5), a named version is created (§4), and in P3
  when a unit is submitted for review or approved.
- VER-003: When several people edited the object during the same burst (P3), all of them are recorded as authors.
- VER-004: Creating and deleting an object are versions too: a deleted object stays in the history and can be
  restored (§5).
- VER-005: Authors are kept as recorded at the time (display name and e-mail), even after their account is removed
  (ADM-022).

## 2. Project timeline
- VER-010: The history screen shows the project's changes, newest first, grouped by burst: who, when, which objects,
  and a one-line summary (e.g. "Lena changed `dim_customer`: 2 mappings, 1 column added").
- VER-011: Filters: object (or kind of object), author, period, named versions only.
- VER-012: Each object's own history is also reachable from the object (model editor, rule, value mapping, dataset).

## 3. Comparing versions
- VER-020: Any two versions of an object can be compared, and an object's version with its current state.
- VER-021: The comparison is **structured**: computed by `packages/core` on the canonical form (ADR 0007, the same
  diff as `atlas diff`) and shown in business terms, object by object and attribute by attribute (e.g.
  "`country_code` · branch `oracle`: step `map_values` added"). A YAML side-by-side view is available as well.
- VER-022: Two named versions of the project, or a named version and the current state, can be compared: the screen
  lists the objects added, removed and changed, each opening its structured comparison.

## 4. Named versions
- VER-030: Editors and Admins create a **named version** of the whole project (e.g. "Release 1.0"), with a
  description. It marks the latest version of every object at that moment; it never changes afterwards.
- VER-031: Names are unique within the project. Admins can delete a named version (the object versions stay).
- VER-032: From a named version, users can download the generated outputs and the export of that moment
  (`docs/05-modules/import-export.md`), see Q-VER-02.

## 5. Restore
- VER-040: Editors and Admins restore an older version of an object, or a deleted object. A restore never rewrites
  the past: it creates a new version equal to the old one.
- VER-041: Editors and Admins restore the **whole project** to a named version (Q-VER-03): every object that differs
  gets a new version equal to its state in that named version; objects created since are deleted (and restorable).
  The screen shows the list of what will change before confirming.
- VER-042: After a restore, validation re-checks everything restored (references to objects that changed meanwhile
  may break).

## 6. Retention and size
- VER-050: Versions are kept for the life of the project (Q-VER-01). Deleting the project deletes its history
  (ADM-041).
- VER-051: Versions store the canonical JSON of one object, not the whole project, so that history stays small; the
  timeline and comparisons stay fast for a project of the maximum size (ARC-300).

## 7. Permissions
| Action | Viewer | Editor | Admin |
|---|---|---|---|
| Read the history, compare versions | yes | yes | yes |
| Create a named version, restore | no | yes | yes |
| Delete a named version | no | no | yes |

## 8. Open points
- Q-VER-01: **Retention**: keep every version for the life of the project. Proposal: yes; it is metadata only, a few
  kilobytes per version, and it is the audit trail of the spec.
- Q-VER-02: **Outputs of a named version**: download the dbt code, the documentation and the export as they were at
  "Release 1.0", not only the current ones. Proposal: yes.
- Q-VER-03: **Restore the whole project** to a named version, in addition to restoring one object. Proposal: yes,
  with the list of changes shown before confirming.

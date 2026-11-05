# 06 — UX: navigation and menus

Status: Draft
Last updated: 2026-11-05

The menus and the tree of screens of Atlas. Each screen has an identifier (`SCR-xxx`) and, from its phase on, its
own file in `docs/06-ux/screens/`. Requirement identifiers: `NAV-xxx`.

## 1. Principles
- NAV-001: Two separate areas: the **workspace** of customer users, and the **control tower** of the operator
  (`/control`, `docs/05-modules/control-tower.md`). They share nothing but sign-in; an operator has no workspace and
  a customer user has no control tower.
- NAV-002: Every screen has its own address (deep links can be shared between colleagues of the same organization).
- NAV-003: Menus show only what the user's role can open (`docs/05-modules/administration.md` §6); the server and
  the database still check every action.
- NAV-004: Everything a project contains is reached in at most two clicks from the project's menu.
- NAV-005: English only at launch; every label comes from the message files (next-intl).
- NAV-006: Desktop first (specs are written on a computer). Below 1024 px wide, screens stay readable (lists and
  read-only views); editing is not designed for phones.

## 2. Workspace layout
```
┌────────────────────────────────────────────────────────────────────────────┐
│ Atlas   Organization   [Project ▾]                [Search]   [?]  [Me ▾]   │  top bar
├──────────────┬─────────────────────────────────────────────────────────────┤
│ Project menu │                                                             │
│  Overview    │                    screen content                           │
│  Models      │                                                             │
│  Sources     │                                                             │
│  Rules       │                                                             │
│  Value maps  │                                                             │
│  History     │                                                             │
│  Downloads   │                                                             │
│ ──────────── │                                                             │
│  Settings    │                                                             │
└──────────────┴─────────────────────────────────────────────────────────────┘
```
- NAV-010: **Top bar**: product mark (goes to the projects list), organization name (no switcher: one account, one
  organization, ADM-031), project switcher, search (P3), help, personal menu.
- NAV-011: **Personal menu**: profile (display name, password), organization administration (Admins), sign out.
- NAV-012: **Project menu**: shown inside a project; the current screen is highlighted. Counts of validation errors
  appear next to the entries that have some (Models, Rules, Value maps).
- NAV-013: Signing in opens the last project used, or the projects list.

## 3. Screen tree
| ID | Screen | Address | Who | Phase |
|---|---|---|---|---|
| SCR-001 | Sign in | `/sign-in` | everyone | P0 |
| SCR-002 | Accept invitation (choose a password) | `/invite` | invited users | P2 |
| SCR-003 | Forgotten password, new password | `/reset-password` | everyone | P2 |
| SCR-010 | Projects list | `/projects` | members | P2 |
| SCR-011 | Project overview: validation summary, models by domain, last changes | `/p/<project>` | members | P2 |
| SCR-020 | Models list | `/p/<project>/models` | members | P2 |
| SCR-021 | Model editor: grain, columns, branches, joins, mappings, consolidation; form and YAML views | `/p/<project>/models/<model>` | members (Viewers read only) | P2 |
| SCR-022 | Column mapping (panel of SCR-021, one target column across branches) | `/p/<project>/models/<model>#<column>` | members | P2 |
| SCR-030 | Sources: systems and their datasets | `/p/<project>/sources` | members | P2 |
| SCR-031 | Dataset: columns, keys, types | `/p/<project>/sources/<system>/<dataset>` | members | P2 |
| SCR-032 | Import a dictionary file (with the catalog queries to copy) | `/p/<project>/sources/import` | Editors, Admins | P2 |
| SCR-040 | Rules list and rule editor | `/p/<project>/rules[/<rule>]` | members | P2 |
| SCR-041 | Value mappings list and editor | `/p/<project>/value-mappings[/<mapping>]` | members | P2 |
| SCR-050 | History: versions of the project and of each object, diff between two versions, restore | `/p/<project>/history` | members (restore: Editors, Admins) | P2 |
| SCR-060 | Downloads: dbt project, documentation, full export | `/p/<project>/downloads` | members | P2 |
| SCR-070 | Project settings: name, description, archive, delete | `/p/<project>/settings` | Editors, Admins (delete: Admins) | P2 |
| SCR-080 | Organization: license counter and accounts | `/org/accounts` | Admins | P2 |
| SCR-081 | Organization: domains | `/org/domains` | Admins (read: members) | P2 |
| SCR-082 | Organization: settings (AI switch v1.1, support access P3) | `/org/settings` | Admins | P3 |
| SCR-090 | Profile | `/me` | everyone | P2 |
| SCR-100 | Reviews: what waits for my approval, my requests | `/p/<project>/reviews` | members | P3 |
| SCR-101 | Lineage and join graphs | `/p/<project>/lineage` | members | P3 |
| SCR-102 | Support messages | `/support` | members | P3 |
| SCR-200 | Control tower: organizations | `/control` | operator | P2 |
| SCR-201 | Control tower: organization (credits, deletions to validate) | `/control/o/<organization>` | operator | P2 |
| SCR-202 | Control tower: audit log | `/control/audit` | operator | P2 |
| SCR-203 | Control tower: support messages and access requests | `/control/support` | operator | P3 |
| SCR-900 | Project progress (founder only, until v1) | `/progress` | signed in | P1 |

- NAV-020: `<project>`, `<model>`, `<rule>`… are readable identifiers (the project's slug, the object's id), never
  database keys, so that addresses can be read and shared.

## 4. Control tower layout
- NAV-030: A plain top bar marked **Control tower**, without organization or project switcher, and a menu:
  Organizations, Audit log (P2); Support (P3).
- NAV-031: The control tower uses a different accent color, so an operator always knows which area they are in.

# 06 — UX: screens

Status: Draft
Last updated: 2026-11-06

One file per screen, named after its identifier (e.g. `SCR-021-model-editor.md`), written just before the phase
that builds it (RM-003). The tree of screens and their addresses is in `docs/06-ux/navigation-menus.md` §3.
Requirement identifiers of this file: `UX-xxx`.

## 1. Index
| Phase | Screens |
|---|---|
| P0–P1 | SCR-001 sign in, SCR-900 project progress (no file: simple pages) |
| P2 | SCR-002 accept invitation, SCR-003 reset password, SCR-010 projects, SCR-011 project overview, SCR-020 models, SCR-021 model editor, SCR-022 column mapping, SCR-030 sources, SCR-031 dataset, SCR-032 import dictionary, SCR-040 rules, SCR-041 value mappings, SCR-050 history, SCR-060 downloads, SCR-070 project settings, SCR-080 organization accounts, SCR-081 organization domains, SCR-090 profile, SCR-200 control organizations, SCR-201 control organization, SCR-202 control audit |
| P3 (to write) | SCR-082 organization settings, SCR-100 reviews, SCR-101 lineage, SCR-102 support, SCR-203 control support |

## 2. Common rules
- UX-001: **Loading**: content placeholders in the shape of what comes; anything longer than 1 second says what it
  is doing (e.g. "Generating the dbt project…").
- UX-002: **Empty states** explain what the screen is for and offer the main action (or say who can do it).
- UX-003: **Destructive actions** ask for confirmation and say what will be lost and what remains restorable
  (history, VER-004); deleting a project also asks to type its name (ADM-041).
- UX-004: **Errors** say what happened and what to do next, in plain words; validation problems keep their code
  (`VAL-xxx`) so that they can be looked up.
- UX-005: **Permissions**: an action the role cannot do is hidden, or disabled with the reason when hiding it would
  confuse (e.g. the last Admin, ADM-016) (NAV-003).
- UX-006: **Accessibility**: WCAG 2.1 AA contrast, every action reachable with the keyboard, visible focus, labels on
  every field and icon button.
- UX-007: **Text**: English at launch, every string from the message files (NAV-005); dates as "6 Nov 2026",
  times in the user's time zone.
- UX-008: **Components**: shadcn/ui on Tailwind, colors and spacing from the tokens of `apps/web/src/app/globals.css`;
  the control tower uses its own accent color (NAV-031).

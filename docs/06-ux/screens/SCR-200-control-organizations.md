# SCR-200 — Control tower: organizations

Status: Draft
Last updated: 2026-11-06

| Address | Who | Phase | Requirements |
|---|---|---|---|
| `/control` | operator | P2 | CT-001…CT-015 |

## 1. Purpose
See every customer organization's licensing figures and create organizations.

## 2. Content
- One row per organization: name, credits granted, accounts, remaining, deletions waiting, created on (CT-010). No project, user or content.

## 3. Actions
- **New organization**: name, credits, first Admin's name and e-mail (CT-011, CT-012).
- Open an organization (SCR-201).

## 4. States and errors
- E-mail already used by an Atlas account: refused (ADM-013).
- Common rules: `docs/06-ux/screens/README.md` §2.

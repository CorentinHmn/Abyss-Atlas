# SCR-032 — Import a dictionary file

Status: Draft
Last updated: 2026-11-06

| Address | Who | Phase | Requirements |
|---|---|---|---|
| `/p/<project>/sources/import` | Editors, Admins | P2 | SRC-020…SRC-025, IE-001…IE-012 |

## 1. Purpose
Import source metadata from a dictionary file (CSV or Excel), produced for instance by a catalog query.

## 2. Content
- Step 1: the catalog queries for PostgreSQL and SQL Server, with a copy button and the one-line instruction (SRC-020).
- Step 2: system, dialect, file (CSV or `.xlsx`, sheet picker) (SRC-021).
- Step 3: preview: datasets created, updated, columns missing from the file, untranslated types (SRC-022).

## 3. Actions
- **Import**: saves the result as one change in the history (SRC-024).
- **Cancel** at any step: nothing is saved.

## 4. States and errors
- Unreadable file or missing required columns: the errors, with the expected columns (IE §1.1).
- File over 20 MB: refused (SRC-025).
- Common rules: `docs/06-ux/screens/README.md` §2.

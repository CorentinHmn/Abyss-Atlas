# SCR-041 — Value mappings

Status: Draft
Last updated: 2026-11-06

| Address | Who | Phase | Requirements |
|---|---|---|---|
| `/p/<project>/value-mappings[/<mapping>]` | members (Viewers read only) | P2 | MAP-052 |

## 1. Purpose
List and write the value mappings (code translations) of the project.

## 2. Content
- List by domain: name, types, number of entries or reference dataset, uses.
- Editor: name, domain, from and to types, default; entries grid or reference dataset and columns (MAP-052), YAML tab.

## 3. Actions
- New value mapping; paste entries from a spreadsheet; delete (uses listed first).

## 4. States and errors
- Duplicate `from` values or more than 1,000 entries: marked in the grid (MM-310, MM-311).
- Common rules: `docs/06-ux/screens/README.md` §2.

# 05.03 — Module: Validation

Status: Draft
Last updated: 2026-11-05

Validation checks a project (`docs/02-metamodel.md`, `docs/03-spec-format.md`) and reports issues. It lives in
`packages/core` and runs the same way in the browser, on the server and in the CLI (ARC-010…ARC-012). It never
blocks saving (ARC-013). Requirement identifiers: `VAL-xxx`; each check below is also the code of the issue it
reports.

## 1. Issues
| Field | Content |
|---|---|
| code | `VAL-xxx` |
| severity | `error` (the project cannot be generated), `warning` (allowed, shown in reviews), `info` |
| message | Plain English sentence for the user, naming the objects concerned |
| location | File path and position in the file (path of keys, e.g. `columns.country_code.from.oracle.steps[0]`) |

- VAL-000: Generation (`docs/05-modules/generation.md`) refuses a project with at least one `error`.
- VAL-001: Issues are sorted by file, then position, so two runs on the same project give the same report.

## 2. Checks

### 2.1 Files and format
| Code | Severity | Check | Source |
|---|---|---|---|
| VAL-010 | error | The file is valid YAML 1.2 and a mapping at its top level. | FMT-001 |
| VAL-011 | error | `atlas` is present and is a supported format version. | FMT-002, FMT-151 |
| VAL-012 | error | `kind` is known and every key is known for that kind (keys starting with `x_` excepted). | FMT-002, FMT-012 |
| VAL-013 | error | Required attributes are present and have the right shape. | 02-metamodel |
| VAL-014 | error | File name and folder match the object (id, code, system, domain). | FMT-003 |
| VAL-015 | error | Literals are text (`value: "2"`, not `value: 2`). | FMT-020, FMT-040 |
| VAL-016 | error | Ids follow MM-600; domain codes are 2 to 5 uppercase letters or digits. | MM-600, §3.2 |
| VAL-017 | error | No two objects of the same kind share an id (or a column name within a dataset or model). | MM-600 |
| VAL-018 | error | No duplicate key in a YAML mapping (e.g. two identical value mapping entries). | MM-311 |

### 2.2 References
| Code | Severity | Check | Source |
|---|---|---|---|
| VAL-020 | error | Every reference resolves: domain, system, dataset, model, column, alias, rule, value mapping, branch. | MM-602 |
| VAL-021 | error | Chains between models have no cycle. | MM-111 |
| VAL-022 | error | Business rules do not call themselves, directly or not. | MM-300 |
| VAL-023 | error | The arguments of a `rule` step are exactly the parameters of the rule. | §6.1 |
| VAL-024 | error | Every object belongs to a domain of the project; a domain has at least one steward. | MM-020, MM-021 |

### 2.3 Branches, joins, consolidation
| Code | Severity | Check | Source |
|---|---|---|---|
| VAL-030 | error | A model with several branches has a consolidation. | §4.4 |
| VAL-031 | error / warning | A `many_to_many` join without `confirmed: true` is an error; a confirmed one is a warning. | MM-121 |
| VAL-032 | error | A join or condition compares operands of compatible types. | MM-120 |
| VAL-033 | warning | The declared cardinality contradicts the declared primary keys. | MM-122 |
| VAL-034 | warning | A `lookup` whose match does not cover a declared key of the looked-up dataset may return several rows. | MM-201 |
| VAL-035 | error | In a grouped branch, each mapping is a grouping column or ends with an aggregation. | MM-112 |
| VAL-036 | error | `match` columns and survivorship branches exist; survivorship is given when `match` is. | §4.4 |

### 2.4 Column mappings and types
| Code | Severity | Check | Source |
|---|---|---|---|
| VAL-040 | error | Every target column has exactly one mapping per branch, after `"*"` expansion. | MM-100, FMT-082 |
| VAL-041 | error | `not_provided` is only used on a nullable column. | MM-100 |
| VAL-042 | error | The type at the end of the pipeline is compatible with the target type; otherwise a `convert` is required. | MM-200, MM-410, MM-411 |
| VAL-043 | error | Each step receives a value of a type it accepts (e.g. no arithmetic on text). | MM-200 |
| VAL-044 | warning | Known traps: text with leading zeros converted to a number, a date kept as text, decimal precision lost. | MM-412 |
| VAL-045 | error | An `sql` step or condition states a reason. | MM-210 |
| VAL-046 | warning | Each `sql` step or condition is reported as unstructured. | MM-211 |
| VAL-047 | error | A `calculate` uses a function of the catalog with the right number and types of arguments. | MM-202 |
| VAL-048 | error | `map_values` input type matches the value mapping's `from_type`. | §6.2 |

### 2.5 Quality checks, value mappings, approvals
| Code | Severity | Check | Source |
|---|---|---|---|
| VAL-050 | error | Quality checks reference existing columns and value mappings. | §8 |
| VAL-051 | error | A value mapping has at most 1,000 inline entries, or a `reference`. | MM-310 |
| VAL-060 | info | An approval whose hash no longer matches the content is outdated. (P3) | MM-700 |

## 3. Indicators
- VAL-070: The report gives the share of target columns whose logic contains an `sql` escape hatch (MM-212).

## 4. Phases
All checks are in P1 except VAL-060 (P3). VAL-033 and VAL-034 only use declared primary keys; they can never see the
data (OOS-001).

Implementation status (2026-11-05): every P1 check is implemented in `packages/core` except **VAL-033**. SAP keys start
with the client (`MANDT`), which specs rarely join on; VAL-033 needs a rule for such columns first (e.g. declared
as a constant per system), otherwise it would warn on every SAP join.

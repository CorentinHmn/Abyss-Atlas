# Reference project

Acceptance test of every roadmap phase (`docs/07-roadmap.md` §2, RM-012). It is a realistic multi-ERP group
consolidation, written in the export format of `docs/03-spec-format.md`.

## Content
| Element | Content |
|---|---|
| Systems | `sap_fr`, `sap_de` (SAP S/4HANA), `oracle` (Oracle E-Business Suite 12.2), `mes` (manufacturing execution system) |
| Source datasets | 30 (10 SAP tables per SAP system, 9 Oracle tables, 1 MES table), with their real names and types |
| Domains | `SEL` Sales, `MFG` Manufacture, `GOV` Govern |
| Target models | 7, 61 columns |
| Business rules | 5 (`GOV`: `qualified_key`, `sap_date`, `sap_inverted_date`; `SEL`: `customer_status_from_flags`; `MFG`: `yield_rate`) |
| Value mappings | 5 |

| Domain | Model | What it exercises |
|---|---|---|
| SEL | `dim_customer` | Union of 3 ERPs, match on VAT number, branch priority and column survivorship, a GOV rule used in SEL, lookup with a two-part condition, `not_provided`, one-to-many join + deduplication |
| SEL | `fact_sales_order_line` | Concatenated keys, calculation (quantity × price), fiscal period in SQL (escape hatch), relationships to three dimensions |
| MFG | `dim_material` | Confirmed many-to-many join + deduplication, value mapping to a conversion factor, case on item types |
| MFG | `int_mes_order_output` | Intermediate model: group by, `sum`, `count`, `min`, `max` |
| MFG | `fact_production_order` | **Chain**: reads `int_mes_order_output`; defaults after a left join; yield rule |
| GOV | `dim_plant` | Shared reference data, constant, default |
| GOV | `fact_exchange_rate` | SAP inverted dates (rule), SAP indirect quotation (SQL), match on a composite key |

Coverage:
- every step kind of `docs/02-metamodel.md` §5.2;
- every join cardinality;
- union, consolidation and survivorship;
- 4 `not_provided`;
- 4 SQL escape hatches, each with a reason.

## Checks
Until the validator of `packages/core` exists (P1), the project was checked with a provisional script:
- every file parses as YAML 1.2;
- file names and folders match;
- every reference resolves: systems, datasets, aliases, columns, rules and arguments, value mappings, relationships;
- every target column has exactly one mapping per branch;
- many-to-many joins are confirmed;
- literals are quoted;
- grouped branches only aggregate.

In P1, the same checks move to `atlas validate` (RM-020), and the generated dbt project must run on Snowflake
(RM-021).

## Points found in the metamodel (to decide before P1)
| # | Point | Where it shows | Proposal |
|---|---|---|---|
| F-1 | An operand cannot be a calculation, so a `case` cannot return a computed value. | SAP indirect quotation in `fact_exchange_rate` needed SQL. | Allow a `calculate` as an operand (one level), so most of these cases stay structured. |
| F-2 | The value of `current` at the start of a business rule is not defined. | `sap_date` converts its only parameter. | Same rule as FMT-081: with exactly one parameter, the first step receives it as `current`. |
| F-3 | `concat` with an empty part is not defined (in Snowflake, one empty part empties the result). | `customer_name` = NAME1 + NAME2. | Empty parts are skipped; the separator is only placed between non-empty parts. |
| F-4 | The key `on` (joins, lookups) is read as `true` by YAML 1.1 tools (e.g. Python's PyYAML). | Every join. | Keep `on` (Atlas reads YAML 1.2) and document it; or rename it `condition`. |
| F-5 | Consolidation `match` on a column that can be empty. | `dim_customer` matches on VAT number. | An empty value never matches: rows without a VAT number are never merged. |
| F-6 | After a merge, facts may still point to the identifier of a merged-away row. | `fact_sales_order_line.customer_id` (relationship kept as a warning). | Consolidation produces a cross-reference (source identifier → surviving identifier) that facts can use. Later phase. |
| F-7 | The column added by `add_source_column` has no declared type or definition. | Every consolidated model. | It is an automatic column: type `string(20)`, definition generated, listed in documentation and ODCS. |

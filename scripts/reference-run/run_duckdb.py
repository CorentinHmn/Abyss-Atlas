"""Offline run of the generated dbt project on the fictitious reference data (RM-021, before Snowflake).

The dbt project generated for Snowflake is compiled by dbt (scripts/generated-dbt/check.sh), then each model's
Snowflake SQL is translated to DuckDB with sqlglot and executed on the data of examples/reference-data, in
dependency order. The dbt tests and the expected results (expectations.yaml) are then checked.

This proves the logic of the generated SQL (joins, consolidation, rules, conversions). Snowflake itself is
checked by the Snowflake workflow, with the same data and the same expectations.

Usage: python run_duckdb.py <generated dbt project, compiled> <examples/reference> <examples/reference-data>
"""
import csv
import json
import pathlib
import re
import sys

import duckdb
import sqlglot
import yaml

DUCKDB_TYPES = {"integer": "INTEGER", "bigint": "BIGINT", "float": "DOUBLE", "boolean": "BOOLEAN", "date": "DATE",
                "time": "TIME", "timestamp": "TIMESTAMP", "timestamp_tz": "TIMESTAMPTZ", "binary": "BLOB", "json": "JSON"}


def duckdb_type(logical: str) -> str:
    m = re.fullmatch(r"(string|decimal)(?:\((\d+)(?:,\s*(\d+))?\))?", logical)
    if m and m.group(1) == "string":
        return "VARCHAR"
    if m and m.group(1) == "decimal":
        return f"DECIMAL({m.group(2)},{m.group(3) or 0})"
    return DUCKDB_TYPES[logical]


def load_sources(con, reference: pathlib.Path, data: pathlib.Path) -> int:
    """Creates every source table where the generated sources point (landing database and schema) and loads its data."""
    con.execute("ATTACH ':memory:' AS \"RAW\"")
    systems = {p.parent.name: yaml.safe_load(p.read_text()) for p in reference.glob("systems/*/system.yaml")}
    rows = 0
    for path in sorted(reference.glob("systems/*/datasets/*.yaml")):
        dataset = yaml.load(path.read_text(), Loader=yaml.BaseLoader)  # YAML 1.2-like: everything stays text
        system = systems[dataset["system"]]
        schema = system["landing"]["schema"]
        table = dataset.get("landing_name", dataset["name"])
        con.execute(f'CREATE SCHEMA IF NOT EXISTS "RAW"."{schema}"')
        columns = dataset["columns"]
        con.execute(f'CREATE TABLE "RAW"."{schema}"."{table}" ('
                    + ", ".join(f'"{name}" {duckdb_type(col["type"])}' for name, col in columns.items()) + ")")
        csv_path = data / dataset["system"] / f"{dataset['id']}.csv"
        if not csv_path.exists():
            continue
        with csv_path.open(newline="", encoding="utf-8") as fh:
            for record in csv.DictReader(fh):
                names = list(record)
                values = [None if record[n] == "" else record[n] for n in names]
                con.execute(f'INSERT INTO "RAW"."{schema}"."{table}" ({", ".join(chr(34) + n + chr(34) for n in names)}) '
                            f'VALUES ({", ".join("?" for _ in names)})', values)
                rows += 1
    return rows


def to_duckdb(sql: str) -> str:
    sql = re.sub(r"^\s*--.*$", "", sql, flags=re.M)
    return ";\n".join(sqlglot.transpile(sql, read="snowflake", write="duckdb"))


def topological(nodes: dict) -> list:
    order, seen = [], set()

    def visit(key):
        if key in seen:
            return
        seen.add(key)
        for dep in nodes[key]["depends_on"]["nodes"]:
            if dep in nodes:
                visit(dep)
        order.append(key)

    for key in sorted(nodes):
        visit(key)
    return order


def main() -> int:
    project, reference, data = (pathlib.Path(a) for a in sys.argv[1:4])
    manifest = json.loads((project / "target" / "manifest.json").read_text())
    con = duckdb.connect()
    loaded = load_sources(con, reference, data)
    print(f"Loaded {loaded} fictitious source rows.")

    models = {k: v for k, v in manifest["nodes"].items() if v["resource_type"] == "model"}
    failures = 0
    for key in topological(models):
        node = models[key]
        sql = (project / node["compiled_path"]).read_text()
        try:
            con.execute(f"CREATE OR REPLACE TABLE {node['relation_name']} AS {to_duckdb(sql)}")
            count = con.execute(f"SELECT count(*) FROM {node['relation_name']}").fetchone()[0]
            print(f"  model {node['name']}: {count} row(s)")
        except Exception as error:  # noqa: BLE001 - report every model, then fail
            failures += 1
            print(f"✗ model {node['name']} failed: {str(error).splitlines()[0]}")
    con.execute("USE memory.main")

    tests = {k: v for k, v in manifest["nodes"].items() if v["resource_type"] == "test"}
    for key in sorted(tests):
        node = tests[key]
        sql = (project / node["compiled_path"]).read_text()
        try:
            rows = con.execute(to_duckdb(sql)).fetchall()
        except Exception as error:  # noqa: BLE001
            failures += 1
            print(f"✗ test {node['name']} could not run: {str(error).splitlines()[0]}")
            continue
        if rows:
            if node["config"]["severity"].lower() == "warn":
                print(f"  ! test {node['name']} warns: {len(rows)} row(s)")
            else:
                failures += 1
                print(f"✗ test {node['name']} failed: {len(rows)} row(s), e.g. {rows[0]}")
    print(f"  {len(tests)} dbt test(s) run.")

    checks = yaml.safe_load((data / "expectations.yaml").read_text())["checks"]
    for check in checks:
        try:
            rows = con.execute(to_duckdb(check["sql"])).fetchall()
        except Exception as error:  # noqa: BLE001
            failures += 1
            print(f"✗ expectation could not run: {check['name']}: {str(error).splitlines()[0]}")
            continue
        if rows:
            failures += 1
            print(f"✗ expectation failed: {check['name']} → {rows[:3]}")
    print(f"  {len(checks)} expectation(s) checked.")
    print("RESULT:", "OK" if failures == 0 else f"{failures} failure(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())

"""Reference run on Snowflake (RM-021): loads the fictitious data, runs `dbt build`, checks the expected results.

Environment: SNOWFLAKE_ACCOUNT, SNOWFLAKE_USER, SNOWFLAKE_PRIVATE_KEY_PATH, optional SNOWFLAKE_ROLE and
SNOWFLAKE_WAREHOUSE (default ATLAS_CI and ATLAS_CI_WH). Setup of the account: scripts/reference-run/setup-snowflake.sql.

Usage: python run_snowflake.py <generated dbt project> <examples/reference> <examples/reference-data>
"""
import csv
import os
import pathlib
import re
import subprocess
import sys

import snowflake.connector
import yaml
from cryptography.hazmat.primitives import serialization

SNOWFLAKE_TYPES = {"integer": "NUMBER(38,0)", "bigint": "NUMBER(38,0)", "float": "FLOAT", "boolean": "BOOLEAN",
                   "date": "DATE", "time": "TIME", "timestamp": "TIMESTAMP_NTZ", "timestamp_tz": "TIMESTAMP_TZ",
                   "binary": "BINARY", "json": "VARIANT"}


def snowflake_type(logical: str) -> str:
    m = re.fullmatch(r"(string|decimal)(?:\((\d+)(?:,\s*(\d+))?\))?", logical)
    if m and m.group(1) == "string":
        return f"VARCHAR({m.group(2)})" if m.group(2) else "VARCHAR"
    if m and m.group(1) == "decimal":
        return f"NUMBER({m.group(2)},{m.group(3) or 0})"
    return SNOWFLAKE_TYPES[logical]


def connect():
    key = serialization.load_pem_private_key(pathlib.Path(os.environ["SNOWFLAKE_PRIVATE_KEY_PATH"]).read_bytes(), password=None)
    return snowflake.connector.connect(
        account=os.environ["SNOWFLAKE_ACCOUNT"],
        user=os.environ["SNOWFLAKE_USER"],
        private_key=key.private_bytes(serialization.Encoding.DER, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()),
        role=os.environ.get("SNOWFLAKE_ROLE", "ATLAS_CI"),
        warehouse=os.environ.get("SNOWFLAKE_WAREHOUSE", "ATLAS_CI_WH"),
    )


def load_sources(cur, reference: pathlib.Path, data: pathlib.Path) -> int:
    systems = {p.parent.name: yaml.safe_load(p.read_text()) for p in reference.glob("systems/*/system.yaml")}
    rows = 0
    for path in sorted(reference.glob("systems/*/datasets/*.yaml")):
        dataset = yaml.load(path.read_text(), Loader=yaml.BaseLoader)
        landing = systems[dataset["system"]]["landing"]
        relation = f'"{landing["database"]}"."{landing["schema"]}"."{dataset.get("landing_name", dataset["name"])}"'
        cur.execute(f'CREATE SCHEMA IF NOT EXISTS "{landing["database"]}"."{landing["schema"]}"')
        cur.execute(f"CREATE OR REPLACE TABLE {relation} ("
                    + ", ".join(f'"{n}" {snowflake_type(c["type"])}' for n, c in dataset["columns"].items()) + ")")
        csv_path = data / dataset["system"] / f"{dataset['id']}.csv"
        if not csv_path.exists():
            continue
        with csv_path.open(newline="", encoding="utf-8") as fh:
            records = list(csv.DictReader(fh))
        if records:
            names = list(records[0])
            cur.executemany(f'INSERT INTO {relation} ({", ".join(chr(34) + n + chr(34) for n in names)}) VALUES ({", ".join("%s" for _ in names)})',
                            [[None if r[n] == "" else r[n] for n in names] for r in records])
            rows += len(records)
    return rows


def main() -> int:
    project, reference, data = (pathlib.Path(a).resolve() for a in sys.argv[1:4])
    here = pathlib.Path(__file__).resolve().parent
    with connect() as con:
        cur = con.cursor()
        print(f"Loaded {load_sources(cur, reference, data)} fictitious source rows into RAW.")
    build = subprocess.run(["dbt", "build", "--profiles-dir", str(here)], cwd=project)
    failures = 0 if build.returncode == 0 else 1
    with connect() as con:
        cur = con.cursor()
        cur.execute("USE SCHEMA ATLAS_CI.REFERENCE")
        checks = yaml.safe_load((data / "expectations.yaml").read_text())["checks"]
        for check in checks:
            rows = cur.execute(check["sql"]).fetchall()
            if rows:
                failures += 1
                print(f"✗ expectation failed: {check['name']} → {rows[:3]}")
        print(f"{len(checks)} expectation(s) checked.")
    print("RESULT:", "OK" if failures == 0 else f"{failures} failure(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())

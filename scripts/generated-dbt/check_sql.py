"""Parse every compiled SQL file of the generated dbt project with sqlglot, Snowflake dialect."""
import pathlib
import sys

import sqlglot
from sqlglot.errors import ParseError

root = pathlib.Path(sys.argv[1])
files = sorted(p for p in root.rglob("*.sql") if "/models/" in str(p) or "/tests/atlas/" in str(p))
bad = 0
for path in files:
    sql = path.read_text()
    try:
        sqlglot.parse_one(sql, read="snowflake", error_level=sqlglot.ErrorLevel.RAISE)
    except ParseError as error:
        bad += 1
        print(f"FAIL {path.relative_to(root)}: {str(error).splitlines()[0]}")
print(f"{len(files) - bad}/{len(files)} statements parse as Snowflake SQL")
sys.exit(1 if bad else 0)

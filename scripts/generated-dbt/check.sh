#!/usr/bin/env bash
# Generates the dbt project of the reference project with the CLI, then checks it offline:
# dbt parse + dbt compile, and every compiled statement must parse as Snowflake SQL.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../.." && pwd)"
out="${1:-$(mktemp -d)}"
node "$root/packages/cli/dist/atlas.js" generate dbt "$root/examples/reference" --out "$out"
cd "$out"
dbt parse --profiles-dir "$here"
dbt compile --profiles-dir "$here"
python "$here/check_sql.py" "$out/target/compiled"

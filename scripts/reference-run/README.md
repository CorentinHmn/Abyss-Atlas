# Reference run (RM-021, RM-054)

The dbt project generated from `examples/reference` runs on the fictitious data of `examples/reference-data`, then
the dbt tests and the expected results (`examples/reference-data/expectations.yaml`) are checked.

| Run | Where | When |
|---|---|---|
| Offline (DuckDB): the Snowflake SQL is translated by sqlglot and executed | GitHub Actions, job `generated-dbt` | every push |
| Snowflake: real `dbt build` | GitHub Actions, workflow `Snowflake reference run` | on demand, once the secrets exist; planned once before the first design partner (RM-054) |

## Setting up Snowflake (once)
1. Create a Snowflake trial account in an **EU region** (e.g. AWS Europe (Frankfurt)). A trial is free for 30 days
   or 400 USD of usage, whichever comes first: open it just before the run.
2. On your computer, create a key pair for the CI user (no password, no MFA prompt):
   ```bash
   openssl genrsa 2048 | openssl pkcs8 -topk8 -inform PEM -out rsa_key.p8 -nocrypt
   openssl rsa -in rsa_key.p8 -pubout -out rsa_key.pub
   ```
3. In Snowsight, open a worksheet as ACCOUNTADMIN and run `setup-snowflake.sql`. First, replace `<PUBLIC KEY>` with
   the content of `rsa_key.pub` without its `-----BEGIN…` and `-----END…` lines.
4. In GitHub, go to the repository, then Settings → Secrets and variables → Actions → New repository secret, and add:
   - `SNOWFLAKE_ACCOUNT`: the account identifier, `<orgname>-<accountname>` (Snowsight: account menu → Account →
     "Copy account identifier", replace the dot by a dash);
   - `SNOWFLAKE_USER`: `ATLAS_CI_USER`;
   - `SNOWFLAKE_PRIVATE_KEY`: the whole content of `rsa_key.p8`, including its first and last lines.
5. Actions → "Snowflake reference run" → Run workflow. Then delete `rsa_key.p8` from your computer, or keep it somewhere
   safe.

The warehouse is extra-small and suspends itself after 60 seconds: a run uses a few credits of the trial.
Only fictitious data is loaded (database `RAW`); models are built in `ATLAS_CI.REFERENCE`.

## Running offline on your machine
```bash
pip install -r scripts/generated-dbt/requirements.txt
scripts/generated-dbt/check.sh /tmp/atlas-dbt
python scripts/reference-run/run_duckdb.py /tmp/atlas-dbt examples/reference examples/reference-data
```

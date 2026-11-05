-- One-time setup of a Snowflake account for the reference run (RM-021). Run it in a Snowsight worksheet as ACCOUNTADMIN.
-- Replace <PUBLIC KEY> by the content of rsa_key.pub without its first and last lines (see docs in the README).
-- It creates only what the run needs: a small warehouse that suspends itself, a role, two databases, a service user.

use role accountadmin;

create warehouse if not exists ATLAS_CI_WH warehouse_size = xsmall auto_suspend = 60 auto_resume = true initially_suspended = true;
create role if not exists ATLAS_CI;
create database if not exists RAW;        -- landing location of the reference systems (fictitious data only)
create database if not exists ATLAS_CI;   -- where dbt builds the reference models

grant usage on warehouse ATLAS_CI_WH to role ATLAS_CI;
grant ownership on database RAW to role ATLAS_CI copy current grants;
grant ownership on database ATLAS_CI to role ATLAS_CI copy current grants;

create user if not exists ATLAS_CI_USER
  type = service
  default_role = ATLAS_CI
  default_warehouse = ATLAS_CI_WH
  rsa_public_key = '<PUBLIC KEY>';
grant role ATLAS_CI to user ATLAS_CI_USER;

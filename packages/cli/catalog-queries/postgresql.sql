-- Atlas catalog query for PostgreSQL (UC-003, IE-010).
-- It reads the catalog only (information_schema and pg_catalog), never the data of your tables.
-- 1. Put your schemas in the WHERE clause at the end.
-- 2. Run it with your own tools and access, and save the result as CSV with a header row.
-- 3. Import it:  atlas import dictionary <file.csv> --system <system id> --dialect postgresql
-- Two tables with the same name in two schemas would become the same dataset: import one schema per system.
select
  c.table_name as dataset,
  c.column_name as "column",
  case
    when c.data_type in ('character varying', 'character') and c.character_maximum_length is not null
      then c.data_type || '(' || c.character_maximum_length || ')'
    when c.data_type = 'numeric' and c.numeric_precision is not null
      then 'numeric(' || c.numeric_precision || ',' || coalesce(c.numeric_scale, 0) || ')'
    when c.data_type = 'USER-DEFINED' then c.udt_name
    else c.data_type
  end as native_type,
  case c.is_nullable when 'YES' then 'true' else 'false' end as nullable,
  k.ordinal_position as primary_key_position,
  col_description(format('%I.%I', c.table_schema, c.table_name)::regclass, c.ordinal_position::int) as description,
  obj_description(format('%I.%I', c.table_schema, c.table_name)::regclass, 'pg_class') as dataset_description,
  c.table_schema as namespace
from information_schema.columns c
join information_schema.tables t
  on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type in ('BASE TABLE', 'VIEW')
left join (
  select kcu.table_schema, kcu.table_name, kcu.column_name, kcu.ordinal_position
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on kcu.constraint_schema = tc.constraint_schema and kcu.constraint_name = tc.constraint_name
  where tc.constraint_type = 'PRIMARY KEY'
) k on k.table_schema = c.table_schema and k.table_name = c.table_name and k.column_name = c.column_name
where c.table_schema in ('public')
order by c.table_schema, c.table_name, c.ordinal_position;

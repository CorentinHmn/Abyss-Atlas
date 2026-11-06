/**
 * Catalog queries provided by Atlas (UC-003, IE-010): the customer runs them with its own tools and access, saves the
 * result as CSV (or Excel) and imports it in Atlas. They read the catalog only, never the data of the tables.
 */
export const CATALOG_QUERIES = {
  postgresql: `-- Atlas catalog query for PostgreSQL (UC-003, IE-010).
-- It reads the catalog only (information_schema and pg_catalog), never the data of your tables.
-- 1. Put your schemas in the WHERE clause at the end.
-- 2. Run it with your own tools and access, and save the result as CSV with a header row.
-- 3. Import it in Atlas: Sources > Import a dictionary, dialect postgresql.
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
`,
  sqlserver: `-- Atlas catalog query for SQL Server (UC-003, IE-010).
-- It reads the catalog only (sys views), never the data of your tables.
-- 1. Put your schemas in the WHERE clause at the end.
-- 2. Run it with your own tools and access, and save the result as CSV with a header row.
-- 3. Import it in Atlas: Sources > Import a dictionary, dialect sqlserver.
-- Two tables with the same name in two schemas would become the same dataset: import one schema per system.
select
  t.name as dataset,
  c.name as [column],
  case
    when ty.name in ('varchar', 'char', 'varbinary', 'binary')
      then ty.name + '(' + case when c.max_length = -1 then 'max' else cast(c.max_length as varchar(10)) end + ')'
    when ty.name in ('nvarchar', 'nchar')
      then ty.name + '(' + case when c.max_length = -1 then 'max' else cast(c.max_length / 2 as varchar(10)) end + ')'
    when ty.name in ('decimal', 'numeric')
      then ty.name + '(' + cast(c.precision as varchar(10)) + ',' + cast(c.scale as varchar(10)) + ')'
    else ty.name
  end as native_type,
  case when c.is_nullable = 1 then 'true' else 'false' end as nullable,
  ic.key_ordinal as primary_key_position,
  cast(ep.value as nvarchar(4000)) as description,
  cast(tp.value as nvarchar(4000)) as dataset_description,
  s.name as namespace
from sys.tables as t
join sys.schemas as s on s.schema_id = t.schema_id
join sys.columns as c on c.object_id = t.object_id
join sys.types as ty on ty.user_type_id = c.user_type_id
left join sys.indexes as i on i.object_id = t.object_id and i.is_primary_key = 1
left join sys.index_columns as ic on ic.object_id = t.object_id and ic.index_id = i.index_id and ic.column_id = c.column_id
left join sys.extended_properties as ep
  on ep.class = 1 and ep.major_id = t.object_id and ep.minor_id = c.column_id and ep.name = 'MS_Description'
left join sys.extended_properties as tp
  on tp.class = 1 and tp.major_id = t.object_id and tp.minor_id = 0 and tp.name = 'MS_Description'
where s.name in ('dbo')
order by s.name, t.name, c.column_id;
`,
} as const;

export type CatalogQueryDialect = keyof typeof CATALOG_QUERIES;

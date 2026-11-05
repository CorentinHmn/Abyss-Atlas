-- Atlas catalog query for SQL Server (UC-003, IE-010).
-- It reads the catalog only (sys views), never the data of your tables.
-- 1. Put your schemas in the WHERE clause at the end.
-- 2. Run it with your own tools and access, and save the result as CSV with a header row.
-- 3. Import it:  atlas import dictionary <file.csv> --system <system id> --dialect sqlserver
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

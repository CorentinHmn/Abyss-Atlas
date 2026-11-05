/**
 * Native types → logical types, per dialect (docs/05-modules/import-export.md §1.3, IE-003).
 */
import { formatLogicalType, type LogicalType } from "../types/logical-types";

export const DIALECTS = ["postgresql", "sqlserver", "sap", "oracle"] as const;
export type Dialect = (typeof DIALECTS)[number];

interface Parsed {
  name: string;
  args: number[];
  rest: string;
}

/** `varchar(40)` → name varchar, args [40]; `timestamp(6) with time zone` → rest "with time zone". */
function parse(native: string): Parsed {
  const text = native.trim().toLowerCase().replace(/\s+/g, " ");
  const open = text.indexOf("(");
  const close = text.indexOf(")", open);
  if (open < 0 || close < 0) return { name: text, args: [], rest: "" };
  const args = text
    .slice(open + 1, close)
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => (part === "max" ? -1 : Number(part)));
  return { name: text.slice(0, open).trim(), args, rest: text.slice(close + 1).trim() };
}

const str = (length?: number): LogicalType => (length !== undefined && length > 0 ? { kind: "string", length } : { kind: "string" });
const dec = (precision?: number, scale?: number): LogicalType | null =>
  precision !== undefined && precision > 0 && precision <= 38 ? { kind: "decimal", precision, scale: scale ?? 0 } : null;

function postgresql({ name, args, rest }: Parsed): LogicalType | null {
  const zone = /with time zone/.test(`${name} ${rest}`);
  if (["character varying", "varchar", "character", "char", "bpchar"].includes(name)) return str(args[0]);
  if (name === "text" || name === "citext") return str();
  if (["integer", "int", "int4", "serial", "smallint", "int2", "smallserial"].includes(name)) return { kind: "integer" };
  if (["bigint", "int8", "bigserial"].includes(name)) return { kind: "bigint" };
  if (name === "numeric" || name === "decimal") return args.length ? dec(args[0], args[1]) : { kind: "decimal", precision: 38, scale: 10 };
  if (["real", "float4", "double precision", "float8", "float"].includes(name)) return { kind: "float" };
  if (name === "boolean" || name === "bool") return { kind: "boolean" };
  if (name === "date") return { kind: "date" };
  if (name.startsWith("timestamp")) return zone || name === "timestamptz" ? { kind: "timestamp_tz" } : { kind: "timestamp" };
  if (name.startsWith("time")) return { kind: "time" };
  if (name === "bytea") return { kind: "binary" };
  if (name === "json" || name === "jsonb") return { kind: "json" };
  if (name === "uuid") return str(36);
  return null;
}

function sqlserver({ name, args }: Parsed): LogicalType | null {
  if (["nvarchar", "varchar", "nchar", "char"].includes(name)) return args[0] === -1 ? str() : str(args[0]);
  if (name === "text" || name === "ntext") return str();
  if (["int", "smallint", "tinyint"].includes(name)) return { kind: "integer" };
  if (name === "bigint") return { kind: "bigint" };
  if (name === "decimal" || name === "numeric") return dec(args[0] ?? 18, args[1] ?? 0);
  if (name === "money") return { kind: "decimal", precision: 19, scale: 4 };
  if (name === "smallmoney") return { kind: "decimal", precision: 10, scale: 4 };
  if (name === "float" || name === "real") return { kind: "float" };
  if (name === "bit") return { kind: "boolean" };
  if (name === "date") return { kind: "date" };
  if (name === "time") return { kind: "time" };
  if (["datetime", "datetime2", "smalldatetime"].includes(name)) return { kind: "timestamp" };
  if (name === "datetimeoffset") return { kind: "timestamp_tz" };
  if (["varbinary", "binary", "image"].includes(name)) return { kind: "binary" };
  if (name === "uniqueidentifier") return str(36);
  return null;
}

/** SAP ABAP Dictionary types. DATS and NUMC stay text on purpose (IE-012). */
function sap({ name, args }: Parsed): LogicalType | null {
  if (["char", "numc", "clnt", "lang", "cuky", "unit", "accp", "lchr", "string", "sstring", "strg", "sstr"].includes(name)) return str(args[0]);
  if (name === "dats") return str(8);
  if (name === "tims") return str(6);
  if (["quan", "curr", "dec"].includes(name)) return dec(args[0], args[1]);
  if (["int1", "int2", "int4"].includes(name)) return { kind: "integer" };
  if (name === "int8") return { kind: "bigint" };
  if (name === "fltp") return { kind: "float" };
  if (name === "rawstring" || name === "raw") return { kind: "binary" };
  return null;
}

function oracle({ name, args, rest }: Parsed): LogicalType | null {
  if (["varchar2", "nvarchar2", "varchar", "char", "nchar"].includes(name)) return str(args[0]);
  if (name === "clob" || name === "nclob" || name === "long") return str();
  if (name === "number") {
    if (args.length === 0) return { kind: "decimal", precision: 38, scale: 10 };
    if ((args[1] ?? 0) === 0) return (args[0] ?? 0) <= 18 ? { kind: "bigint" } : dec(args[0], 0);
    return dec(args[0], args[1]);
  }
  if (name === "integer") return { kind: "bigint" };
  if (["float", "binary_float", "binary_double"].includes(name)) return { kind: "float" };
  if (name === "date") return { kind: "timestamp" };
  if (name.startsWith("timestamp")) return /time zone/.test(rest) || /time zone/.test(name) ? { kind: "timestamp_tz" } : { kind: "timestamp" };
  if (["blob", "raw", "long raw"].includes(name)) return { kind: "binary" };
  return null;
}

const BY_DIALECT: Record<Dialect, (parsed: Parsed) => LogicalType | null> = { postgresql, sqlserver, sap, oracle };

/** The logical type of a native type, as text (e.g. `string(10)`), or null when it is not recognized. */
export function logicalTypeFor(native: string, dialect: Dialect): string | null {
  const type = BY_DIALECT[dialect](parse(native));
  return type ? formatLogicalType(type) : null;
}

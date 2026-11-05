/**
 * Snowflake SQL pieces shared by the dbt generator (docs/05-modules/generation.md §2.4, §2.5).
 */
import type { LogicalType } from "../types/logical-types";

/** GEN-041: logical types to Snowflake types. */
export function snowflakeType(type: LogicalType): string {
  switch (type.kind) {
    case "string":
      return type.length === undefined ? "varchar" : `varchar(${type.length})`;
    case "integer":
    case "bigint":
      return "number(38,0)";
    case "decimal":
      return `number(${type.precision},${type.scale})`;
    case "float":
      return "float";
    case "boolean":
      return "boolean";
    case "date":
      return "date";
    case "time":
      return "time";
    case "timestamp":
      return "timestamp_ntz";
    case "timestamp_tz":
      return "timestamp_tz";
    case "binary":
      return "binary";
    case "json":
      return "variant";
  }
}

export function quoteText(value: string): string {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
}

export function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/** A Jinja string literal holding SQL text, for macro arguments. */
export function jinjaString(sql: string): string {
  return `'${sql.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

/** A literal rendered in the context of a type: numbers unquoted, dates typed, everything else as text. */
export function renderLiteral(value: string, context?: LogicalType): string {
  if (context && (context.kind === "integer" || context.kind === "bigint" || context.kind === "decimal" || context.kind === "float") && /^-?\d+(\.\d+)?$/.test(value)) {
    return value;
  }
  if (context?.kind === "boolean" && (value === "true" || value === "false")) return value;
  if (context?.kind === "date") return `${quoteText(value)}::date`;
  return quoteText(value);
}

/** GEN-050: translation of every function of the catalog (types/functions.ts). */
export function renderFunction(name: string, args: string[]): string {
  const [a = "", b = "", c = ""] = args;
  switch (name) {
    case "add":
      return `(${a} + ${b})`;
    case "subtract":
      return `(${a} - ${b})`;
    case "multiply":
      return `(${a} * ${b})`;
    case "divide":
      return `(${a} / ${b})`;
    case "round":
      return `round(${a}, ${b})`;
    case "abs":
      return `abs(${a})`;
    case "nullif":
      return `nullif(${a}, ${b})`;
    case "coalesce":
      return `coalesce(${args.join(", ")})`;
    case "upper":
    case "lower":
    case "trim":
    case "length":
      return `${name}(${a})`;
    case "ltrim_zeros":
      return `ltrim(${a}, '0')`;
    case "substring":
      return `substr(${a}, ${b}, ${c})`;
    case "left":
    case "right":
      return `${name}(${a}, ${b})`;
    case "replace":
      return `replace(${a}, ${b}, ${c})`;
    case "date_add":
      return `dateadd(${unquote(a)}, ${b}, ${c})`;
    case "date_diff":
      return `datediff(${unquote(a)}, ${b}, ${c})`;
    case "date_trunc":
      return `date_trunc(${unquote(a)}, ${b})`;
    case "year":
    case "month":
    case "day":
      return `${name}(${a})`;
    default:
      throw new Error(`Function ${name} has no Snowflake translation (GEN-050).`);
  }
}

/** Date units are written as literals in the spec and as keywords in SQL. */
function unquote(literal: string): string {
  return literal.replace(/^'(.*)'$/, "$1");
}

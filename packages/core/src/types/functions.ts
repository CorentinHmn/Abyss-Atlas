/**
 * Function catalog of the `calculate` step (MM-202, docs/05-modules/generation.md §2.5).
 * Defined once here; every generator translates every function.
 */
import { isNumeric, isTemporal, parseLogicalType, type LogicalType } from "./logical-types";

/** Type of a value in a pipeline: a known type, a literal (typed by its context), or unknown (after `sql`). */
export type ValueType = { type: LogicalType } | { literal: string } | { unknown: true };

export const DATE_UNITS = ["year", "quarter", "month", "week", "day", "hour", "minute", "second"] as const;

type ArgKind = "number" | "text" | "date" | "any" | "unit" | "integer_literal";

export interface FunctionSignature {
  args: ArgKind[];
  /** For variadic functions: the kind of every argument after the fixed ones. */
  rest?: ArgKind;
  minArgs?: number;
  result: (args: ValueType[]) => ValueType;
  description: string;
}

const known = (type: LogicalType): ValueType => ({ type });
const typeOf = (value: ValueType | undefined): LogicalType | undefined => (value && "type" in value ? value.type : undefined);
const scale = (value: ValueType | undefined): number => {
  const type = typeOf(value);
  return type?.kind === "decimal" ? type.scale : 0;
};
const integerLiteral = (value: ValueType | undefined): number | undefined =>
  value && "literal" in value && /^\d+$/.test(value.literal) ? Number(value.literal) : undefined;

/** Arithmetic result: integers stay integers; otherwise the widest decimal with the largest scale. */
function arithmetic(extraScale: number) {
  return (args: ValueType[]): ValueType => {
    const types = args.map(typeOf);
    if (types.some((type) => type?.kind === "float")) return known({ kind: "float" });
    if (extraScale === 0 && types.every((type) => type === undefined || type.kind === "integer" || type.kind === "bigint")) {
      return known({ kind: "bigint" });
    }
    return known({ kind: "decimal", precision: 38, scale: Math.min(18, Math.max(...args.map(scale)) + extraScale) });
  };
}

export const FUNCTIONS: Record<string, FunctionSignature> = {
  add: { args: ["number", "number"], result: arithmetic(0), description: "a + b" },
  subtract: { args: ["number", "number"], result: arithmetic(0), description: "a - b" },
  multiply: {
    args: ["number", "number"],
    result: (args) => {
      const result = arithmetic(0)(args);
      const type = typeOf(result);
      return type?.kind === "decimal" ? known({ ...type, scale: Math.min(18, scale(args[0]) + scale(args[1])) }) : result;
    },
    description: "a × b",
  },
  divide: { args: ["number", "number"], result: arithmetic(6), description: "a ÷ b" },
  round: {
    args: ["number", "integer_literal"],
    result: (args) => known({ kind: "decimal", precision: 38, scale: integerLiteral(args[1]) ?? 0 }),
    description: "a rounded to n decimals",
  },
  abs: { args: ["number"], result: (args) => args[0] ?? { unknown: true }, description: "absolute value" },
  nullif: { args: ["any", "any"], result: (args) => args[0] ?? { unknown: true }, description: "empty when a = b" },
  coalesce: { args: ["any", "any"], rest: "any", result: (args) => args.find((arg) => "type" in arg) ?? args[0] ?? { unknown: true }, description: "first non-empty value" },
  upper: { args: ["text"], result: (args) => args[0] ?? { unknown: true }, description: "upper case" },
  lower: { args: ["text"], result: (args) => args[0] ?? { unknown: true }, description: "lower case" },
  trim: { args: ["text"], result: (args) => args[0] ?? { unknown: true }, description: "without leading and trailing spaces" },
  ltrim_zeros: { args: ["text"], result: (args) => args[0] ?? { unknown: true }, description: "without leading zeros" },
  substring: {
    args: ["text", "integer_literal", "integer_literal"],
    result: (args) => known({ kind: "string", ...(integerLiteral(args[2]) ? { length: integerLiteral(args[2]) } : {}) } as LogicalType),
    description: "part of a text",
  },
  left: { args: ["text", "integer_literal"], result: (args) => known({ kind: "string", ...(integerLiteral(args[1]) ? { length: integerLiteral(args[1]) } : {}) } as LogicalType), description: "first n characters" },
  right: { args: ["text", "integer_literal"], result: (args) => known({ kind: "string", ...(integerLiteral(args[1]) ? { length: integerLiteral(args[1]) } : {}) } as LogicalType), description: "last n characters" },
  length: { args: ["text"], result: () => known({ kind: "integer" }), description: "number of characters" },
  replace: { args: ["text", "text", "text"], result: () => known({ kind: "string" }), description: "text with a part replaced" },
  date_add: { args: ["unit", "number", "date"], result: (args) => args[2] ?? { unknown: true }, description: "date plus n units" },
  date_diff: { args: ["unit", "date", "date"], result: () => known({ kind: "bigint" }), description: "units between two dates" },
  date_trunc: { args: ["unit", "date"], result: (args) => args[1] ?? { unknown: true }, description: "date truncated to a unit" },
  year: { args: ["date"], result: () => known({ kind: "integer" }), description: "year of a date" },
  month: { args: ["date"], result: () => known({ kind: "integer" }), description: "month of a date" },
  day: { args: ["date"], result: () => known({ kind: "integer" }), description: "day of a date" },
};

/** Returns an error message when `value` cannot be used where `kind` is expected, or null. */
export function checkArgument(kind: ArgKind, value: ValueType): string | null {
  if ("unknown" in value) return null;
  if ("literal" in value) {
    switch (kind) {
      case "number":
        return /^-?\d+(\.\d+)?$/.test(value.literal) ? null : `"${value.literal}" is not a number`;
      case "integer_literal":
        return /^\d+$/.test(value.literal) ? null : `"${value.literal}" is not a whole number`;
      case "unit":
        return (DATE_UNITS as readonly string[]).includes(value.literal) ? null : `"${value.literal}" is not a date unit (${DATE_UNITS.join(", ")})`;
      case "date":
        return /^\d{4}-\d{2}-\d{2}/.test(value.literal) ? null : `"${value.literal}" is not a date (YYYY-MM-DD)`;
      default:
        return null;
    }
  }
  const type = value.type;
  switch (kind) {
    case "number":
      return isNumeric(type) ? null : `expected a number, got ${type.kind}`;
    case "text":
      return type.kind === "string" ? null : `expected text, got ${type.kind}`;
    case "date":
      return isTemporal(type) ? null : `expected a date or timestamp, got ${type.kind}`;
    case "unit":
    case "integer_literal":
      return "expected a literal value";
    default:
      return null;
  }
}

/** Is a literal a valid value of the given type (literals are typed by their context, GEN §2.4)? */
export function literalFits(literal: string, type: LogicalType): boolean {
  switch (type.kind) {
    case "integer":
    case "bigint":
      return /^-?\d+$/.test(literal);
    case "decimal":
    case "float":
      return /^-?\d+(\.\d+)?$/.test(literal);
    case "boolean":
      return literal === "true" || literal === "false";
    case "date":
      return /^\d{4}-\d{2}-\d{2}$/.test(literal);
    case "timestamp":
    case "timestamp_tz":
      return /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?)?/.test(literal);
    case "string":
      return type.length === undefined || literal.length <= type.length;
    default:
      return true;
  }
}

export function typeFromText(text: string): LogicalType | undefined {
  return parseLogicalType(text) ?? undefined;
}

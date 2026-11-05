/**
 * Logical types of the metamodel (docs/02-metamodel.md §7, FMT-022) and their compatibility rules.
 */

export type LogicalType =
  | { kind: "boolean" }
  | { kind: "integer" }
  | { kind: "bigint" }
  | { kind: "decimal"; precision: number; scale: number }
  | { kind: "float" }
  | { kind: "string"; length?: number }
  | { kind: "date" }
  | { kind: "time" }
  | { kind: "timestamp" }
  | { kind: "timestamp_tz" }
  | { kind: "binary" }
  | { kind: "json" };

export type LogicalKind = LogicalType["kind"];

const SIMPLE_KINDS = ["boolean", "integer", "bigint", "float", "date", "time", "timestamp", "timestamp_tz", "binary", "json"] as const;
const PATTERN = /^(?<kind>[a-z_]+)(?:\((?<a>\d+)(?:,\s*(?<b>\d+))?\))?$/;

/** Parses `string(10)`, `decimal(15,2)`, `date`… Returns `null` when the text is not a logical type. */
export function parseLogicalType(text: string): LogicalType | null {
  const match = PATTERN.exec(text.trim());
  if (!match?.groups) return null;
  const { kind, a, b } = match.groups;
  if (kind === "string") {
    if (b !== undefined) return null;
    if (a === undefined) return { kind: "string" };
    const length = Number(a);
    return length > 0 ? { kind: "string", length } : null;
  }
  if (kind === "decimal") {
    if (a === undefined) return null;
    const precision = Number(a);
    const scale = b === undefined ? 0 : Number(b);
    if (precision < 1 || precision > 38 || scale > precision) return null;
    return { kind: "decimal", precision, scale };
  }
  if ((SIMPLE_KINDS as readonly string[]).includes(kind ?? "") && a === undefined) {
    return { kind: kind as (typeof SIMPLE_KINDS)[number] } as LogicalType;
  }
  return null;
}

export function formatLogicalType(type: LogicalType): string {
  switch (type.kind) {
    case "string":
      return type.length === undefined ? "string" : `string(${type.length})`;
    case "decimal":
      return `decimal(${type.precision},${type.scale})`;
    default:
      return type.kind;
  }
}

export function isNumeric(type: LogicalType): boolean {
  return type.kind === "integer" || type.kind === "bigint" || type.kind === "decimal" || type.kind === "float";
}

export function isTemporal(type: LogicalType): boolean {
  return type.kind === "date" || type.kind === "time" || type.kind === "timestamp" || type.kind === "timestamp_tz";
}

/** Digits before the decimal point that a numeric type can hold (integer: 10, bigint: 19). */
function integerDigits(type: LogicalType): number | null {
  if (type.kind === "integer") return 10;
  if (type.kind === "bigint") return 19;
  if (type.kind === "decimal") return type.precision - type.scale;
  return null;
}

function scaleOf(type: LogicalType): number {
  return type.kind === "decimal" ? type.scale : 0;
}

/**
 * MM-410: `from` can be used where `to` is expected without an explicit conversion (safe widening, or same type).
 * Everything else needs a `convert` step (MM-411).
 */
export function isImplicitlyAssignable(from: LogicalType, to: LogicalType): boolean {
  if (from.kind === "string" && to.kind === "string") {
    if (to.length === undefined) return true;
    return from.length !== undefined && from.length <= to.length;
  }
  if (from.kind === "float" || to.kind === "float") return from.kind === to.kind;
  const fromDigits = integerDigits(from);
  const toDigits = integerDigits(to);
  if (fromDigits !== null && toDigits !== null) {
    return fromDigits <= toDigits && scaleOf(from) <= scaleOf(to);
  }
  if (from.kind === "date" && (to.kind === "timestamp" || to.kind === "timestamp_tz")) return true;
  if (from.kind === "timestamp" && to.kind === "timestamp_tz") return true;
  return from.kind === to.kind;
}

/** MM-120: two operands can be compared (=, <, in…) when they belong to the same family. */
export function isComparable(a: LogicalType, b: LogicalType): boolean {
  if (isNumeric(a) && isNumeric(b)) return true;
  if (isTemporal(a) && isTemporal(b)) return a.kind !== "time" && b.kind !== "time" ? true : a.kind === b.kind;
  return a.kind === b.kind;
}

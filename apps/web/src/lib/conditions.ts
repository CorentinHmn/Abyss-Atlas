/**
 * Conditions and operands of the metamodel (docs/02-metamodel.md §5.3), as the editor handles them. Short forms
 * (FMT-071) are expanded when a condition is opened, so that every condition has one shape in the forms.
 */
import type { schemas } from "@atlas/core";

export type Condition = schemas.Condition;
export type Operand = string | { value: string } | { param: string } | { calculate: { function: string; args: unknown[] } };
export type Comparison = Extract<Condition, { op: string }>;

export const OPERATORS = ["eq", "ne", "lt", "le", "gt", "ge", "in", "not_in", "between", "like", "is_null", "is_not_null"] as const;
export type Operator = (typeof OPERATORS)[number];

/** What the right side of an operator is: another operand, a list of values, two values, or nothing. */
export function rightSide(op: Operator): "operand" | "values" | "between" | "none" {
  if (op === "in" || op === "not_in") return "values";
  if (op === "between") return "between";
  if (op === "is_null" || op === "is_not_null") return "none";
  return "operand";
}

const RESERVED = ["left", "all", "any", "not", "sql"];

/** FMT-071: `{ a.KEY: b.KEY, … }` is the equality of each pair, combined with "and". */
export function expandCondition(value: unknown): Condition {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return { all: [] } as unknown as Condition;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length > 0 && !keys.some((key) => RESERVED.includes(key)) && keys.every((key) => typeof record[key] === "string")) {
    const all = keys.map((left) => ({ left, op: "eq", right: record[left] as string }) as Comparison);
    return all.length === 1 ? (all[0] as Condition) : { all };
  }
  if ("all" in record) return { all: (record.all as unknown[]).map(expandCondition) };
  if ("any" in record) return { any: (record.any as unknown[]).map(expandCondition) };
  if ("not" in record) return { not: expandCondition(record.not) };
  return record as unknown as Condition;
}

export function emptyComparison(left = ""): Comparison {
  return { left, op: "eq", right: "" } as Comparison;
}

/** `alias.COLUMN` (or `current`): an operand that is a column. */
export function isColumn(operand: unknown): operand is string {
  return typeof operand === "string";
}

export interface SourceColumn {
  /** `alias.COLUMN` */
  ref: string;
  type: string;
  description?: string;
}

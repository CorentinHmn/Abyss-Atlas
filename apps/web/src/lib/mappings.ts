/**
 * Column mappings in the editor (docs/02-metamodel.md §5, FMT §5): one mapping per target column and branch, or one
 * for all branches (`*`). Stored forms are opened as a draft with one shape; a direct copy is written back as
 * `alias.COLUMN`, inputs and steps in their full form.
 */
import type { Condition, Operand } from "./conditions";

export const STEP_KINDS = ["copy", "constant", "default", "convert", "map_values", "case", "calculate", "concat", "lookup", "aggregate", "rule", "sql"] as const;
export type StepKind = (typeof STEP_KINDS)[number];

export type Step =
  | "copy"
  | { constant: { value: string } }
  | { default: { value: string; also_empty?: boolean } }
  | { convert: { to: string; method: "cast" | "parse" | "format"; pattern?: string; on_error: "fail" | "set_null" | "use_default"; default?: string } }
  | { map_values: { mapping: string; on_unmatched: "keep" | "set_null" | "use_default" | "fail" } }
  | { case: { when: { if: Condition; then: Operand }[]; else?: Operand } }
  | { calculate: { function: string; args: Operand[] } }
  | { concat: { parts: Operand[]; separator?: string } }
  | { lookup: { dataset: string; alias: string; match: Condition; return: string; on_missing: "fail" | "set_null" | "use_default"; default?: string } }
  | { aggregate: "sum" | "count" | "count_distinct" | "min" | "max" | "avg" }
  | { rule: { id: string; args: Record<string, Operand> } }
  | { sql: { expression: string; reason: string } };

export type Mode = "empty" | "copy" | "steps" | "not_provided";

export interface MappingDraft {
  mode: Mode;
  /** `copy`: the column copied; `steps`: the inputs. */
  inputs: string[];
  steps: Step[];
  note: string;
  reason: string;
}

export const ALL = "*";

export function stepKind(step: Step): StepKind {
  return step === "copy" ? "copy" : (Object.keys(step)[0] as StepKind);
}

export function newStep(kind: StepKind): Step {
  switch (kind) {
    case "copy":
      return "copy";
    case "constant":
      return { constant: { value: "" } };
    case "default":
      return { default: { value: "" } };
    case "convert":
      return { convert: { to: "string", method: "cast", on_error: "fail" } };
    case "map_values":
      return { map_values: { mapping: "", on_unmatched: "keep" } };
    case "case":
      return { case: { when: [{ if: { left: "current", op: "eq", right: { value: "" } } as Condition, then: { value: "" } }] } };
    case "calculate":
      return { calculate: { function: "add", args: ["current", { value: "0" }] } };
    case "concat":
      return { concat: { parts: ["current", { value: "" }] } };
    case "lookup":
      return { lookup: { dataset: "", alias: "l", match: { all: [] } as unknown as Condition, return: "", on_missing: "set_null" } };
    case "aggregate":
      return { aggregate: "sum" };
    case "rule":
      return { rule: { id: "", args: {} } };
    case "sql":
      return { sql: { expression: "", reason: "" } };
  }
}

/** Opens a stored mapping (string, `not_provided`, or inputs and steps). */
export function openMapping(raw: unknown): MappingDraft {
  const draft: MappingDraft = { mode: "empty", inputs: [], steps: [], note: "", reason: "" };
  if (raw === undefined || raw === null) return draft;
  if (typeof raw === "string") return { ...draft, mode: "copy", inputs: [raw] };
  const record = raw as { not_provided?: string; inputs?: string[]; steps?: Step[]; note?: string };
  if (typeof record.not_provided === "string") return { ...draft, mode: "not_provided", reason: record.not_provided };
  return { ...draft, mode: "steps", inputs: record.inputs ?? [], steps: record.steps ?? [], note: record.note ?? "" };
}

/** Writes a draft back in the shortest form; `undefined` removes the mapping (an empty cell). */
export function storeMapping(draft: MappingDraft): unknown {
  if (draft.mode === "empty") return undefined;
  if (draft.mode === "not_provided") return { not_provided: draft.reason };
  if (draft.mode === "copy") return draft.inputs[0] ?? "";
  // Inputs and steps keep their full form, even with one input and no step yet: the user is writing steps.
  return {
    ...(draft.inputs.length ? { inputs: draft.inputs } : {}),
    ...(draft.steps.length ? { steps: draft.steps } : {}),
    ...(draft.note ? { note: draft.note } : {}),
  };
}

/** The columns (`alias.COLUMN`) a mapping reads: to copy it only where they exist (MAP-046). */
export function referencedColumns(value: unknown): string[] {
  const found = new Set<string>();
  const visit = (node: unknown) => {
    if (typeof node === "string") {
      if (/^[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z0-9_]+$/.test(node)) found.add(node);
      return;
    }
    if (Array.isArray(node)) node.forEach(visit);
    else if (node && typeof node === "object") Object.values(node).forEach(visit);
  };
  visit(value);
  return [...found];
}

/** MAP-023: the one-line summary of a cell. */
export function summarize(raw: unknown): { kind: Mode; text: string; unstructured: boolean } {
  const draft = openMapping(raw);
  const unstructured = draft.steps.some((step) => stepKind(step) === "sql");
  if (draft.mode === "empty") return { kind: "empty", text: "", unstructured };
  if (draft.mode === "not_provided") return { kind: "not_provided", text: draft.reason, unstructured };
  if (draft.mode === "copy") return { kind: "copy", text: draft.inputs[0] ?? "", unstructured };
  const steps = draft.steps.map((step) => {
    const kind = stepKind(step);
    if (step === "copy") return "copy";
    const body = Object.values(step)[0] as Record<string, unknown> | string;
    if (kind === "map_values") return `map_values ${(body as { mapping: string }).mapping}`;
    if (kind === "rule") return `rule ${(body as { id: string }).id}`;
    if (kind === "convert") return `convert ${(body as { to: string }).to}`;
    if (kind === "calculate") return `${(body as { function: string }).function}()`;
    if (kind === "aggregate") return String(body);
    return kind;
  });
  return { kind: "steps", text: [draft.inputs.join(", "), ...steps].filter(Boolean).join(" → "), unstructured };
}

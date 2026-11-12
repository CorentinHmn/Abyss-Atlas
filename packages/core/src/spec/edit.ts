/**
 * The YAML view of one object (docs/05-modules/mapping-editor.md MAP-060…MAP-062): checks an edited file with the
 * same codes as the project validation, and finds the line of a validation issue in a file.
 */
import { isMap, isScalar, isSeq, LineCounter, parseDocument, type Node } from "yaml";
import { codeForZodIssue, describeZodIssue, withoutExtensions } from "./load";
import { schemasByKind, type SpecKind } from "./schemas";
import { formatPath } from "../validate/issues";

export interface EditIssue {
  code: string;
  at: string;
  message: string;
  /** 1-based. */
  line: number;
}

/** `columns.a.from.x.steps[2]` → `["columns", "a", "from", "x", "steps", 2]` */
export function splitPath(at: string): (string | number)[] {
  const parts: (string | number)[] = [];
  for (const piece of at.split(".")) {
    const match = /^([^[]*)((?:\[\d+\])*)$/.exec(piece);
    if (!match) {
      parts.push(piece);
      continue;
    }
    if (match[1]) parts.push(match[1]);
    for (const index of match[2]?.matchAll(/\[(\d+)\]/g) ?? []) parts.push(Number(index[1]));
  }
  return parts.filter((part) => part !== "");
}

/** The node at a path, or its closest existing parent. */
function nodeAt(root: Node | null | undefined, path: (string | number)[]): Node | null {
  let node: Node | null = root ?? null;
  for (const part of path) {
    let next: Node | null = null;
    if (isMap(node)) {
      const pair = node.items.find((item) => (isScalar(item.key) ? item.key.value : item.key) === part);
      next = (pair?.value as Node | null | undefined) ?? (pair?.key as Node | null | undefined) ?? null;
    } else if (isSeq(node) && typeof part === "number") next = (node.items[part] as Node | undefined) ?? null;
    if (!next) break;
    node = next;
  }
  return node;
}

/** The line (1-based) where the value at `at` is written; the closest parent when it is missing; 1 at worst. */
export function lineOf(content: string, at: string): number {
  const counter = new LineCounter();
  const document = parseDocument(content, { version: "1.2", lineCounter: counter, prettyErrors: false });
  const node = nodeAt(document.contents as Node | null, splitPath(at));
  const offset = node?.range?.[0];
  return offset === undefined ? 1 : counter.linePos(offset).line;
}

/**
 * Checks an edited file of one object: YAML syntax, a mapping of the expected kind, the schema of that kind.
 * `spec` is the object (with its extensions) when the file is valid for its schema.
 */
export function checkSpecFile(content: string, kind: SpecKind): { spec?: Record<string, unknown>; issues: EditIssue[] } {
  const counter = new LineCounter();
  const document = parseDocument(content, { version: "1.2", uniqueKeys: true, prettyErrors: false, lineCounter: counter });
  if (document.errors.length > 0) {
    return {
      issues: document.errors.map((error) => ({
        code: error.code === "DUPLICATE_KEY" ? "VAL-018" : "VAL-010",
        at: "",
        message: error.code === "DUPLICATE_KEY" ? `Duplicate key: ${error.message}` : `Invalid YAML: ${error.message}`,
        line: counter.linePos(error.pos[0]).line,
      })),
    };
  }
  const raw = document.toJS() as unknown;
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { issues: [{ code: "VAL-010", at: "", message: "A spec file is a YAML mapping (key: value) at its top level.", line: 1 }] };
  }
  const record = raw as Record<string, unknown>;
  const line = (at: string) => {
    const node = nodeAt(document.contents as Node | null, splitPath(at));
    const offset = node?.range?.[0];
    return offset === undefined ? 1 : counter.linePos(offset).line;
  };
  if (record.kind !== kind) {
    return { issues: [{ code: "VAL-012", at: "kind", message: `This file must stay a ${kind}.`, line: line("kind") }] };
  }
  const result = schemasByKind[kind].safeParse(withoutExtensions(record));
  if (!result.success) {
    return {
      issues: result.error.issues.map((issue) => {
        // An unknown key is shown on its own line, not on the object that holds it.
        const at = formatPath(issue.code === "unrecognized_keys" && issue.keys[0] ? [...issue.path, issue.keys[0]] : issue.path);
        return { code: codeForZodIssue(issue), at, message: describeZodIssue(issue), line: line(at) };
      }),
    };
  }
  return { spec: record, issues: [] };
}

/**
 * Comparison of two versions of a project, object by object and attribute by attribute (`atlas diff`, UC-023).
 */
import type { Project } from "../spec/load";

export type ObjectKind = "project" | "domain" | "system" | "dataset" | "model" | "rule" | "value_mapping";

export interface FieldChange {
  /** Path of the attribute, e.g. `columns.country_code.from.oracle.steps[0]`. */
  path: string;
  before: unknown;
  after: unknown;
}

export interface ObjectChange {
  change: "added" | "removed" | "changed";
  kind: ObjectKind;
  key: string;
  fields: FieldChange[];
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);

function diffValues(before: unknown, after: unknown, path: string, out: FieldChange[]): void {
  if (isPlainObject(before) && isPlainObject(after)) {
    for (const key of [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()) {
      diffValues(before[key], after[key], path ? `${path}.${key}` : key, out);
    }
    return;
  }
  if (Array.isArray(before) && Array.isArray(after) && before.length === after.length) {
    before.forEach((item, index) => diffValues(item, after[index], `${path}[${index}]`, out));
    return;
  }
  if (JSON.stringify(before) !== JSON.stringify(after)) out.push({ path, before, after });
}

function entries(project: Project): [ObjectKind, Map<string, unknown>][] {
  const specs = <T>(map: Map<string, { spec: T }>) => new Map([...map].map(([key, loaded]) => [key, loaded.spec as unknown]));
  return [
    ["project", new Map(project.project ? [[project.project.spec.id, project.project.spec as unknown]] : [])],
    ["domain", specs(project.domains)],
    ["system", specs(project.systems)],
    ["dataset", specs(project.datasets)],
    ["model", specs(project.models)],
    ["rule", specs(project.rules)],
    ["value_mapping", specs(project.valueMappings)],
  ];
}

/** VER-021: the attributes that differ between two versions of one object (canonical form, attribute by attribute). */
export function diffObjects(before: unknown, after: unknown): FieldChange[] {
  const out: FieldChange[] = [];
  diffValues(before, after, "", out);
  return out;
}

export function diffProjects(before: Project, after: Project): ObjectChange[] {
  const changes: ObjectChange[] = [];
  const afterEntries = new Map(entries(after));
  for (const [kind, beforeMap] of entries(before)) {
    const afterMap = afterEntries.get(kind) ?? new Map<string, unknown>();
    for (const key of [...new Set([...beforeMap.keys(), ...afterMap.keys()])].sort()) {
      if (!afterMap.has(key)) changes.push({ change: "removed", kind, key, fields: [] });
      else if (!beforeMap.has(key)) changes.push({ change: "added", kind, key, fields: [] });
      else {
        const fields: FieldChange[] = [];
        diffValues(beforeMap.get(key), afterMap.get(key), "", fields);
        if (fields.length > 0) changes.push({ change: "changed", kind, key, fields });
      }
    }
  }
  return changes;
}

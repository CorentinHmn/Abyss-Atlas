/**
 * From stored spec objects back to the files of a project export (docs/03-spec-format.md §3), so that validation,
 * generation and the YAML view work on exactly what an export contains.
 */
import { stringify } from "yaml";
import { datasetToYaml } from "../import/dictionary";
import type { SpecFile } from "./load";
import { datasetSchema, type SpecKind } from "./schemas";

/** FMT-003: where an object of each kind lives in an export. */
export function specPath(kind: SpecKind, spec: Record<string, unknown>): string {
  switch (kind) {
    case "project":
      return "atlas.yaml";
    case "domain":
      return `domains/${String(spec.code)}.yaml`;
    case "system":
      return `systems/${String(spec.id)}/system.yaml`;
    case "dataset":
      return `systems/${String(spec.system)}/datasets/${String(spec.id)}.yaml`;
    case "model":
      return `models/${String(spec.domain)}/${String(spec.id)}.yaml`;
    case "rule":
      return `rules/${String(spec.domain)}/${String(spec.id)}.yaml`;
    case "value_mapping":
      return `value-mappings/${String(spec.domain)}/${String(spec.id)}.yaml`;
  }
}

/** The key that identifies an object within its kind in a project (a dataset is `system.dataset`). */
export function specKey(kind: SpecKind, spec: Record<string, unknown>): string {
  if (kind === "dataset") return `${String(spec.system)}.${String(spec.id)}`;
  if (kind === "domain") return String(spec.code);
  if (kind === "project") return "project";
  return String(spec.id);
}

/** Writes a stored object as its export file. Datasets keep their one-line-per-column layout (FMT §4.1). */
export function specToFile(kind: SpecKind, spec: Record<string, unknown>): SpecFile {
  const path = specPath(kind, spec);
  if (kind === "dataset") {
    const parsed = datasetSchema.safeParse(spec);
    if (parsed.success) return { path, content: datasetToYaml(parsed.data) };
  }
  return { path, content: stringify(spec, { version: "1.2", lineWidth: 120 }) };
}

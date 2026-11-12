/**
 * Reads the files of a project export (docs/03-spec-format.md §3) into typed objects.
 * Takes file contents, never touches a file system: the same code runs in the browser, the server and the CLI.
 */
import { parseDocument } from "yaml";
import type { z } from "zod";
import { formatPath, IssueList } from "../validate/issues";
import { specPath } from "./serialize";
import {
  schemasByKind,
  type DatasetSpec,
  type DomainSpec,
  type ModelSpec,
  type ProjectSpec,
  type RuleSpec,
  type SpecKind,
  type SystemSpec,
  type ValueMappingSpec,
} from "./schemas";

export interface SpecFile {
  /** Path relative to the project root, with `/` separators. */
  path: string;
  content: string;
}

export interface Loaded<T> {
  path: string;
  spec: T;
}

export interface Project {
  project?: Loaded<ProjectSpec>;
  domains: Map<string, Loaded<DomainSpec>>;
  systems: Map<string, Loaded<SystemSpec>>;
  /** Keyed by `system.dataset`. */
  datasets: Map<string, Loaded<DatasetSpec>>;
  models: Map<string, Loaded<ModelSpec>>;
  rules: Map<string, Loaded<RuleSpec>>;
  valueMappings: Map<string, Loaded<ValueMappingSpec>>;
}

/** FMT-012: keys starting with `x_` are extensions, ignored by validation. */
export function withoutExtensions(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutExtensions);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !key.startsWith("x_"))
        .map(([key, child]) => [key, withoutExtensions(child)]),
    );
  }
  return value;
}

/** Zod reports a failed union as one issue holding the issues of every alternative: look inside for the real cause. */
function innermostIssues(issue: z.core.$ZodIssue): z.core.$ZodIssue[] {
  if (issue.code !== "invalid_union") return [issue];
  return issue.errors.flat().flatMap(innermostIssues);
}

/** The most useful issue: one that names a requirement (FMT-xxx, MM-xxx), else the issue itself. */
function explainIssue(issue: z.core.$ZodIssue): z.core.$ZodIssue {
  return innermostIssues(issue).find((inner) => /\b(FMT|MM)-\d{3}\b|Domain codes/.test(inner.message)) ?? issue;
}

export function codeForZodIssue(issue: z.core.$ZodIssue): string {
  const explained = explainIssue(issue);
  if (explained.code === "unrecognized_keys") return "VAL-012";
  if (explained.message.includes("FMT-020")) return "VAL-015";
  if (explained.message.includes("MM-600") || explained.message.includes("Domain codes")) return "VAL-016";
  if (explained.message.includes("FMT-002")) return "VAL-011";
  if (explained.message.includes("MM-210")) return "VAL-045";
  return "VAL-013";
}

export function describeZodIssue(issue: z.core.$ZodIssue): string {
  const explained = explainIssue(issue);
  if (explained.code === "unrecognized_keys") return `Unknown key(s): ${explained.keys.join(", ")} (extensions start with x_).`;
  if (explained.code === "invalid_union") return "This value does not match any allowed form (see docs/03-spec-format.md).";
  return explained.message;
}

const KINDS = Object.keys(schemasByKind) as SpecKind[];

export function loadProject(files: SpecFile[]): { project: Project; issues: IssueList } {
  const issues = new IssueList();
  const project: Project = {
    domains: new Map(),
    systems: new Map(),
    datasets: new Map(),
    models: new Map(),
    rules: new Map(),
    valueMappings: new Map(),
  };

  for (const file of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    if (!file.path.endsWith(".yaml") || file.path.startsWith("approvals/")) continue;

    const document = parseDocument(file.content, { version: "1.2", uniqueKeys: true, prettyErrors: false });
    if (document.errors.length > 0) {
      for (const error of document.errors) {
        const duplicate = error.code === "DUPLICATE_KEY";
        issues.error(duplicate ? "VAL-018" : "VAL-010", file.path, "", duplicate ? `Duplicate key: ${error.message}` : `Invalid YAML: ${error.message}`);
      }
      continue;
    }
    const raw = withoutExtensions(document.toJS());
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
      issues.error("VAL-010", file.path, "", "A spec file is a YAML mapping (key: value) at its top level.");
      continue;
    }
    const record = raw as Record<string, unknown>;
    const kind = record.kind;
    if (typeof kind !== "string" || !KINDS.includes(kind as SpecKind)) {
      issues.error("VAL-012", file.path, "kind", `Unknown or missing kind: ${String(kind)}. Expected one of ${KINDS.join(", ")}.`);
      continue;
    }

    const result = schemasByKind[kind as SpecKind].safeParse(record);
    if (!result.success) {
      for (const issue of result.error.issues) {
        issues.error(codeForZodIssue(issue), file.path, formatPath(issue.path), describeZodIssue(issue));
      }
      continue;
    }

    const expected = specPath(kind as SpecKind, record);
    if (expected !== file.path) {
      issues.error("VAL-014", file.path, "", `This ${kind} must be in ${expected} (FMT-003).`);
    }

    const add = <T>(map: Map<string, Loaded<T>>, key: string, spec: T, label: string) => {
      const existing = map.get(key);
      if (existing) {
        issues.error("VAL-017", file.path, "", `${label} ${key} is already defined in ${existing.path}.`);
        return;
      }
      map.set(key, { path: file.path, spec });
    };

    switch (result.data.kind) {
      case "project":
        if (project.project) issues.error("VAL-017", file.path, "", `A project is already defined in ${project.project.path}.`);
        else project.project = { path: file.path, spec: result.data };
        break;
      case "domain":
        add(project.domains, result.data.code, result.data, "Domain");
        break;
      case "system":
        add(project.systems, result.data.id, result.data, "System");
        break;
      case "dataset":
        add(project.datasets, `${result.data.system}.${result.data.id}`, result.data, "Dataset");
        break;
      case "model":
        add(project.models, result.data.id, result.data, "Model");
        break;
      case "rule":
        add(project.rules, result.data.id, result.data, "Rule");
        break;
      case "value_mapping":
        add(project.valueMappings, result.data.id, result.data, "Value mapping");
        break;
    }
  }

  if (!project.project) issues.error("VAL-013", "atlas.yaml", "", "The project file atlas.yaml is missing (FMT-050).");
  return { project, issues };
}

/**
 * MAP-026: the generated dbt SQL of one model (ARC-030). Only the model, the models it reads (recursively) and the
 * project's sources, rules and value mappings are generated, so that problems elsewhere do not hide the preview.
 */
import { generateDbt, validateProject } from "@atlas/core";
import { type DomainRow, type ProjectRow, projectFiles, type StoredObject } from "./spec";

export type SqlPreview = { sql: string } | { errors: { file: string; code: string; at: string; message: string }[] };

function readsModels(content: Record<string, unknown>): string[] {
  const found: string[] = [];
  const branches = (content.branches as Record<string, { datasets?: Record<string, string>[] }> | undefined) ?? {};
  for (const branch of Object.values(branches)) for (const use of branch.datasets ?? []) found.push(...Object.values(use));
  const visit = (node: unknown) => {
    if (Array.isArray(node)) node.forEach(visit);
    else if (node && typeof node === "object") {
      for (const [key, value] of Object.entries(node)) {
        if (key === "lookup" && value && typeof value === "object" && "dataset" in value) found.push(String((value as { dataset: unknown }).dataset));
        else visit(value);
      }
    }
  };
  visit(content.columns);
  return found;
}

export function previewModelSql(project: ProjectRow, objects: StoredObject[], domains: DomainRow[], modelId: string): SqlPreview | null {
  const models = new Map(objects.filter((object) => object.kind === "model").map((object) => [object.key, object]));
  const target = models.get(modelId);
  if (!target) return null;
  const needed = new Set<string>();
  const queue = [modelId];
  while (queue.length) {
    const id = queue.pop() as string;
    if (needed.has(id)) continue;
    needed.add(id);
    const model = models.get(id);
    if (model) for (const ref of readsModels(model.content)) if (models.has(ref)) queue.push(ref);
  }
  const subset = objects.filter((object) => object.kind !== "model" || needed.has(object.key));
  const result = validateProject(projectFiles(project, subset, domains));
  if (result.errors > 0) {
    return {
      errors: result.issues
        .filter((issue) => issue.severity === "error")
        .map((issue) => ({ file: issue.file, code: issue.code, at: issue.at, message: issue.message })),
    };
  }
  const path = `models/${String(target.content.domain)}/${modelId}.sql`;
  const file = generateDbt(result).find((item) => item.path === path);
  return file ? { sql: file.content } : { errors: [] };
}

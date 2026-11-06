/**
 * Builders of target models (docs/02-metamodel.md §4) for the editor. Keys follow the order of the export files
 * (docs/03-spec-format.md), so that a model written in Atlas reads like the reference project.
 */

export const LAYERS = ["staging", "intermediate", "mart"] as const;
export const MATERIALIZATIONS = ["table", "view", "incremental"] as const;
export const CLASSIFICATIONS = ["public", "internal", "confidential", "personal"] as const;

export type ModelContent = Record<string, unknown> & {
  id: string;
  name: string;
  domain: string;
  description: string;
  grain: { description: string; key: string[] };
  branches: Record<string, unknown>;
  columns: Record<string, TargetColumn>;
};

export type TargetColumn = {
  definition: string;
  type: string;
  nullable: boolean;
  key?: boolean | undefined;
  classification?: (typeof CLASSIFICATIONS)[number] | undefined;
  quality?: unknown[];
  tags?: string[];
  from: Record<string, unknown>;
};

const ORDER = ["atlas", "kind", "id", "name", "domain", "description", "grain", "layer", "materialization", "branches", "consolidation", "columns", "quality", "tags"];
const COLUMN_ORDER = ["definition", "type", "nullable", "key", "classification", "quality", "tags", "from"];

function ordered<T extends Record<string, unknown>>(value: T, order: string[]): T {
  const result: Record<string, unknown> = {};
  for (const key of order) if (value[key] !== undefined) result[key] = value[key];
  for (const key of Object.keys(value)) if (!(key in result) && value[key] !== undefined) result[key] = value[key];
  return result as T;
}

/** The object as stored: keys in file order, the grain key following the key columns. */
export function normalizeModel(model: ModelContent): ModelContent {
  const columns: Record<string, TargetColumn> = {};
  for (const [name, column] of Object.entries(model.columns)) {
    const clean = { ...column };
    if (!clean.key) delete clean.key;
    if (!clean.classification) delete clean.classification;
    columns[name] = ordered(clean, COLUMN_ORDER);
  }
  const keys = Object.entries(columns).filter(([, column]) => column.key).map(([name]) => name);
  return ordered({ ...model, atlas: 1, kind: "model", grain: { ...model.grain, key: keys.length ? keys : model.grain.key }, columns }, ORDER);
}

export function emptyModel(fields: { id: string; name: string; domain: string; description: string; grain: string }): ModelContent {
  return normalizeModel({
    atlas: 1,
    kind: "model",
    id: fields.id,
    name: fields.name,
    domain: fields.domain,
    description: fields.description,
    grain: { description: fields.grain, key: [] },
    branches: {},
    columns: {},
  } as ModelContent);
}

/** MAP-012: target columns from a source dataset, and a first branch that copies them (Q-MAP-02). */
export function modelFromDataset(
  fields: { id: string; name: string; domain: string; description: string; grain: string },
  dataset: { system: string; id: string; columns: Record<string, { type?: string; nullable?: boolean; description?: string }>; primary_key?: string[] },
  systemName: string,
): ModelContent {
  const branch = dataset.system;
  const columns: Record<string, TargetColumn> = {};
  for (const [source, column] of Object.entries(dataset.columns)) {
    const name = source.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "") || "column";
    if (columns[name]) continue;
    const key = dataset.primary_key?.includes(source) ?? false;
    columns[name] = {
      definition: column.description || source,
      type: column.type || "string",
      nullable: column.nullable !== false && !key,
      ...(key ? { key: true } : {}),
      from: { [branch]: `s.${source}` },
    };
  }
  return normalizeModel({
    ...emptyModel(fields),
    branches: { [branch]: { label: systemName, source_tag: branch.toUpperCase(), datasets: [{ s: `${dataset.system}.${dataset.id}` }] } },
    columns,
  });
}

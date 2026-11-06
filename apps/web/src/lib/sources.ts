/**
 * Builders of source objects (docs/02-metamodel.md §3.3–3.4) from what the screens send. Keys are written in the
 * order of the export files (docs/03-spec-format.md §4), so that stored objects read like the files. Shared by the
 * browser (column grid) and the server (actions).
 */
import { DIALECTS, type Dialect } from "@atlas/core";

export const SYSTEM_TYPES = ["erp", "mes", "crm", "database", "file", "api", "other"] as const;
export const DATASET_TYPES = ["table", "view", "file", "other"] as const;

export interface SystemDraft {
  id: string;
  name: string;
  systemType: (typeof SYSTEM_TYPES)[number];
  product: string;
  description: string;
  landingDatabase: string;
  landingSchema: string;
  namingPattern: string;
}

export function systemSpec(draft: SystemDraft): Record<string, unknown> {
  const landing =
    draft.landingDatabase || draft.landingSchema
      ? { landing: { database: draft.landingDatabase, schema: draft.landingSchema, ...(draft.namingPattern ? { naming_pattern: draft.namingPattern } : {}) } }
      : {};
  return {
    atlas: 1,
    kind: "system",
    id: draft.id,
    name: draft.name,
    system_type: draft.systemType,
    ...(draft.product ? { product: draft.product } : {}),
    ...(draft.description ? { description: draft.description } : {}),
    ...landing,
  };
}

export interface ColumnDraft {
  name: string;
  nativeType: string;
  type: string;
  nullable: boolean;
  keyPosition: number | null;
  description: string;
}

export interface DatasetDraft {
  id: string;
  system: string;
  name: string;
  datasetType: (typeof DATASET_TYPES)[number];
  namespace: string;
  description: string;
  landingName: string;
  origin: { method: "manual" | "file_import"; date: string };
  columns: ColumnDraft[];
}

export function datasetSpec(draft: DatasetDraft): Record<string, unknown> {
  const keyColumns = draft.columns
    .filter((column) => column.keyPosition !== null && column.name)
    .sort((a, b) => (a.keyPosition ?? 0) - (b.keyPosition ?? 0))
    .map((column) => column.name);
  const columns: Record<string, unknown> = {};
  for (const column of draft.columns) {
    if (!column.name.trim()) continue;
    columns[column.name.trim()] = {
      ...(column.nativeType ? { native_type: column.nativeType } : {}),
      type: column.type,
      ...(column.nullable ? {} : { nullable: false }),
      ...(column.description ? { description: column.description } : {}),
    };
  }
  return {
    atlas: 1,
    kind: "dataset",
    id: draft.id,
    system: draft.system,
    name: draft.name,
    ...(draft.namespace ? { namespace: draft.namespace } : {}),
    dataset_type: draft.datasetType,
    ...(draft.description ? { description: draft.description } : {}),
    ...(keyColumns.length ? { primary_key: keyColumns } : {}),
    ...(draft.landingName ? { landing_name: draft.landingName } : {}),
    metadata_origin: draft.origin,
    columns,
  };
}

/** The grid works on drafts; a stored dataset becomes one. */
export function datasetDraft(spec: Record<string, unknown>): DatasetDraft {
  const keys = (spec.primary_key as string[] | undefined) ?? [];
  const columns = (spec.columns ?? {}) as Record<string, { native_type?: string; type?: string; nullable?: boolean; description?: string }>;
  return {
    id: String(spec.id ?? ""),
    system: String(spec.system ?? ""),
    name: String(spec.name ?? ""),
    datasetType: (spec.dataset_type as DatasetDraft["datasetType"]) ?? "table",
    namespace: String(spec.namespace ?? ""),
    description: String(spec.description ?? ""),
    landingName: String(spec.landing_name ?? ""),
    origin: (spec.metadata_origin as DatasetDraft["origin"]) ?? { method: "manual", date: today() },
    columns: Object.entries(columns).map(([name, column]) => ({
      name,
      nativeType: column.native_type ?? "",
      type: column.type ?? "",
      nullable: column.nullable !== false,
      keyPosition: keys.includes(name) ? keys.indexOf(name) + 1 : null,
      description: column.description ?? "",
    })),
  };
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** The dialect used to translate native types, guessed from the system's product (SRC-013); the user can change it. */
export function guessDialect(product: string | undefined): Dialect {
  const text = (product ?? "").toLowerCase();
  if (text.includes("sap")) return "sap";
  if (text.includes("oracle")) return "oracle";
  if (text.includes("sql server") || text.includes("sqlserver") || text.includes("azure sql")) return "sqlserver";
  if (text.includes("postgres")) return "postgresql";
  return DIALECTS[0];
}

/**
 * Import of a dictionary CSV into source datasets (docs/05-modules/import-export.md §1, UC-001, UC-003).
 * Never reads data (IE-005): only the description of tables and columns.
 */
import type { GeneratedFile } from "../generate/dbt";
import type { DatasetSpec } from "../spec/schemas";
import { parseCsv } from "./csv";
import { logicalTypeFor, type Dialect } from "./native-types";

export const DICTIONARY_COLUMNS = ["dataset", "column", "native_type", "nullable", "primary_key_position", "description", "dataset_description", "namespace"] as const;
const REQUIRED = ["dataset", "column", "native_type"] as const;

export interface DictionaryImportOptions {
  csv: string;
  /** System the tables belong to (IE-002). */
  system: string;
  dialect: Dialect;
  /** Datasets already in the project, keyed by dataset id, to update instead of replacing (IE-004). */
  existing: Map<string, DatasetSpec>;
  /** Date of the import, written in metadata_origin (YYYY-MM-DD). */
  date: string;
  method?: "file_import";
}

export interface DictionaryImportReport {
  created: string[];
  updated: string[];
  /** Native types that could not be translated; imported as `string` (IE-003). */
  unknownTypes: { dataset: string; column: string; nativeType: string }[];
  /** Columns present in Atlas but not in the file: kept, never deleted silently (IE-004). */
  missingColumns: { dataset: string; column: string }[];
  errors: string[];
}

/** IE-002: dataset id = table name in lowercase, made valid for MM-600. */
export function datasetIdFor(table: string): string {
  return (
    table
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "") || "dataset"
  );
}

function parseBoolean(value: string | undefined): boolean | undefined {
  const v = (value ?? "").trim().toLowerCase();
  if (["true", "yes", "y", "1"].includes(v)) return true;
  if (["false", "no", "n", "0"].includes(v)) return false;
  return undefined;
}

const quote = (text: string) => JSON.stringify(text);

/** Writes a dataset in the layout of docs/03-spec-format.md §4.1 (one line per column). */
export function datasetToYaml(dataset: DatasetSpec): string {
  const names = Object.keys(dataset.columns);
  const width = Math.max(0, ...names.map((name) => name.length));
  const lines = [
    "atlas: 1",
    "kind: dataset",
    `id: ${dataset.id}`,
    `system: ${dataset.system}`,
    `name: ${quote(dataset.name)}`,
    ...(dataset.namespace ? [`namespace: ${quote(dataset.namespace)}`] : []),
    `dataset_type: ${dataset.dataset_type}`,
    ...(dataset.description ? [`description: ${quote(dataset.description)}`] : []),
    ...(dataset.primary_key?.length ? [`primary_key: [${dataset.primary_key.map(quote).join(", ")}]`] : []),
    ...(dataset.landing_name ? [`landing_name: ${quote(dataset.landing_name)}`] : []),
    `metadata_origin: { method: ${dataset.metadata_origin.method}, date: ${quote(dataset.metadata_origin.date)} }`,
    "columns:",
  ];
  for (const name of names) {
    const column = dataset.columns[name];
    if (!column) continue;
    const parts = [
      ...(column.native_type ? [`native_type: ${quote(column.native_type)}`] : []),
      `type: ${quote(column.type)}`,
      ...(column.nullable === false ? ["nullable: false"] : []),
      ...(column.description ? [`description: ${quote(column.description)}`] : []),
    ];
    const key = /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : quote(name);
    lines.push(`  ${key}:${" ".repeat(Math.max(1, width - key.length + 1))}{ ${parts.join(", ")} }`);
  }
  return `${lines.join("\n")}\n`;
}

export function importDictionary(options: DictionaryImportOptions): { files: GeneratedFile[]; report: DictionaryImportReport } {
  const report: DictionaryImportReport = { created: [], updated: [], unknownTypes: [], missingColumns: [], errors: [] };
  const rows = parseCsv(options.csv);
  const header = (rows[0] ?? []).map((cell) => cell.trim().toLowerCase());
  for (const required of REQUIRED) {
    if (!header.includes(required)) report.errors.push(`The file has no "${required}" column. Expected columns: ${DICTIONARY_COLUMNS.join(", ")}.`);
  }
  if (report.errors.length > 0) return { files: [], report };
  const index = (name: string) => header.indexOf(name);
  const get = (row: string[], name: string) => {
    const i = index(name);
    return i >= 0 ? (row[i] ?? "").trim() : "";
  };

  interface TableDraft {
    name: string;
    description: string;
    namespace: string;
    columns: Map<string, { native: string; type: string; nullable?: boolean; description: string; pk?: number }>;
  }
  const tables = new Map<string, TableDraft>();
  rows.slice(1).forEach((row, i) => {
    const table = get(row, "dataset");
    const column = get(row, "column");
    const native = get(row, "native_type");
    if (!table || !column || !native) {
      report.errors.push(`Line ${i + 2}: dataset, column and native_type are required.`);
      return;
    }
    const id = datasetIdFor(table);
    const draft = tables.get(id) ?? { name: table, description: get(row, "dataset_description"), namespace: get(row, "namespace"), columns: new Map() };
    tables.set(id, draft);
    let type = logicalTypeFor(native, options.dialect);
    if (!type) {
      report.unknownTypes.push({ dataset: id, column, nativeType: native });
      type = "string";
    }
    const pk = Number(get(row, "primary_key_position"));
    const nullable = parseBoolean(get(row, "nullable"));
    draft.columns.set(column, {
      native,
      type,
      ...(nullable !== undefined ? { nullable } : {}),
      description: get(row, "description"),
      ...(Number.isInteger(pk) && pk > 0 ? { pk } : {}),
    });
  });

  const files: GeneratedFile[] = [];
  for (const [id, draft] of [...tables].sort(([a], [b]) => a.localeCompare(b))) {
    const previous = options.existing.get(id);
    const columns: DatasetSpec["columns"] = {};
    const names = [...Object.keys(previous?.columns ?? {}), ...[...draft.columns.keys()].filter((name) => !(name in (previous?.columns ?? {})))];
    for (const name of names) {
      const imported = draft.columns.get(name);
      const kept = previous?.columns[name];
      if (!imported) {
        if (kept) {
          columns[name] = kept;
          report.missingColumns.push({ dataset: id, column: name });
        }
        continue;
      }
      const description = kept?.description || imported.description;
      columns[name] = {
        native_type: imported.native,
        type: imported.type,
        ...(imported.nullable === false ? { nullable: false } : imported.nullable === true ? { nullable: true } : kept?.nullable !== undefined ? { nullable: kept.nullable } : {}),
        ...(description ? { description } : {}),
      };
    }
    const pk = [...draft.columns].filter(([, c]) => c.pk !== undefined).sort(([, a], [, b]) => (a.pk ?? 0) - (b.pk ?? 0)).map(([name]) => name);
    const description = previous?.description || draft.description;
    const namespace = draft.namespace || previous?.namespace;
    const dataset: DatasetSpec = {
      atlas: 1,
      kind: "dataset",
      id,
      system: options.system,
      name: draft.name,
      ...(namespace ? { namespace } : {}),
      dataset_type: previous?.dataset_type ?? "table",
      ...(description ? { description } : {}),
      ...(pk.length ? { primary_key: pk } : previous?.primary_key ? { primary_key: previous.primary_key } : {}),
      ...(previous?.landing_name ? { landing_name: previous.landing_name } : {}),
      metadata_origin: { method: options.method ?? "file_import", date: options.date },
      columns,
    };
    (previous ? report.updated : report.created).push(id);
    files.push({ path: `systems/${options.system}/datasets/${id}.yaml`, content: datasetToYaml(dataset) });
  }
  return { files, report };
}

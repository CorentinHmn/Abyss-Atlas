/**
 * History of a project (docs/05-modules/versioning.md): the timeline, named versions, the state of the project at a
 * named version, and the changes between two versions of an object described in business terms (VER-021).
 */
import { diffObjects, type FieldChange, splitPath } from "@atlas/core";
import { createSupabaseServerClient } from "./supabase/server";
import type { StoredKind } from "./spec";

export const KINDS: StoredKind[] = ["model", "rule", "value_mapping", "dataset", "system"];

export interface Author {
  name: string;
  email: string;
}

export interface VersionRow {
  id: number;
  kind: StoredKind;
  key: string;
  change: "edit" | "import" | "copy" | "restore" | "delete";
  authors: Author[];
  createdAt: string;
  updatedAt: string;
  content: Record<string, unknown> | null;
  previous: Record<string, unknown> | null;
}

export interface NamedVersion {
  id: string;
  name: string;
  description: string;
  mark: number;
  createdAt: string;
  author: Author;
}

export interface HistoryFilters {
  kind?: StoredKind | undefined;
  key?: string | undefined;
  author?: string | undefined;
  before?: number | undefined;
}

const authorsOf = (raw: unknown): Author[] =>
  Array.isArray(raw) ? raw.map((item: { name?: string; email?: string }) => ({ name: item.name ?? item.email ?? "", email: item.email ?? "" })) : [];

/** VER-010, VER-011: one page of the timeline, newest first. */
export async function getHistory(projectId: string, filters: HistoryFilters, limit = 50): Promise<VersionRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.schema("app").rpc("project_history", {
    project: projectId,
    max_rows: limit,
    ...(filters.before ? { before_id: filters.before } : {}),
    ...(filters.kind ? { object_kind: filters.kind } : {}),
    ...(filters.key ? { object_key: filters.key } : {}),
    ...(filters.author ? { author_email: filters.author } : {}),
  });
  return (data ?? []).map((row) => ({
    id: Number(row.id),
    kind: row.kind as StoredKind,
    key: row.key,
    change: row.change,
    authors: authorsOf(row.authors),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    content: (row.content as Record<string, unknown> | null) ?? null,
    previous: (row.previous as Record<string, unknown> | null) ?? null,
  }));
}

/** One version of an object, by its id (with the content before it). */
export async function getVersion(projectId: string, id: number): Promise<VersionRow | null> {
  const [row] = await getHistory(projectId, { before: id + 1 }, 1);
  return row && row.id === id ? row : null;
}

export async function getNamedVersions(projectId: string): Promise<NamedVersion[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .schema("app")
    .from("named_versions")
    .select("id, name, description, last_version_id, created_at, created_by")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    mark: Number(row.last_version_id),
    createdAt: row.created_at,
    author: authorsOf([row.created_by])[0] ?? { name: "", email: "" },
  }));
}

/** VER-022, VER-041: the objects of the project as they were at a named version. */
export async function projectAt(projectId: string, mark: number): Promise<{ kind: StoredKind; key: string; content: Record<string, unknown>; hash: string }[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.schema("app").rpc("project_at", { project: projectId, mark });
  return (data ?? []).map((row) => ({ kind: row.kind as StoredKind, key: row.key, content: row.content as Record<string, unknown>, hash: row.hash }));
}

/** A change in business terms: a message key of the `History.what` namespace and its values. */
export interface Described {
  what: string;
  values: Record<string, string>;
  before?: unknown;
  after?: unknown;
}

function describeField(kind: StoredKind, field: FieldChange): Described {
  const path = splitPath(field.path).map(String);
  const added = field.before === undefined;
  const removed = field.after === undefined;
  const state = added ? "Added" : removed ? "Removed" : "Changed";
  const [first = "", second = "", third = "", fourth = ""] = path;
  const scalar = { before: field.before, after: field.after };
  if (kind === "model") {
    if (first === "columns" && path.length === 2) return { what: `column${state}`, values: { column: second } };
    if (first === "columns" && third === "from" && fourth) return { what: path.length === 4 ? `mapping${state}` : "mappingChanged", values: { column: second, branch: fourth } };
    if (first === "columns" && third === "quality") return { what: "columnChecksChanged", values: { column: second } };
    if (first === "columns" && third) return { what: "columnAttribute", values: { column: second, attribute: path.slice(2).join(".") }, ...scalar };
    if (first === "branches" && path.length === 2) return { what: `branch${state}`, values: { branch: second } };
    if (first === "branches") return { what: "branchChanged", values: { branch: second, part: third } };
    if (first === "consolidation") return { what: "consolidationChanged", values: {} };
    if (first === "quality") return { what: "modelChecksChanged", values: {} };
    if (first === "grain") return { what: "grainChanged", values: {}, ...scalar };
  }
  if (kind === "dataset" && first === "columns" && second) {
    return path.length === 2 ? { what: `datasetColumn${state}`, values: { column: second } } : { what: "columnAttribute", values: { column: second, attribute: path.slice(2).join(".") }, ...scalar };
  }
  if (kind === "rule" && first === "parameters" && second) return { what: `parameter${state}`, values: { parameter: second }, ...scalar };
  if (kind === "rule" && first === "logic") return { what: "logicChanged", values: {} };
  if (kind === "value_mapping" && first === "entries" && second) return { what: `entry${state}`, values: { value: second }, ...scalar };
  return { what: "attributeChanged", values: { attribute: field.path || first }, ...scalar };
}

/** VER-021: the changes between two versions of an object, each described once. */
export function describeChanges(kind: StoredKind, before: unknown, after: unknown): Described[] {
  const seen = new Set<string>();
  const result: Described[] = [];
  for (const field of diffObjects(before ?? {}, after ?? {})) {
    const described = describeField(kind, field);
    const id = described.what + JSON.stringify(described.values);
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(described);
  }
  return result;
}

/** The link to an object's editor, when it still exists. */
export function objectHref(slug: string, kind: StoredKind, key: string, content: Record<string, unknown> | null): string | null {
  if (kind === "model") return `/p/${slug}/models/${key}`;
  if (kind === "rule") return `/p/${slug}/rules/${key}`;
  if (kind === "value_mapping") return `/p/${slug}/value-mappings/${key}`;
  if (kind === "system") return `/p/${slug}/sources`;
  if (kind === "dataset" && content) return `/p/${slug}/sources/${String(content.system)}/${String(content.id)}`;
  return null;
}

/** What a version did, as the timeline shows it: a restore or a deletion first, then a creation (no version before). */
export function changeOf(row: VersionRow): "create" | VersionRow["change"] {
  if (row.change === "restore" || row.change === "delete") return row.change;
  return row.previous === null ? "create" : row.change;
}

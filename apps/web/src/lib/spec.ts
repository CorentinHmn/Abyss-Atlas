import { cache } from "react";
import { contentHash, type Issue, specKey, specPath, specToFile, type SpecFile, type SpecKind, validateProject } from "@atlas/core";
import type { Json } from "@/lib/database/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type StoredKind = Exclude<SpecKind, "project" | "domain">;
export type Change = "edit" | "import" | "copy" | "restore";

export interface ProjectRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  archivedAt: string | null;
}

export interface StoredObject {
  kind: StoredKind;
  key: string;
  path: string;
  content: Record<string, unknown>;
  updatedAt: string;
  updatedByName: string | null;
}

/** A project of the user's organization, by its readable identifier (NAV-020). RLS keeps other organizations out. */
export const getProject = cache(async (slug: string): Promise<ProjectRow | null> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.schema("app").from("projects").select("id, slug, name, description, archived_at").eq("slug", slug).maybeSingle();
  return data ? { id: data.id, slug: data.slug, name: data.name, description: data.description, archivedAt: data.archived_at } : null;
});

export const getObjects = cache(async (projectId: string): Promise<StoredObject[]> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .schema("app")
    .from("spec_objects")
    .select("kind, key, path, content, updated_at, updated_by_name")
    .eq("project_id", projectId)
    .order("key");
  return (data ?? []).map((row) => ({
    kind: row.kind as StoredKind,
    key: row.key,
    path: row.path,
    content: row.content as Record<string, unknown>,
    updatedAt: row.updated_at,
    updatedByName: row.updated_by_name,
  }));
});

/** The project file (atlas.yaml) comes from the project's own settings. Snowflake only in v1 (UC-030). */
export function projectSpec(project: ProjectRow): Record<string, unknown> {
  return {
    atlas: 1,
    kind: "project",
    id: project.slug,
    name: project.name,
    ...(project.description ? { description: project.description } : {}),
    target_platform: "snowflake",
  };
}

export interface DomainRow {
  code: string;
  name: string;
  description: string;
  ownerEmail: string;
  stewardEmails: string[];
  retiredAt: string | null;
}

/** The organization's catalogue of domains (ADM-050), read with the user's rights. */
export const getDomains = cache(async (): Promise<DomainRow[]> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.schema("app").from("domains").select("code, name, description, owner_email, steward_emails, retired_at").order("code");
  return (data ?? []).map((row) => ({
    code: row.code,
    name: row.name,
    description: row.description,
    ownerEmail: row.owner_email,
    stewardEmails: row.steward_emails,
    retiredAt: row.retired_at,
  }));
});

/** A domain as its export file (MM-026): the export carries the domains its objects use. */
export function domainSpec(domain: DomainRow): Record<string, unknown> {
  return {
    atlas: 1,
    kind: "domain",
    code: domain.code,
    name: domain.name,
    ...(domain.description ? { description: domain.description } : {}),
    owner: domain.ownerEmail,
    stewards: domain.stewardEmails,
  };
}

/** The files of the project as an export contains them (docs/03-spec-format.md §3). */
export function projectFiles(project: ProjectRow, objects: StoredObject[], domains: DomainRow[] = []): SpecFile[] {
  return [
    specToFile("project", projectSpec(project)),
    ...domains.map((domain) => specToFile("domain", domainSpec(domain))),
    ...objects.map((object) => specToFile(object.kind, object.content)),
  ];
}

/** Reference validation of the saved project (ARC-011), once per request. */
export const getValidation = cache(async (slug: string) => {
  const project = await getProject(slug);
  if (!project) return null;
  const [objects, domains] = await Promise.all([getObjects(project.id), getDomains()]);
  const result = validateProject(projectFiles(project, objects, domains));
  const byPath = new Map<string, Issue[]>();
  for (const issue of result.issues) byPath.set(issue.file, [...(byPath.get(issue.file) ?? []), issue]);
  return { ...result, byPath };
});

/** Saves objects through app.save_spec_objects; returns how many changed, or the database error. */
export async function saveObjects(projectId: string, objects: { kind: StoredKind; spec: Record<string, unknown> }[], change: Change = "edit") {
  const payload = await Promise.all(
    objects.map(async ({ kind, spec }) => ({
      kind,
      key: specKey(kind, spec),
      path: specPath(kind, spec),
      content: spec,
      hash: await contentHash(spec),
    })),
  );
  const supabase = await createSupabaseServerClient();
  return supabase.schema("app").rpc("save_spec_objects", { project: projectId, objects: payload as unknown as Json, what: change });
}

export async function deleteObjects(projectId: string, objects: { kind: StoredKind; key: string }[]) {
  const supabase = await createSupabaseServerClient();
  return supabase.schema("app").rpc("delete_spec_objects", { project: projectId, objects: objects as unknown as Json });
}

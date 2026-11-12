"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { type ActionResult, errorKey, failure } from "@/lib/errors";
import { getNamedVersions, getVersion, projectAt } from "@/lib/history";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { deleteObjects, getObjects, getProject, saveObjects } from "@/lib/spec";

async function projectOrFail(slug: string) {
  const project = await getProject(slug);
  if (!project) throw new Error("Unknown project");
  return project;
}

/** VER-030 */
export async function createNamedVersion(slug: string, _previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const project = await projectOrFail(slug);
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  const description = String(formData.get("description") ?? "").trim().slice(0, 2000);
  if (!name) return failure("invalid");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.schema("app").rpc("create_named_version", { project: project.id, version_name: name, version_description: description });
  if (error) return failure(errorKey(error));
  revalidatePath(`/p/${slug}/history`);
  return { ok: true };
}

/** VER-031 */
export async function deleteNamedVersion(slug: string, id: string): Promise<ActionResult> {
  await projectOrFail(slug);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.schema("app").rpc("delete_named_version", { named: id });
  if (error) return failure(errorKey(error));
  revalidatePath(`/p/${slug}/history`);
  redirect(`/p/${slug}/history`);
}

/** VER-040: a new version equal to an older one; a deletion is undone with the content it removed. */
export async function restoreVersion(slug: string, versionId: number): Promise<ActionResult> {
  const project = await projectOrFail(slug);
  const version = await getVersion(project.id, versionId);
  const content = version?.content ?? version?.previous;
  if (!version || !content) return failure("invalid");
  const { error } = await saveObjects(project.id, [{ kind: version.kind, spec: content }], "restore");
  if (error) return failure(errorKey(error));
  revalidatePath(`/p/${slug}`, "layout");
  return { ok: true };
}

/** VER-041: every object that differs gets its state of the named version; objects created since are deleted. */
export async function restoreProject(slug: string, namedId: string): Promise<ActionResult> {
  const project = await projectOrFail(slug);
  const named = (await getNamedVersions(project.id)).find((item) => item.id === namedId);
  if (!named) return failure("invalid");
  const [then, now] = await Promise.all([projectAt(project.id, named.mark), getObjects(project.id)]);
  const kept = new Set(then.map((object) => `${object.kind}/${object.key}`));
  const { error } = await saveObjects(project.id, then.map((object) => ({ kind: object.kind, spec: object.content })), "restore");
  if (error) return failure(errorKey(error));
  const extra = now.filter((object) => !kept.has(`${object.kind}/${object.key}`)).map((object) => ({ kind: object.kind, key: object.key }));
  if (extra.length) {
    const { error: deleteError } = await deleteObjects(project.id, extra);
    if (deleteError) return failure(errorKey(deleteError));
  }
  revalidatePath(`/p/${slug}`, "layout");
  redirect(`/p/${slug}/history?restored=${encodeURIComponent(named.name)}`);
}

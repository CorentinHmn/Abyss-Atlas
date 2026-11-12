"use server";

import { isValidId } from "@atlas/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { type ActionResult, errorKey, failure } from "@/lib/errors";
import { normalizeRule, normalizeValueMapping, type RuleContent, type ValueMappingContent } from "@/lib/reusable";
import { deleteObjects, getDomains, getObjects, getProject, saveObjects } from "@/lib/spec";

type Reusable = "rule" | "value_mapping";
const PATHS: Record<Reusable, string> = { rule: "rules", value_mapping: "value-mappings" };

async function projectOrFail(slug: string) {
  const project = await getProject(slug);
  if (!project) throw new Error("Unknown project");
  return project;
}

/** MAP-050, MAP-052: a new business rule or value mapping; then its editor opens. */
export async function createReusable(slug: string, kind: Reusable, _previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const project = await projectOrFail(slug);
  const value = (name: string, max = 2000) => String(formData.get(name) ?? "").trim().slice(0, max);
  const id = value("id", 100).toLowerCase();
  const name = value("name", 120);
  const domain = value("domain", 5);
  if (!isValidId(id)) return failure("invalidId");
  if (!name) return failure("invalid");
  const domains = await getDomains();
  if (!domains.some((item) => item.code === domain && !item.retiredAt)) return failure("unknownDomain");
  const objects = await getObjects(project.id);
  if (objects.some((object) => object.kind === kind && object.key === id)) return failure("idTaken");
  const spec =
    kind === "rule"
      ? normalizeRule({ id, name, domain, statement: value("statement") || name, parameters: { value: "string" }, returns: value("returns", 60) || "string", logic: ["copy"] } as RuleContent)
      : normalizeValueMapping({ id, name, domain, from_type: value("fromType", 60) || "string", to_type: value("toType", 60) || "string", entries: {} } as ValueMappingContent);
  const { error } = await saveObjects(project.id, [{ kind, spec }]);
  if (error) return failure(errorKey(error));
  revalidatePath(`/p/${slug}`, "layout");
  redirect(`/p/${slug}/${PATHS[kind]}/${id}`);
}

/** MAP-070: automatic saving of the rule and value mapping editors. */
export async function saveReusable(slug: string, kind: Reusable, content: RuleContent | ValueMappingContent): Promise<ActionResult> {
  const project = await projectOrFail(slug);
  const objects = await getObjects(project.id);
  if (!objects.some((object) => object.kind === kind && object.key === content.id)) return failure("invalid");
  const spec = kind === "rule" ? normalizeRule(content as RuleContent) : normalizeValueMapping(content as ValueMappingContent);
  const { error } = await saveObjects(project.id, [{ kind, spec }]);
  if (error) return failure(errorKey(error));
  revalidatePath(`/p/${slug}`, "layout");
  return { ok: true };
}

export async function deleteReusable(slug: string, kind: Reusable, id: string): Promise<ActionResult> {
  const project = await projectOrFail(slug);
  const { error } = await deleteObjects(project.id, [{ kind, key: id }]);
  if (error) return failure(errorKey(error));
  revalidatePath(`/p/${slug}`, "layout");
  redirect(`/p/${slug}/${PATHS[kind]}`);
}

"use server";

import { isValidId } from "@atlas/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { type ActionResult, errorKey, failure } from "@/lib/errors";
import { emptyModel, type ModelContent, modelFromDataset, normalizeModel } from "@/lib/model";
import { deleteObjects, getDomains, getObjects, getProject, saveObjects } from "@/lib/spec";

async function projectOrFail(slug: string) {
  const project = await getProject(slug);
  if (!project) throw new Error("Unknown project");
  return project;
}

/** MAP-012: a new model, empty or from a source dataset (Q-MAP-02); then the editor opens. */
export async function createModel(slug: string, _previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const project = await projectOrFail(slug);
  const value = (name: string, max = 2000) => String(formData.get(name) ?? "").trim().slice(0, max);
  const fields = { id: value("id", 100).toLowerCase(), name: value("name", 120), domain: value("domain", 5), description: value("description"), grain: value("grain") };
  if (!isValidId(fields.id)) return failure("invalidId");
  if (!fields.name || !fields.description || !fields.grain) return failure("invalid");
  const domains = await getDomains();
  if (!domains.some((domain) => domain.code === fields.domain && !domain.retiredAt)) return failure("unknownDomain");
  const objects = await getObjects(project.id);
  if (objects.some((object) => object.kind === "model" && object.key === fields.id)) return failure("idTaken");

  let model: ModelContent = emptyModel(fields);
  const from = value("from", 300);
  if (from) {
    const dataset = objects.find((object) => object.kind === "dataset" && object.key === from);
    const system = objects.find((object) => object.kind === "system" && object.key === String(dataset?.content.system));
    if (!dataset) return failure("invalid");
    model = modelFromDataset(fields, dataset.content as Parameters<typeof modelFromDataset>[1], String(system?.content.name ?? dataset.content.system));
  }
  const { error } = await saveObjects(project.id, [{ kind: "model", spec: model }]);
  if (error) return failure(errorKey(error));
  revalidatePath(`/p/${slug}`, "layout");
  redirect(`/p/${slug}/models/${fields.id}`);
}

/** MAP-070: automatic saving of the editor. The id never changes; the domain must stay in the catalogue. */
export async function saveModel(slug: string, model: ModelContent): Promise<ActionResult> {
  const project = await projectOrFail(slug);
  const objects = await getObjects(project.id);
  if (!objects.some((object) => object.kind === "model" && object.key === model.id)) return failure("invalid");
  const { error } = await saveObjects(project.id, [{ kind: "model", spec: normalizeModel(model) }]);
  if (error) return failure(errorKey(error));
  revalidatePath(`/p/${slug}`, "layout");
  return { ok: true };
}

export async function deleteModel(slug: string, modelId: string): Promise<ActionResult> {
  const project = await projectOrFail(slug);
  const { error } = await deleteObjects(project.id, [{ kind: "model", key: modelId }]);
  if (error) return failure(errorKey(error));
  revalidatePath(`/p/${slug}`, "layout");
  redirect(`/p/${slug}/models`);
}

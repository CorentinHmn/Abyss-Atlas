"use server";

import { datasetIdFor, isValidId, schemas } from "@atlas/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { type ActionResult, type ErrorKey, errorKey, failure } from "@/lib/errors";
import { DATASET_TYPES, type DatasetDraft, datasetSpec, SYSTEM_TYPES, systemSpec, today } from "@/lib/sources";
import { deleteObjects, getObjects, getProject, saveObjects } from "@/lib/spec";

const text = (formData: FormData, name: string, max = 500) => String(formData.get(name) ?? "").trim().slice(0, max);

async function projectOrFail(slug: string) {
  const project = await getProject(slug);
  if (!project) throw new Error("Unknown project");
  return project;
}

const refresh = (slug: string) => revalidatePath(`/p/${slug}`, "layout");

/** SRC-001, SRC-002: creates a system, or changes it (its id never changes once datasets exist). */
export async function saveSystem(slug: string, _previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const project = await projectOrFail(slug);
  const existingId = text(formData, "existingId", 100);
  const id = existingId || text(formData, "id", 100).toLowerCase();
  const name = text(formData, "name", 120);
  const systemType = text(formData, "systemType") as (typeof SYSTEM_TYPES)[number];
  if (!isValidId(id)) return failure("invalidId");
  if (!name || !SYSTEM_TYPES.includes(systemType)) return failure("invalid");
  const objects = await getObjects(project.id);
  if (!existingId && objects.some((object) => object.kind === "system" && object.key === id)) return failure("idTaken");
  const { error } = await saveObjects(project.id, [
    {
      kind: "system",
      spec: systemSpec({
        id,
        name,
        systemType,
        product: text(formData, "product", 120),
        description: text(formData, "description", 2000),
        landingDatabase: text(formData, "landingDatabase", 120),
        landingSchema: text(formData, "landingSchema", 120),
        namingPattern: text(formData, "namingPattern", 120),
      }),
    },
  ]);
  if (error) return failure(errorKey(error));
  refresh(slug);
  return { ok: true };
}

/** SRC-003: deletes a system and its datasets (they stay in the history). */
export async function deleteSystem(slug: string, systemId: string): Promise<ActionResult> {
  const project = await projectOrFail(slug);
  const objects = await getObjects(project.id);
  const targets = objects
    .filter((object) => (object.kind === "system" && object.key === systemId) || (object.kind === "dataset" && object.content.system === systemId))
    .map((object) => ({ kind: object.kind, key: object.key }));
  const { error } = await deleteObjects(project.id, targets);
  if (error) return failure(errorKey(error));
  refresh(slug);
  return { ok: true };
}

/** SRC-011: a new dataset, entered by hand; then its column grid opens. */
export async function createDataset(slug: string, systemId: string, _previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const project = await projectOrFail(slug);
  const name = text(formData, "name", 120);
  const datasetType = text(formData, "datasetType") as (typeof DATASET_TYPES)[number];
  if (!name || !DATASET_TYPES.includes(datasetType)) return failure("invalid");
  const id = datasetIdFor(name);
  const objects = await getObjects(project.id);
  if (objects.some((object) => object.kind === "dataset" && object.key === `${systemId}.${id}`)) return failure("idTaken");
  const { error } = await saveObjects(project.id, [
    {
      kind: "dataset",
      spec: datasetSpec({
        id,
        system: systemId,
        name,
        datasetType,
        namespace: text(formData, "namespace", 120),
        description: text(formData, "description", 2000),
        landingName: "",
        origin: { method: "manual", date: today() },
        columns: [],
      }),
    },
  ]);
  if (error) return failure(errorKey(error));
  refresh(slug);
  redirect(`/p/${slug}/sources/${systemId}/${id}`);
}

/** SRC-012…SRC-015: saves the header and the column grid of a dataset. */
export async function saveDataset(slug: string, draft: DatasetDraft): Promise<ActionResult> {
  const project = await projectOrFail(slug);
  const objects = await getObjects(project.id);
  const stored = objects.find((object) => object.kind === "dataset" && object.key === `${draft.system}.${draft.id}`);
  if (!stored) return failure("invalid");
  if (!draft.name.trim() || !DATASET_TYPES.includes(draft.datasetType)) return failure("invalid");
  const names = draft.columns.map((column) => column.name.trim()).filter(Boolean);
  if (new Set(names).size !== names.length) return failure("invalid");
  const spec = datasetSpec({ ...draft, origin: (stored.content.metadata_origin as DatasetDraft["origin"]) ?? draft.origin });
  const { error } = await saveObjects(project.id, [{ kind: "dataset", spec }]);
  if (error) return failure(errorKey(error));
  refresh(slug);
  return { ok: true, message: "saved" };
}

export async function deleteDataset(slug: string, systemId: string, datasetId: string): Promise<ActionResult> {
  const project = await projectOrFail(slug);
  const { error } = await deleteObjects(project.id, [{ kind: "dataset", key: `${systemId}.${datasetId}` }]);
  if (error) return failure(errorKey(error));
  refresh(slug);
  redirect(`/p/${slug}/sources?system=${systemId}`);
}

/**
 * SRC-021…SRC-024: the dictionary is read and translated in the browser (files up to 20 MB never travel); the
 * resulting datasets arrive here in batches and are saved as an import (a new version of each changed dataset).
 */
export async function saveImportedDatasets(slug: string, systemId: string, contents: unknown[]): Promise<{ ok: true; saved: number } | { ok: false; error: ErrorKey }> {
  const project = await projectOrFail(slug);
  const objects = await getObjects(project.id);
  if (!objects.some((object) => object.kind === "system" && object.key === systemId)) return { ok: false, error: "invalid" };
  const specs: { kind: "dataset"; spec: Record<string, unknown> }[] = [];
  for (const content of contents) {
    const parsed = schemas.datasetSchema.safeParse(content);
    if (!parsed.success || parsed.data.system !== systemId) return { ok: false, error: "invalid" };
    specs.push({ kind: "dataset", spec: content as Record<string, unknown> });
  }
  const { data, error } = await saveObjects(project.id, specs, "import");
  if (error) return { ok: false, error: errorKey(error) };
  refresh(slug);
  return { ok: true, saved: data ?? 0 };
}

/** SRC-005: copies systems and their datasets from another project of the organization; existing ids are skipped. */
export async function copySystems(slug: string, sourceSlug: string, systemIds: string[]): Promise<ActionResult> {
  const project = await projectOrFail(slug);
  const source = await getProject(sourceSlug);
  if (!source || source.id === project.id || systemIds.length === 0) return failure("invalid");
  const [mine, theirs] = await Promise.all([getObjects(project.id), getObjects(source.id)]);
  const taken = new Set(mine.filter((object) => object.kind === "system").map((object) => object.key));
  const wanted = systemIds.filter((id) => !taken.has(id));
  const copies = theirs
    .filter((object) => (object.kind === "system" && wanted.includes(object.key)) || (object.kind === "dataset" && wanted.includes(String(object.content.system))))
    .map((object) => ({ kind: object.kind, spec: object.content }));
  if (copies.length === 0) return failure("idTaken");
  const { error } = await saveObjects(project.id, copies, "copy");
  if (error) return failure(errorKey(error));
  refresh(slug);
  return { ok: true, message: wanted.length === systemIds.length ? "copied" : "copiedSome" };
}

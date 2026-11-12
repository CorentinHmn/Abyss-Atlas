import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getViewer } from "@/lib/session";
import type { ModelContent } from "@/lib/model";
import { previewModelSql } from "@/lib/preview";
import { getDomains, getObjects, getProject, getValidation } from "@/lib/spec";
import { deleteModel } from "../actions";
import { ConfirmButton } from "../../sources/confirm-button";
import type { SourceOption } from "./branches-tab";
import { ModelEditor } from "./model-editor";

/** SCR-021 */
export default async function ModelPage({ params }: { params: Promise<{ project: string; model: string }> }) {
  const { project: slug, model: modelId } = await params;
  const project = await getProject(slug);
  if (!project) notFound();
  const objects = await getObjects(project.id);
  const model = objects.find((object) => object.kind === "model" && object.key === modelId);
  if (!model) notFound();
  const t = await getTranslations("ModelEditor");
  const viewer = await getViewer();
  const canEdit = viewer?.account?.role !== "viewer" && !project.archivedAt;
  const [domains, validation] = await Promise.all([getDomains(), getValidation(slug)]);
  const systems = new Map(objects.filter((object) => object.kind === "system").map((object) => [object.key, String(object.content.name ?? object.key)]));
  type Columns = Record<string, { type?: string; description?: string; definition?: string }>;
  const sources: SourceOption[] = [
    ...objects
      .filter((object) => object.kind === "dataset")
      .map((object) => ({
        key: object.key,
        label: `${systems.get(String(object.content.system)) ?? object.content.system} › ${String(object.content.name ?? object.content.id)}`,
        kind: "dataset" as const,
        columns: Object.entries((object.content.columns as Columns | undefined) ?? {}).map(([name, column]) => ({ name, type: column.type ?? "", ...(column.description ? { description: column.description } : {}) })),
        primaryKey: (object.content.primary_key as string[] | undefined) ?? [],
      })),
    ...objects
      .filter((object) => object.kind === "model")
      .map((object) => ({
        key: object.key,
        label: `${String(object.content.name ?? object.key)} (${object.key})`,
        kind: "model" as const,
        columns: Object.entries((object.content.columns as Columns | undefined) ?? {}).map(([name, column]) => ({ name, type: column.type ?? "", ...(column.definition ? { description: column.definition } : {}) })),
        primaryKey: ((object.content.grain as { key?: string[] } | undefined)?.key) ?? [],
      })),
  ];
  const catalogue = {
    valueMappings: objects.filter((object) => object.kind === "value_mapping").map((object) => object.key),
    rules: objects
      .filter((object) => object.kind === "rule")
      .map((object) => ({ id: object.key, parameters: Object.keys((object.content.parameters as object | undefined) ?? {}) })),
    lookups: sources.map((source) => ({ key: source.key, label: source.label, columns: source.columns.map((column) => column.name) })),
  };
  const prefix = `${model.path}#`;
  const stepTypes = Object.fromEntries([...(validation?.stepTypes ?? new Map<string, string>())].filter(([key]) => key.startsWith(prefix)).map(([key, type]) => [key.slice(prefix.length), type]));
  const issues = (validation?.byPath.get(model.path) ?? []).map((issue) => ({ code: issue.code, severity: issue.severity, at: issue.at, message: issue.message }));
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Link href={`/p/${slug}/models`} className="text-sm text-muted hover:text-ink">
          {t("back")}
        </Link>
        {canEdit ? (
          <ConfirmButton label={t("delete")} title={t("deleteTitle", { name: String(model.content.name ?? modelId) })} body={t("deleteBody")} action={deleteModel.bind(null, slug, modelId)} />
        ) : null}
      </div>
      <ModelEditor
        slug={slug}
        initial={model.content as ModelContent}
        domains={domains.map((domain) => ({ code: domain.code, name: domain.name, retired: Boolean(domain.retiredAt) }))}
        sources={sources}
        catalogue={catalogue}
        stepTypes={stepTypes}
        canEdit={canEdit}
        issues={issues}
        sqlPreview={previewModelSql(project, objects, domains, modelId)}
        modelPath={model.path}
      />
    </div>
  );
}

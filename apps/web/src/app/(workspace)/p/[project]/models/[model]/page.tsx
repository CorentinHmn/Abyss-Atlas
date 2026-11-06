import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getViewer } from "@/lib/session";
import type { ModelContent } from "@/lib/model";
import { getDomains, getObjects, getProject, getValidation } from "@/lib/spec";
import { deleteModel } from "../actions";
import { ConfirmButton } from "../../sources/confirm-button";
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
        canEdit={canEdit}
        issues={issues}
      />
    </div>
  );
}

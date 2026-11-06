import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { getViewer } from "@/lib/session";
import { datasetDraft, guessDialect } from "@/lib/sources";
import { getObjects, getProject, getValidation } from "@/lib/spec";
import { deleteDataset } from "../../actions";
import { ConfirmButton } from "../../confirm-button";
import { DatasetEditor } from "./dataset-editor";

/** SCR-031 */
export default async function DatasetPage({ params }: { params: Promise<{ project: string; system: string; dataset: string }> }) {
  const { project: slug, system: systemId, dataset: datasetId } = await params;
  const project = await getProject(slug);
  if (!project) notFound();
  const objects = await getObjects(project.id);
  const dataset = objects.find((object) => object.kind === "dataset" && object.key === `${systemId}.${datasetId}`);
  const system = objects.find((object) => object.kind === "system" && object.key === systemId);
  if (!dataset || !system) notFound();
  const t = await getTranslations("Dataset");
  const viewer = await getViewer();
  const canEdit = viewer?.account?.role !== "viewer" && !project.archivedAt;
  const validation = await getValidation(slug);
  const issues = (validation?.byPath.get(dataset.path) ?? []).map((issue) => ({ code: issue.code, severity: issue.severity, at: issue.at, message: issue.message }));
  const general = issues.filter((issue) => !issue.at.startsWith("columns."));
  const origin = dataset.content.metadata_origin as { method?: string; date?: string } | undefined;

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/p/${slug}/sources?system=${systemId}`} className="text-sm text-muted hover:text-ink">
        {t("back", { system: String(system.content.name ?? systemId) })}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-mono text-2xl font-bold">{String(dataset.content.name ?? datasetId)}</h1>
          <p className="text-sm text-muted">
            {origin?.method === "file_import" ? t("importedOn", { date: origin.date ?? "" }) : t("enteredByHand")}
            {dataset.updatedByName ? ` · ${t("lastChange", { name: dataset.updatedByName })}` : ""}
          </p>
        </div>
        {canEdit ? (
          <ConfirmButton
            label={t("delete")}
            title={t("deleteTitle", { name: String(dataset.content.name ?? datasetId) })}
            body={t("deleteBody")}
            action={deleteDataset.bind(null, slug, systemId, datasetId)}
          />
        ) : null}
      </div>
      {general.map((issue) => (
        <p key={issue.code + issue.at + issue.message} className="text-sm">
          <Badge tone={issue.severity === "error" ? "danger" : "warning"}>{issue.code}</Badge> {issue.message}
        </p>
      ))}
      <DatasetEditor
        slug={slug}
        draft={datasetDraft(dataset.content)}
        dialect={guessDialect(system.content.product as string | undefined)}
        canEdit={canEdit}
        issues={issues}
      />
    </div>
  );
}

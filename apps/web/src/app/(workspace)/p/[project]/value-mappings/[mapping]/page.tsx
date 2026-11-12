import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { ValueMappingContent } from "@/lib/reusable";
import { getViewer } from "@/lib/session";
import { getDomains, getProject } from "@/lib/spec";
import { ConfirmButton } from "../../sources/confirm-button";
import { loadReusable } from "../../reusable-data";
import { deleteReusable } from "../../spec-actions";
import { ValueMappingEditor } from "./value-mapping-editor";

/** SCR-041: one value mapping. */
export default async function ValueMappingPage({ params }: { params: Promise<{ project: string; mapping: string }> }) {
  const { project: slug, mapping: id } = await params;
  const project = await getProject(slug);
  if (!project) notFound();
  const data = await loadReusable(project, "value_mapping", id);
  if (!data) notFound();
  const t = await getTranslations("Reusable");
  const history = await getTranslations("History");
  const viewer = await getViewer();
  const canEdit = viewer?.account?.role !== "viewer" && !project.archivedAt;
  const domains = await getDomains();
  const name = String(data.item.content.name ?? id);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Link href={`/p/${slug}/value-mappings`} className="text-sm text-muted hover:text-ink">
          {t("backToMappings")}
        </Link>
        <div className="flex items-center gap-3">
          <Link href={`/p/${slug}/history?kind=value_mapping&object=${encodeURIComponent(id)}`} className="text-sm text-muted hover:text-ink">
            {history("objectHistory")}
          </Link>
        {canEdit ? (
          <ConfirmButton
            label={t("delete")}
            title={t("deleteTitle", { name })}
            body={data.uses.length ? t("deleteUsedBody", { count: data.uses.length }) : t("deleteBody")}
            action={deleteReusable.bind(null, slug, "value_mapping", id)}
          />
        ) : null}
        </div>
      </div>
      <ValueMappingEditor
        slug={slug}
        initial={data.item.content as ValueMappingContent}
        domains={domains.map((domain) => ({ code: domain.code, name: domain.name, retired: Boolean(domain.retiredAt) }))}
        sources={data.catalogue.lookups}
        issues={data.issues}
        uses={data.uses}
        canEdit={canEdit}
      />
    </div>
  );
}

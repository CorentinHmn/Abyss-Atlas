import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { RuleContent } from "@/lib/reusable";
import { getViewer } from "@/lib/session";
import { getDomains, getProject } from "@/lib/spec";
import { ConfirmButton } from "../../sources/confirm-button";
import { loadReusable } from "../../reusable-data";
import { deleteReusable } from "../../spec-actions";
import { RuleEditor } from "./rule-editor";

/** SCR-040: one business rule. */
export default async function RulePage({ params }: { params: Promise<{ project: string; rule: string }> }) {
  const { project: slug, rule: id } = await params;
  const project = await getProject(slug);
  if (!project) notFound();
  const data = await loadReusable(project, "rule", id);
  if (!data) notFound();
  const t = await getTranslations("Reusable");
  const viewer = await getViewer();
  const canEdit = viewer?.account?.role !== "viewer" && !project.archivedAt;
  const domains = await getDomains();
  const name = String(data.item.content.name ?? id);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Link href={`/p/${slug}/rules`} className="text-sm text-muted hover:text-ink">
          {t("backToRules")}
        </Link>
        {canEdit ? (
          <ConfirmButton
            label={t("delete")}
            title={t("deleteTitle", { name })}
            body={data.uses.length ? t("deleteUsedBody", { count: data.uses.length }) : t("deleteBody")}
            action={deleteReusable.bind(null, slug, "rule", id)}
          />
        ) : null}
      </div>
      <RuleEditor
        slug={slug}
        initial={data.item.content as RuleContent}
        domains={domains.map((domain) => ({ code: domain.code, name: domain.name, retired: Boolean(domain.retiredAt) }))}
        catalogue={data.catalogue}
        stepTypes={data.stepTypes}
        issues={data.issues}
        uses={data.uses}
        canEdit={canEdit}
      />
    </div>
  );
}

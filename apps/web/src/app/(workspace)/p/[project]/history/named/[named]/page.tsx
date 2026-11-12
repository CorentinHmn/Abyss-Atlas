import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { describeChanges, getNamedVersions, projectAt } from "@/lib/history";
import { getViewer } from "@/lib/session";
import { getObjects, getProject, type StoredKind } from "@/lib/spec";
import { ConfirmButton } from "../../../sources/confirm-button";
import { deleteNamedVersion, restoreProject } from "../../actions";
import { ChangeList } from "../../change-list";
import { RestoreButton } from "../../restore-button";

interface Difference {
  kind: StoredKind;
  key: string;
  state: "added" | "removed" | "changed";
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

/** SCR-050: a named version compared with the current state (VER-022), and the project restored to it (VER-041). */
export default async function NamedVersionPage({ params }: { params: Promise<{ project: string; named: string }> }) {
  const { project: slug, named: id } = await params;
  const project = await getProject(slug);
  if (!project) notFound();
  const named = (await getNamedVersions(project.id)).find((item) => item.id === id);
  if (!named) notFound();
  const t = await getTranslations("History");
  const format = await getFormatter();
  const viewer = await getViewer();
  const canEdit = viewer?.account?.role !== "viewer" && !project.archivedAt;
  const isAdmin = viewer?.account?.role === "admin";
  const [then, now] = await Promise.all([projectAt(project.id, named.mark), getObjects(project.id)]);
  const id_ = (kind: string, key: string) => `${kind}/${key}`;
  const before = new Map(then.map((object) => [id_(object.kind, object.key), object]));
  const after = new Map(now.map((object) => [id_(object.kind, object.key), object]));
  const differences: Difference[] = [];
  for (const [key, object] of before) {
    const current = after.get(key);
    if (!current) differences.push({ kind: object.kind, key: object.key, state: "removed", before: object.content, after: null });
    else if (JSON.stringify(current.content) !== JSON.stringify(object.content)) differences.push({ kind: object.kind, key: object.key, state: "changed", before: object.content, after: current.content });
  }
  for (const [key, object] of after) if (!before.has(key)) differences.push({ kind: object.kind, key: object.key, state: "added", before: null, after: object.content });
  differences.sort((a, b) => a.kind.localeCompare(b.kind) || a.key.localeCompare(b.key));
  const counts = { added: 0, removed: 0, changed: 0 };
  for (const difference of differences) counts[difference.state] += 1;

  return (
    <div className="flex flex-col gap-4">
      <Link href={`/p/${slug}/history`} className="text-sm text-muted hover:text-ink">
        {t("back")}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{named.name}</h1>
          <p className="text-sm text-muted">{t("namedBy", { name: named.author.name, date: format.dateTime(new Date(named.createdAt), { dateStyle: "medium", timeStyle: "short" }) })}</p>
          {named.description ? <p className="mt-1 max-w-2xl text-sm">{named.description}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && differences.length > 0 ? (
            <RestoreButton
              label={t("restoreProject")}
              title={t("restoreProjectTitle", { name: named.name })}
              body={t("restoreProjectBody", { changed: counts.changed + counts.removed, removed: counts.added })}
              action={restoreProject.bind(null, slug, named.id)}
            />
          ) : null}
          {isAdmin ? <ConfirmButton label={t("deleteNamed")} title={t("deleteNamedTitle", { name: named.name })} body={t("deleteNamedBody")} action={deleteNamedVersion.bind(null, slug, named.id)} /> : null}
        </div>
      </div>

      <Card className="flex flex-col gap-3">
        <h2 className="text-sm font-bold">{t("sinceNamed")}</h2>
        {differences.length === 0 ? (
          <p className="text-sm text-muted">{t("sameAsNamed")}</p>
        ) : (
          <>
            <p className="text-sm">{t("sinceCounts", counts)}</p>
            <ul className="flex flex-col gap-3" aria-label={t("sinceNamed")}>
              {differences.map((difference) => (
                <li key={id_(difference.kind, difference.key)} className="flex flex-col gap-1 border-t border-line pt-2">
                  <span className="flex flex-wrap items-baseline gap-2">
                    <Badge tone={difference.state === "removed" ? "danger" : difference.state === "added" ? "success" : "neutral"}>{t(`state.${difference.state}`)}</Badge>
                    <span className="text-xs text-muted">{t(`kind.${difference.kind}`)}</span>
                    <span className="font-mono text-sm">{difference.key}</span>
                  </span>
                  {difference.state === "changed" ? <ChangeList changes={describeChanges(difference.kind, difference.before, difference.after)} label={t("changesOf", { key: difference.key })} /> : null}
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </div>
  );
}

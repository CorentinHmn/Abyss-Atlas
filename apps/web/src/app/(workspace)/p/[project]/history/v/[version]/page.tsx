import { specToFile } from "@atlas/core";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { CodeDiff } from "@/components/code";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { changeOf, describeChanges, getHistory, getVersion, objectHref, type VersionRow } from "@/lib/history";
import { getViewer } from "@/lib/session";
import { getObjects, getProject } from "@/lib/spec";
import { restoreVersion } from "../../actions";
import { ChangeList } from "../../change-list";
import { RestoreButton } from "../../restore-button";

/** SCR-050: one version of an object, compared with another one or with the current state (VER-020, VER-021, VER-040). */
export default async function VersionPage({ params, searchParams }: { params: Promise<{ project: string; version: string }>; searchParams: Promise<{ with?: string }> }) {
  const { project: slug, version: raw } = await params;
  const { with: other } = await searchParams;
  const project = await getProject(slug);
  if (!project) notFound();
  const version = await getVersion(project.id, Number(raw));
  if (!version) notFound();
  const t = await getTranslations("History");
  const format = await getFormatter();
  const viewer = await getViewer();
  const canEdit = viewer?.account?.role !== "viewer" && !project.archivedAt;
  const [versions, objects] = await Promise.all([getHistory(project.id, { kind: version.kind, key: version.key }, 200), getObjects(project.id)]);
  const current = objects.find((object) => object.kind === version.kind && object.key === version.key)?.content ?? null;
  const when = (row: VersionRow) => format.dateTime(new Date(row.updatedAt), { dateStyle: "medium", timeStyle: "short" });

  // The pair compared: older on the left. By default, this version against the one before it.
  const otherRow = other && other !== "current" ? versions.find((row) => row.id === Number(other)) : undefined;
  let before: Record<string, unknown> | null;
  let after: Record<string, unknown> | null;
  let caption: string;
  if (other === "current") {
    [before, after] = [version.content, current];
    caption = t("comparedWithCurrent", { date: when(version) });
  } else if (otherRow) {
    const [older, newer] = otherRow.id < version.id ? [otherRow, version] : [version, otherRow];
    [before, after] = [older.content, newer.content];
    caption = t("comparedWith", { from: when(older), to: when(newer) });
  } else {
    [before, after] = [version.previous, version.content];
    caption = version.previous ? t("comparedWithPrevious", { date: when(version) }) : t("firstVersion");
  }
  const changes = describeChanges(version.kind, before, after);
  const yaml = (content: Record<string, unknown> | null) => (content ? specToFile(version.kind, content).content : "");
  const restorable = version.content ?? version.previous;
  const href = objectHref(slug, version.kind, version.key, current);
  const sameAsCurrent = JSON.stringify(restorable) === JSON.stringify(current);
  const name = String(restorable?.name ?? version.key);

  return (
    <div className="flex flex-col gap-4">
      <Link href={`/p/${slug}/history?kind=${version.kind}&object=${encodeURIComponent(version.key)}`} className="text-sm text-muted hover:text-ink">
        {t("backToObject")}
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-2">
          <h1 className="text-2xl font-bold">{name}</h1>
          <Badge>{t(`kind.${version.kind}`)}</Badge>
          <span className="font-mono text-xs text-muted">{version.key}</span>
          {href && current ? (
            <Link href={href} className="text-sm text-brand hover:underline">
              {t("openObject")}
            </Link>
          ) : null}
          {!current ? <Badge tone="danger">{t("deletedNow")}</Badge> : null}
        </div>
        {canEdit && restorable ? (
          <RestoreButton
            label={version.change === "delete" ? t("restoreDeleted") : t("restoreThis")}
            title={t("restoreTitle", { name })}
            body={t("restoreBody")}
            action={restoreVersion.bind(null, slug, version.id)}
            disabled={sameAsCurrent}
          />
        ) : null}
      </div>
      <p className="text-sm">
        {t("versionLine", {
          change: t(`change.${changeOf(version)}`),
          date: when(version),
          names: version.authors.map((author) => author.name).join(", "),
        })}
      </p>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card className="flex flex-col gap-3">
            <h2 className="text-sm font-bold">{caption}</h2>
            <ChangeList changes={changes} label={t("changes")} />
          </Card>
          {before || after ? <CodeDiff original={yaml(before)} modified={yaml(after)} label={t("yamlDiff")} /> : null}
        </div>
        <Card className="flex flex-col gap-2 self-start">
          <h2 className="text-sm font-bold">{t("versionsOf")}</h2>
          <ol className="flex flex-col gap-2 text-xs" aria-label={t("versionsOf")}>
            {versions.map((row) => (
              <li key={row.id} className="flex flex-col gap-0.5">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  {row.id === version.id ? (
                    <span className="font-semibold">{when(row)}</span>
                  ) : (
                    <Link href={`/p/${slug}/history/v/${row.id}`} className="text-brand hover:underline">
                      {when(row)}
                    </Link>
                  )}
                  <span className="text-muted">{row.authors.map((author) => author.name).join(", ")}</span>
                </span>
                {row.id !== version.id ? (
                  <Link href={`/p/${slug}/history/v/${version.id}?with=${row.id}`} className="text-muted hover:text-ink">
                    {t("compareWithThis")}
                  </Link>
                ) : null}
              </li>
            ))}
          </ol>
          {current ? (
            <Link href={`/p/${slug}/history/v/${version.id}?with=current`} className="text-xs text-brand hover:underline">
              {t("compareWithCurrent")}
            </Link>
          ) : null}
        </Card>
      </div>
    </div>
  );
}

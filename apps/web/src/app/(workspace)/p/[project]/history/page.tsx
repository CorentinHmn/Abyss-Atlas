import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { changeOf, describeChanges, getHistory, getNamedVersions, KINDS, type VersionRow } from "@/lib/history";
import { getViewer } from "@/lib/session";
import { getProject, type StoredKind } from "@/lib/spec";
import { summaryOf } from "./change-list";
import { NewNamedVersion } from "./named-versions";

const PAGE = 50;

/** SCR-050: the project timeline (VER-010, VER-011) and its named versions (VER-030). */
export default async function HistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ project: string }>;
  searchParams: Promise<{ kind?: string; object?: string; author?: string; before?: string; restored?: string }>;
}) {
  const { project: slug } = await params;
  const query = await searchParams;
  const project = await getProject(slug);
  if (!project) notFound();
  const t = await getTranslations("History");
  const format = await getFormatter();
  const viewer = await getViewer();
  const canEdit = viewer?.account?.role !== "viewer" && !project.archivedAt;
  const kind = KINDS.includes(query.kind as StoredKind) ? (query.kind as StoredKind) : undefined;
  const filters = { kind, key: query.object?.trim() || undefined, author: query.author?.trim().toLowerCase() || undefined, before: Number(query.before) || undefined };
  const [rows, named] = await Promise.all([getHistory(project.id, filters, PAGE), getNamedVersions(project.id)]);
  const summaries = await Promise.all(rows.map((row) => summaryFor(row)));
  const filtered = Boolean(filters.kind || filters.key || filters.author);
  const older = rows.length === PAGE ? rows.at(-1)?.id : undefined;
  const keep = new URLSearchParams(Object.entries({ kind: filters.kind, object: filters.key, author: filters.author }).filter((entry): entry is [string, string] => Boolean(entry[1])));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="max-w-2xl text-sm text-muted">{t("subtitle")}</p>
      </div>
      {query.restored ? <Alert tone="success">{t("restoredProject", { name: query.restored })}</Alert> : null}

      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold">{t("namedTitle")}</h2>
          {canEdit ? <NewNamedVersion slug={slug} /> : null}
        </div>
        {named.length === 0 ? (
          <p className="text-sm text-muted">{t("noNamed")}</p>
        ) : (
          <ul className="flex flex-col gap-2" aria-label={t("namedTitle")}>
            {named.map((item) => (
              <li key={item.id} className="flex flex-col gap-0.5 text-sm">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <Link href={`/p/${slug}/history/named/${item.id}`} className="font-medium text-brand hover:underline">
                    {item.name}
                  </Link>
                  <span className="text-xs text-muted">{t("namedBy", { name: item.author.name, date: format.dateTime(new Date(item.createdAt), { dateStyle: "medium", timeStyle: "short" }) })}</span>
                </span>
                {item.description ? <span className="text-xs text-muted">{item.description}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <form className="flex flex-wrap items-end gap-2" aria-label={t("filters")}>
        <label className="flex flex-col gap-1 text-xs font-medium">
          {t("filterKind")}
          <Select name="kind" defaultValue={filters.kind ?? ""} className="w-44">
            <option value="">{t("allKinds")}</option>
            {KINDS.map((item) => (
              <option key={item} value={item}>
                {t(`kind.${item}`)}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          {t("filterObject")}
          <Input name="object" defaultValue={filters.key ?? ""} className="w-44 font-mono" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          {t("filterAuthor")}
          <Input name="author" type="email" defaultValue={filters.author ?? ""} className="w-56" />
        </label>
        <Button type="submit" variant="secondary" size="sm">
          {t("apply")}
        </Button>
        {filtered ? (
          <Link href={`/p/${slug}/history`} className="text-sm text-muted hover:text-ink">
            {t("clear")}
          </Link>
        ) : null}
      </form>

      {rows.length === 0 ? (
        <p className="text-sm text-muted">{filtered ? t("noMatch") : t("empty")}</p>
      ) : (
        <ol className="flex flex-col divide-y divide-line rounded-md border border-line bg-surface" aria-label={t("timeline")}>
          {rows.map((row, index) => {
            const change = changeOf(row);
            return (
              <li key={row.id} className="flex flex-col gap-1 px-3 py-2 text-sm sm:flex-row sm:items-baseline sm:gap-3">
                <span className="shrink-0 text-xs text-muted tabular-nums sm:w-40">{format.dateTime(new Date(row.updatedAt), { dateStyle: "medium", timeStyle: "short" })}</span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <Badge tone={change === "delete" ? "danger" : change === "create" ? "success" : "neutral"}>{t(`change.${change}`)}</Badge>
                    <span className="text-xs text-muted">{t(`kind.${row.kind}`)}</span>
                    <Link href={`/p/${slug}/history/v/${row.id}`} className="font-mono text-brand hover:underline" aria-label={t("openVersion", { key: row.key, n: index + 1 })}>
                      {row.key}
                    </Link>
                    <span className="text-xs text-muted">{t("by", { names: row.authors.map((author) => author.name).join(", ") })}</span>
                  </span>
                  {summaries[index] ? <span className="text-xs text-muted">{summaries[index]}</span> : null}
                </span>
              </li>
            );
          })}
        </ol>
      )}
      {older ? (
        <Link href={`/p/${slug}/history?${new URLSearchParams([...keep, ["before", String(older)]])}`} className="self-start text-sm text-brand hover:underline">
          {t("older")}
        </Link>
      ) : null}
    </div>
  );
}

async function summaryFor(row: VersionRow): Promise<string> {
  if (row.change === "delete" || row.previous === null || row.content === null) return "";
  return summaryOf(describeChanges(row.kind, row.previous, row.content));
}

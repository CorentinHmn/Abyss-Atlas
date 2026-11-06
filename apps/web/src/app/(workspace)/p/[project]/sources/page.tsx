import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { getViewer } from "@/lib/session";
import { getObjects, getProject, getValidation } from "@/lib/spec";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { deleteSystem } from "./actions";
import { ConfirmButton } from "./confirm-button";
import { CopySystemsDialog, type OtherProject } from "./copy-systems-dialog";
import { DatasetList } from "./dataset-list";
import { NewDatasetDialog } from "./new-dataset-dialog";
import { SystemDialog, type SystemValues } from "./system-dialog";

type Landing = { database?: string; schema?: string; naming_pattern?: string } | undefined;

/** SCR-030: the systems of the project and their datasets. */
export default async function SourcesPage({ params, searchParams }: { params: Promise<{ project: string }>; searchParams: Promise<{ system?: string }> }) {
  const { project: slug } = await params;
  const project = await getProject(slug);
  if (!project) notFound();
  const t = await getTranslations("Sources");
  const viewer = await getViewer();
  const canEdit = viewer?.account?.role !== "viewer" && !project.archivedAt;
  const [objects, validation] = await Promise.all([getObjects(project.id), getValidation(slug)]);
  const systems = objects.filter((object) => object.kind === "system");
  const datasets = objects.filter((object) => object.kind === "dataset");
  const selectedId = (await searchParams).system ?? systems[0]?.key;
  const selected = systems.find((system) => system.key === selectedId);
  const issues = (path: string) => validation?.byPath.get(path) ?? [];

  let others: OtherProject[] = [];
  if (canEdit) {
    const supabase = await createSupabaseServerClient();
    const [{ data: projects }, { data: rows }] = await Promise.all([
      supabase.schema("app").from("projects").select("id, slug, name").is("archived_at", null).neq("id", project.id).order("name"),
      supabase.schema("app").from("spec_objects").select("project_id, kind, key, name:content->>name, system:content->>system").in("kind", ["system", "dataset"]).neq("project_id", project.id),
    ]);
    others = (projects ?? []).map((other) => ({
      slug: other.slug,
      name: other.name,
      systems: (rows ?? [])
        .filter((row) => row.project_id === other.id && row.kind === "system")
        .map((row) => ({
          id: row.key,
          name: String(row.name ?? row.key),
          datasets: (rows ?? []).filter((item) => item.project_id === other.id && item.kind === "dataset" && item.system === row.key).length,
        })),
    }));
  }

  const values = (content: Record<string, unknown>): SystemValues => {
    const landing = content.landing as Landing;
    return {
      id: String(content.id),
      name: String(content.name ?? ""),
      systemType: String(content.system_type ?? "other"),
      product: String(content.product ?? ""),
      description: String(content.description ?? ""),
      landingDatabase: landing?.database ?? "",
      landingSchema: landing?.schema ?? "",
      namingPattern: landing?.naming_pattern ?? "",
    };
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-muted">{t("subtitle")}</p>
        </div>
        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <CopySystemsDialog slug={slug} projects={others.filter((other) => other.systems.length > 0)} taken={systems.map((system) => system.key)} />
            <SystemDialog slug={slug} trigger={<Button>{t("newSystem")}</Button>} />
          </div>
        ) : null}
      </div>

      {systems.length === 0 ? (
        <Card className="flex flex-col gap-2">
          <CardTitle>{t("emptyTitle")}</CardTitle>
          <p className="text-sm text-muted">{canEdit ? t("emptyBody") : t("emptyViewer")}</p>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <nav aria-label={t("systems")} className="flex flex-col gap-1">
            {systems.map((system) => {
              const count = datasets.filter((dataset) => dataset.content.system === system.key).length;
              return (
                <Link
                  key={system.key}
                  href={`/p/${slug}/sources?system=${system.key}`}
                  aria-current={system.key === selected?.key ? "page" : undefined}
                  className={cn("flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm hover:bg-line/40", system.key === selected?.key && "bg-line/40 font-semibold")}
                >
                  <span className="truncate">{String(system.content.name ?? system.key)}</span>
                  <span className="text-xs text-muted tabular-nums">{count}</span>
                </Link>
              );
            })}
          </nav>
          {selected ? (
            <section className="flex min-w-0 flex-col gap-4" aria-labelledby="system-title">
              <Card className="flex flex-col gap-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 id="system-title" className="text-lg font-bold">
                      {String(selected.content.name ?? selected.key)}
                    </h2>
                    <p className="font-mono text-xs text-muted">{selected.key}</p>
                  </div>
                  {canEdit ? (
                    <div className="flex flex-wrap gap-1">
                      <SystemDialog slug={slug} system={values(selected.content)} trigger={<Button variant="ghost" size="sm">{t("edit")}</Button>} />
                      <ConfirmButton
                        label={t("deleteSystem")}
                        title={t("deleteSystemTitle", { name: String(selected.content.name ?? selected.key) })}
                        body={t("deleteSystemBody")}
                        action={deleteSystem.bind(null, slug, selected.key)}
                      />
                    </div>
                  ) : null}
                </div>
                <dl className="grid gap-2 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-xs text-muted">{t("systemType")}</dt>
                    <dd>{t(`systemTypes.${String(selected.content.system_type ?? "other")}`)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">{t("product")}</dt>
                    <dd>{String(selected.content.product ?? "—")}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">{t("landing")}</dt>
                    <dd className="font-mono text-xs">
                      {(selected.content.landing as Landing)?.database
                        ? `${(selected.content.landing as Landing)?.database}.${(selected.content.landing as Landing)?.schema}`
                        : "—"}
                    </dd>
                  </div>
                </dl>
                {issues(selected.path).map((issue) => (
                  <p key={`${issue.code}${issue.at}${issue.message}`} className="text-sm">
                    <Badge tone={issue.severity === "error" ? "danger" : "warning"}>{issue.code}</Badge> {issue.message}
                  </p>
                ))}
              </Card>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold">{t("datasets")}</h3>
                {canEdit ? (
                  <div className="flex gap-2">
                    <NewDatasetDialog slug={slug} systemId={selected.key} />
                    <Button asChild size="sm">
                      <Link href={`/p/${slug}/sources/import?system=${selected.key}`}>{t("import")}</Link>
                    </Button>
                  </div>
                ) : null}
              </div>
              <DatasetList
                href={`/p/${slug}/sources/${selected.key}`}
                datasets={datasets
                  .filter((dataset) => dataset.content.system === selected.key)
                  .map((dataset) => {
                    const found = issues(dataset.path);
                    const origin = dataset.content.metadata_origin as { method?: string; date?: string } | undefined;
                    return {
                      id: String(dataset.content.id),
                      name: String(dataset.content.name ?? dataset.content.id),
                      description: String(dataset.content.description ?? ""),
                      columns: Object.keys((dataset.content.columns as object | undefined) ?? {}),
                      origin: origin?.method === "file_import" ? t("originImport", { date: origin.date ?? "" }) : t("originManual"),
                      errors: found.filter((issue) => issue.severity === "error").length,
                      warnings: found.filter((issue) => issue.severity === "warning").length,
                    };
                  })}
              />
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}

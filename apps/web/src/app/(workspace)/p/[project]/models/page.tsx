import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { getViewer } from "@/lib/session";
import { getDomains, getObjects, getProject, getValidation } from "@/lib/spec";
import { NewModelDialog } from "./new-model-dialog";

/** SCR-020: models by domain, with completeness and problems (MAP-010). */
export default async function ModelsPage({ params }: { params: Promise<{ project: string }> }) {
  const { project: slug } = await params;
  const project = await getProject(slug);
  if (!project) notFound();
  const t = await getTranslations("Models");
  const viewer = await getViewer();
  const canEdit = viewer?.account?.role !== "viewer" && !project.archivedAt;
  const [objects, domains, validation] = await Promise.all([getObjects(project.id), getDomains(), getValidation(slug)]);
  const models = objects.filter((object) => object.kind === "model");
  const systems = new Map(objects.filter((object) => object.kind === "system").map((object) => [object.key, String(object.content.name ?? object.key)]));
  const datasets = objects
    .filter((object) => object.kind === "dataset")
    .map((object) => ({ key: object.key, label: `${systems.get(String(object.content.system)) ?? object.content.system} › ${String(object.content.name ?? object.content.id)}` }));

  const stats = (content: Record<string, unknown>) => {
    const branches = Object.keys((content.branches as object | undefined) ?? {});
    const columns = Object.values((content.columns as Record<string, { from?: Record<string, unknown> }> | undefined) ?? {});
    const cells = columns.length * Math.max(branches.length, 1);
    const filled = columns.reduce((sum, column) => {
      const from = column.from ?? {};
      return sum + ("*" in from ? Math.max(branches.length, 1) : branches.filter((branch) => branch in from).length);
    }, 0);
    return { branches: branches.length, columns: columns.length, completeness: cells === 0 ? 0 : Math.round((filled / cells) * 100) };
  };
  const byDomain = [...new Set(models.map((model) => String(model.content.domain)))].sort();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-muted">{t("subtitle")}</p>
        </div>
        {canEdit ? <NewModelDialog slug={slug} domains={domains.filter((domain) => !domain.retiredAt).map((domain) => ({ code: domain.code, name: domain.name }))} datasets={datasets} /> : null}
      </div>
      {models.length === 0 ? (
        <Card className="flex flex-col gap-2">
          <CardTitle>{t("emptyTitle")}</CardTitle>
          <p className="text-sm text-muted">{canEdit ? t("emptyBody") : t("emptyViewer")}</p>
        </Card>
      ) : (
        byDomain.map((code) => (
          <section key={code} className="flex flex-col gap-2" aria-label={code}>
            <h2 className="font-bold">
              <span className="font-mono">{code}</span> {domains.find((domain) => domain.code === code)?.name ?? ""}
            </h2>
            <Table>
              <thead>
                <tr>
                  <Th>{t("name")}</Th>
                  <Th className="text-right">{t("branches")}</Th>
                  <Th className="text-right">{t("columns")}</Th>
                  <Th className="text-right">{t("completeness")}</Th>
                  <Th>{t("problems")}</Th>
                </tr>
              </thead>
              <tbody>
                {models
                  .filter((model) => String(model.content.domain) === code)
                  .map((model) => {
                    const figures = stats(model.content);
                    const issues = validation?.byPath.get(model.path) ?? [];
                    const errorCount = issues.filter((issue) => issue.severity === "error").length;
                    const warningCount = issues.filter((issue) => issue.severity === "warning").length;
                    return (
                      <tr key={model.key}>
                        <Td className="w-full">
                          <Link href={`/p/${slug}/models/${model.key}`} className="font-medium text-brand hover:underline">
                            {String(model.content.name ?? model.key)}
                          </Link>
                          <span className="ml-2 font-mono text-xs text-muted">{model.key}</span>
                        </Td>
                        <Td className="text-right tabular-nums">{figures.branches}</Td>
                        <Td className="text-right tabular-nums">{figures.columns}</Td>
                        <Td className="text-right tabular-nums">{t("percent", { value: figures.completeness })}</Td>
                        <Td className="whitespace-nowrap">
                          {errorCount > 0 ? <Badge tone="danger">{t("errorCount", { count: errorCount })}</Badge> : null}{" "}
                          {warningCount > 0 ? <Badge tone="warning">{t("warningCount", { count: warningCount })}</Badge> : null}
                          {errorCount + warningCount === 0 ? <Badge tone="success">{t("valid")}</Badge> : null}
                        </Td>
                      </tr>
                    );
                  })}
              </tbody>
            </Table>
          </section>
        ))
      )}
    </div>
  );
}

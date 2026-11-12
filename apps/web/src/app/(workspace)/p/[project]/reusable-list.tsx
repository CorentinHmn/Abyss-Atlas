import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { usesOf } from "@/lib/reusable";
import { getViewer } from "@/lib/session";
import { getDomains, getObjects, type ProjectRow, getValidation } from "@/lib/spec";
import { NewReusableDialog } from "./new-reusable-dialog";

/** SCR-040, SCR-041: business rules or value mappings by domain, with where used and problems (MAP-050, MAP-052). */
export async function ReusableList({ project, kind }: { project: ProjectRow; kind: "rule" | "value_mapping" }) {
  const t = await getTranslations("Reusable");
  const viewer = await getViewer();
  const canEdit = viewer?.account?.role !== "viewer" && !project.archivedAt;
  const [objects, domains, validation] = await Promise.all([getObjects(project.id), getDomains(), getValidation(project.slug)]);
  const items = objects.filter((object) => object.kind === kind);
  const users = objects.filter((object) => object.kind === "model" || object.kind === "rule");
  const usedBy = (id: string) => users.filter((object) => (kind === "rule" ? usesOf(object.content).rules : usesOf(object.content).valueMappings).has(id)).length;
  const path = kind === "rule" ? "rules" : "value-mappings";
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{kind === "rule" ? t("rulesTitle") : t("mappingsTitle")}</h1>
          <p className="max-w-2xl text-sm text-muted">{kind === "rule" ? t("rulesSubtitle") : t("mappingsSubtitle")}</p>
        </div>
        {canEdit ? <NewReusableDialog slug={project.slug} kind={kind} domains={domains.filter((domain) => !domain.retiredAt).map((domain) => ({ code: domain.code, name: domain.name }))} /> : null}
      </div>
      {items.length === 0 ? (
        <Card className="flex flex-col gap-2">
          <CardTitle>{kind === "rule" ? t("noRule") : t("noMapping")}</CardTitle>
          <p className="text-sm text-muted">{kind === "rule" ? t("noRuleBody") : t("noMappingBody")}</p>
        </Card>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{t("name")}</Th>
              <Th>{t("domain")}</Th>
              <Th>{kind === "rule" ? t("signature") : t("types")}</Th>
              <Th className="text-right">{t("uses")}</Th>
              <Th>{t("problems")}</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const issues = validation?.byPath.get(item.path) ?? [];
              const errorCount = issues.filter((issue) => issue.severity === "error").length;
              const signature =
                kind === "rule"
                  ? `(${Object.entries((item.content.parameters as Record<string, string> | undefined) ?? {}).map(([name, type]) => `${name} ${type}`).join(", ")}) → ${String(item.content.returns ?? "")}`
                  : `${String(item.content.from_type ?? "")} → ${String(item.content.to_type ?? "")}`;
              return (
                <tr key={item.key}>
                  <Td className="w-full">
                    <Link href={`/p/${project.slug}/${path}/${item.key}`} className="font-medium text-brand hover:underline">
                      {String(item.content.name ?? item.key)}
                    </Link>
                    <span className="ml-2 font-mono text-xs text-muted">{item.key}</span>
                  </Td>
                  <Td className="font-mono">{String(item.content.domain ?? "")}</Td>
                  <Td className="whitespace-nowrap font-mono text-xs">{signature}</Td>
                  <Td className="text-right tabular-nums">{usedBy(item.key)}</Td>
                  <Td className="whitespace-nowrap">{errorCount > 0 ? <Badge tone="danger">{t("errorCount", { count: errorCount })}</Badge> : <Badge tone="success">{t("valid")}</Badge>}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </div>
  );
}

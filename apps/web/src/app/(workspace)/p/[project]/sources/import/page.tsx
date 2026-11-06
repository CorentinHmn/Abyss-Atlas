import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { getViewer } from "@/lib/session";
import { guessDialect } from "@/lib/sources";
import { getObjects, getProject } from "@/lib/spec";
import { ImportWizard } from "./import-wizard";

/** SCR-032 */
export default async function ImportPage({ params, searchParams }: { params: Promise<{ project: string }>; searchParams: Promise<{ system?: string }> }) {
  const { project: slug } = await params;
  const project = await getProject(slug);
  if (!project) notFound();
  const viewer = await getViewer();
  if (viewer?.account?.role === "viewer" || project.archivedAt) notFound();
  const t = await getTranslations("Import");
  const objects = await getObjects(project.id);
  const systems = objects
    .filter((object) => object.kind === "system")
    .map((object) => ({ id: object.key, name: String(object.content.name ?? object.key), dialect: guessDialect(object.content.product as string | undefined) }));
  const requested = (await searchParams).system;
  return (
    <div className="flex flex-col gap-6">
      <Link href={`/p/${slug}/sources`} className="text-sm text-muted hover:text-ink">
        {t("back")}
      </Link>
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted">{t("subtitle")}</p>
      </div>
      {systems.length === 0 ? (
        <Card>
          <p className="text-sm">{t("noSystem")}</p>
        </Card>
      ) : (
        <ImportWizard
          slug={slug}
          projectId={project.id}
          systems={systems}
          initialSystem={systems.some((system) => system.id === requested) ? (requested as string) : (systems[0]?.id as string)}
        />
      )}
    </div>
  );
}

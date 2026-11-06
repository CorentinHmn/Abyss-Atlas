import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card, CardTitle } from "@/components/ui/card";
import { getObjects, getProject, getValidation } from "@/lib/spec";

/** SCR-011, first version: what the project contains and its validation summary. */
export default async function ProjectPage({ params }: { params: Promise<{ project: string }> }) {
  const { project: slug } = await params;
  const t = await getTranslations("Project");
  const project = await getProject(slug);
  if (!project) notFound();
  const [objects, validation] = await Promise.all([getObjects(project.id), getValidation(slug)]);
  const count = (kind: string) => objects.filter((object) => object.kind === kind).length;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{project.name}</h1>
        {project.description ? <p className="mt-1 text-muted">{project.description}</p> : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs text-muted">{t("systems")}</p>
          <p className="text-2xl font-bold tabular-nums">{count("system")}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">{t("datasets")}</p>
          <p className="text-2xl font-bold tabular-nums">{count("dataset")}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">{t("problems")}</p>
          <p className="text-2xl font-bold tabular-nums">
            {t("problemCounts", { errors: validation?.errors ?? 0, warnings: validation?.warnings ?? 0 })}
          </p>
        </Card>
      </div>
      {objects.length === 0 ? (
        <Card className="flex flex-col gap-2">
          <CardTitle>{t("startTitle")}</CardTitle>
          <p className="text-sm text-muted">{t("startBody")}</p>
          <Link href={`/p/${project.slug}/sources`} className="text-sm font-semibold text-brand hover:underline">
            {t("startSources")}
          </Link>
        </Card>
      ) : null}
      <p className="text-sm text-muted">{t("comingNext")}</p>
    </div>
  );
}

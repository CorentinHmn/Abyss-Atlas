import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { NavLink } from "@/components/shell/nav-link";
import { Badge } from "@/components/ui/badge";
import { getProject } from "@/lib/spec";

/** NAV-012: the project menu, shown inside a project. */
export default async function ProjectLayout({ children, params }: { children: ReactNode; params: Promise<{ project: string }> }) {
  const { project: slug } = await params;
  const project = await getProject(slug);
  if (!project) notFound();
  const t = await getTranslations("ProjectMenu");
  const base = `/p/${project.slug}`;
  return (
    <div className="flex flex-col gap-6 md:flex-row">
      <aside className="md:w-48 md:shrink-0">
        <p className="truncate px-2.5 text-sm font-bold">
          {project.name}
        </p>
        {project.archivedAt ? <Badge className="mx-2.5 mt-1">{t("archived")}</Badge> : null}
        <nav className="mt-3 flex flex-wrap gap-1 md:flex-col" aria-label={t("label")}>
          <NavLink href={base} exact>
            {t("overview")}
          </NavLink>
          <NavLink href={`${base}/models`}>{t("models")}</NavLink>
          <NavLink href={`${base}/sources`}>{t("sources")}</NavLink>
        </nav>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

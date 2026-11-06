import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { getViewer } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { NewProjectDialog } from "./new-project-dialog";

/** SCR-010 */
export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ archived?: string }> }) {
  const t = await getTranslations("Projects");
  const format = await getFormatter();
  const viewer = await getViewer();
  const archived = (await searchParams).archived === "1";
  const canCreate = viewer?.account?.role !== "viewer";
  const supabase = await createSupabaseServerClient();
  const query = supabase.schema("app").from("projects").select("slug, name, description, created_at").order("name");
  const { data: projects } = await (archived ? query.not("archived_at", "is", null) : query.is("archived_at", null));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        {canCreate ? <NewProjectDialog /> : null}
      </div>
      <nav className="flex gap-2 text-sm" aria-label={t("filter")}>
        <Link href="/projects" className={cn("rounded-md px-3 py-1", !archived && "bg-line/40 font-semibold")}>
          {t("active")}
        </Link>
        <Link href="/projects?archived=1" className={cn("rounded-md px-3 py-1", archived && "bg-line/40 font-semibold")}>
          {t("archived")}
        </Link>
      </nav>
      {projects && projects.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <li key={project.slug}>
              <Link href={`/p/${project.slug}`} className="block h-full">
                <Card className="h-full transition-colors hover:border-brand">
                  <h2 className="font-bold">{project.name}</h2>
                  {project.description ? <p className="mt-1 line-clamp-2 text-sm text-muted">{project.description}</p> : null}
                  <p className="mt-3 text-xs text-muted">
                    {t("createdOn", { date: format.dateTime(new Date(project.created_at), { dateStyle: "medium" }) })}
                  </p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Card className="flex flex-col gap-2 text-center">
          <p className="font-semibold">{archived ? t("noArchived") : t("empty")}</p>
          {!archived ? <p className="text-sm text-muted">{canCreate ? t("emptyHint") : t("emptyViewer")}</p> : null}
        </Card>
      )}
    </div>
  );
}

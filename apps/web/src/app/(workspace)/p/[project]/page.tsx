import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** SCR-011, first version: the editor, sources and history come with the next steps of P2. */
export default async function ProjectPage({ params }: { params: Promise<{ project: string }> }) {
  const { project: slug } = await params;
  const t = await getTranslations("Project");
  const supabase = await createSupabaseServerClient();
  const { data: project } = await supabase.schema("app").from("projects").select("name, description").eq("slug", slug).maybeSingle();
  if (!project) notFound();
  return (
    <div className="flex flex-col gap-6">
      <Link href="/projects" className="text-sm text-muted hover:text-ink">
        {t("back")}
      </Link>
      <div>
        <h1 className="text-2xl font-bold">{project.name}</h1>
        {project.description ? <p className="mt-1 text-muted">{project.description}</p> : null}
      </div>
      <Card>
        <p className="text-sm text-muted">{t("comingNext")}</p>
      </Card>
    </div>
  );
}

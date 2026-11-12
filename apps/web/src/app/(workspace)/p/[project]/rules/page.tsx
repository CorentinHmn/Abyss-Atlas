import { notFound } from "next/navigation";
import { getProject } from "@/lib/spec";
import { ReusableList } from "../reusable-list";

/** SCR-040 */
export default async function RulesPage({ params }: { params: Promise<{ project: string }> }) {
  const project = await getProject((await params).project);
  if (!project) notFound();
  return <ReusableList project={project} kind="rule" />;
}

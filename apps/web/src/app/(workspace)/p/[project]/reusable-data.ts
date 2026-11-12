import type { Catalogue } from "@/components/spec/step-list";
import { usesOf } from "@/lib/reusable";
import { getObjects, type ProjectRow, getValidation } from "@/lib/spec";
import type { IssueView, UseView } from "./reusable-shared";

type Kind = "rule" | "value_mapping";

/** What a rule or value mapping editor needs: the object, its problems, where it is used and the catalogue. */
export async function loadReusable(project: ProjectRow, kind: Kind, id: string) {
  const [objects, validation] = await Promise.all([getObjects(project.id), getValidation(project.slug)]);
  const item = objects.find((object) => object.kind === kind && object.key === id);
  if (!item) return null;
  const uses: UseView[] = objects
    .filter((object) => (object.kind === "model" || object.kind === "rule") && object.key !== id)
    .filter((object) => (kind === "rule" ? usesOf(object.content).rules : usesOf(object.content).valueMappings).has(id))
    .map((object) => ({
      href: `/p/${project.slug}/${object.kind === "model" ? "models" : "rules"}/${object.key}`,
      label: `${String(object.content.name ?? object.key)} (${object.key})`,
    }));
  const issues: IssueView[] = (validation?.byPath.get(item.path) ?? []).map((issue) => ({ code: issue.code, severity: issue.severity, at: issue.at, message: issue.message }));
  const prefix = `${item.path}#`;
  const stepTypes = Object.fromEntries([...(validation?.stepTypes ?? new Map<string, string>())].filter(([key]) => key.startsWith(prefix)).map(([key, type]) => [key.slice(prefix.length), type]));
  const systems = new Map(objects.filter((object) => object.kind === "system").map((object) => [object.key, String(object.content.name ?? object.key)]));
  const lookups = objects
    .filter((object) => object.kind === "dataset" || object.kind === "model")
    .map((object) => ({
      key: object.key,
      label:
        object.kind === "dataset"
          ? `${systems.get(String(object.content.system)) ?? object.content.system} › ${String(object.content.name ?? object.content.id)}`
          : `${String(object.content.name ?? object.key)} (${object.key})`,
      columns: Object.keys((object.content.columns as object | undefined) ?? {}),
    }));
  const catalogue: Catalogue = {
    valueMappings: objects.filter((object) => object.kind === "value_mapping").map((object) => object.key),
    rules: objects
      .filter((object) => object.kind === "rule" && object.key !== id)
      .map((object) => ({ id: object.key, parameters: Object.keys((object.content.parameters as object | undefined) ?? {}) })),
    lookups,
  };
  return { item, uses, issues, stepTypes, catalogue };
}

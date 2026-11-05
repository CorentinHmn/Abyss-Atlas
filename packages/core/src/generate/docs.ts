/**
 * Markdown documentation (docs/05-modules/generation.md §3, UC-032): readable by analysts and stewards.
 */
import type { Project } from "../spec/load";
import type { Branch, Condition, Mapping, ModelSpec, Operand, Step } from "../spec/schemas";
import type { ValidationResult } from "../validate/validate";
import { GenerationError, type GeneratedFile } from "./dbt";

const OPS: Record<string, string> = { eq: "=", ne: "≠", lt: "<", le: "≤", gt: ">", ge: "≥", like: "like" };
const cell = (text: string) => text.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();

/** Alias → readable name of what it reads (`KNA1`, `int_mes_order_output`). */
function aliasNames(project: Project, branch: Branch): Map<string, string> {
  const names = new Map<string, string>();
  for (const use of branch.datasets) {
    const [alias = "", ref = ""] = Object.entries(use)[0] ?? [];
    names.set(alias, project.datasets.get(ref)?.spec.name ?? ref);
  }
  return names;
}

function describeOperand(names: Map<string, string>, value: Operand): string {
  if (typeof value === "string") {
    if (value === "current") return "the value";
    const [alias = "", column = ""] = value.split(".");
    return `${names.get(alias) ?? alias}.${column}`;
  }
  if ("value" in value) return `"${value.value}"`;
  if ("param" in value) return value.param;
  return `${value.calculate.function}(${value.calculate.args.map((arg) => describeOperand(names, arg)).join(", ")})`;
}

function describeCondition(names: Map<string, string>, c: Condition): string {
  if ("all" in c) return c.all.map((child) => describeCondition(names, child)).join(" and ");
  if ("any" in c) return `(${c.any.map((child) => describeCondition(names, child)).join(" or ")})`;
  if ("not" in c) return `not (${describeCondition(names, c.not)})`;
  if ("sql" in c) return `SQL: \`${c.sql}\``;
  const left = describeOperand(names, c.left);
  switch (c.op) {
    case "is_null":
      return `${left} is empty`;
    case "is_not_null":
      return `${left} is filled`;
    case "in":
      return `${left} in (${(c.values ?? []).map((v) => `"${v}"`).join(", ")})`;
    case "not_in":
      return `${left} not in (${(c.values ?? []).map((v) => `"${v}"`).join(", ")})`;
    case "between":
      return `${left} between "${c.values?.[0] ?? ""}" and "${c.values?.[1] ?? ""}"`;
    default:
      return `${left} ${OPS[c.op] ?? c.op} ${c.right !== undefined ? describeOperand(names, c.right) : `"${c.value ?? ""}"`}`;
  }
}

function describeStep(project: Project, names: Map<string, string>, step: Step, link: (kind: "rules" | "value-mappings", id: string) => string): string {
  if (step === "copy") return "copied";
  if ("constant" in step) return `always "${step.constant.value}"`;
  if ("default" in step) return `"${step.default.value}" when empty`;
  if ("convert" in step) return `converted to ${step.convert.to}${step.convert.pattern ? ` (${step.convert.pattern})` : ""}${step.convert.on_error === "set_null" ? ", empty when invalid" : ""}`;
  if ("map_values" in step) return `translated with ${link("value-mappings", step.map_values.mapping)}`;
  if ("case" in step) {
    const whens = step.case.when.map((w) => `if ${describeCondition(names, w.if)} then ${describeOperand(names, w.then)}`).join("; ");
    return `${whens}${step.case.else !== undefined ? `; otherwise ${describeOperand(names, step.case.else)}` : ""}`;
  }
  if ("calculate" in step) return `${step.calculate.function}(${step.calculate.args.map((arg) => describeOperand(names, arg)).join(", ")})`;
  if ("concat" in step) return `joined: ${step.concat.parts.map((part) => describeOperand(names, part)).join(" + ")}${step.concat.separator ? ` (separator "${step.concat.separator}")` : ""}`;
  if ("lookup" in step) {
    const local = new Map([...names, [step.lookup.alias, project.datasets.get(step.lookup.dataset)?.spec.name ?? step.lookup.dataset]]);
    return `looked up in ${local.get(step.lookup.alias)} where ${describeCondition(local, step.lookup.match)}: ${describeOperand(local, step.lookup.return)}`;
  }
  if ("aggregate" in step) return `${step.aggregate.replace("_", " ")} per group`;
  if ("rule" in step) {
    const args = Object.entries(step.rule.args).map(([name, arg]) => `${name} = ${describeOperand(names, arg)}`).join(", ");
    return `rule ${link("rules", step.rule.id)} (${args})`;
  }
  return `**SQL** \`${step.sql.expression}\` — ${step.sql.reason.trim()}`;
}

function describeMapping(project: Project, names: Map<string, string>, mapping: Mapping, link: (kind: "rules" | "value-mappings", id: string) => string): string {
  if (typeof mapping === "string") return describeOperand(names, mapping);
  if ("not_provided" in mapping) return `*not provided*: ${mapping.not_provided}`;
  const inputs = (mapping.inputs ?? []).map((input) => describeOperand(names, input));
  const steps = (mapping.steps ?? []).map((step) => describeStep(project, names, step, link));
  return [inputs.join(", "), ...steps].filter(Boolean).join(" → ");
}

function modelPage(project: Project, model: ModelSpec): string {
  const link = (kind: "rules" | "value-mappings", id: string) => `[${id}](../../${kind}/${id}.md)`;
  const lines = [
    `# ${model.name} (\`${model.id}\`)`,
    "",
    model.description.trim(),
    "",
    `| Domain | Grain | Key | Layer |`,
    `|---|---|---|---|`,
    `| ${model.domain} | ${cell(model.grain.description)} | ${model.grain.key.join(", ")} | ${model.layer ?? ""} |`,
    "",
    "## Sources",
  ];
  for (const [branchId, branch] of Object.entries(model.branches)) {
    const names = aliasNames(project, branch);
    const reads = branch.datasets.map((use) => {
      const [alias = "", ref = ""] = Object.entries(use)[0] ?? [];
      return project.datasets.has(ref) ? `${names.get(alias)} (${ref})` : `[${ref}](../${project.models.get(ref)?.spec.domain ?? ""}/${ref}.md)`;
    });
    lines.push("", `### ${branch.label ?? branchId}`, "", `Reads ${reads.join(", ")}.`);
    for (const join of branch.joins ?? []) {
      lines.push(`- ${join.type} join ${names.get(join.right)} on ${describeCondition(names, join.condition)} (${join.cardinality.replace(/_/g, "-")}${join.confirmed ? ", confirmed" : ""})${join.description ? `: ${join.description.trim().replace(/\s+/g, " ")}` : ""}`);
    }
    if (branch.filter) lines.push(`- Keeps rows where ${describeCondition(names, branch.filter)}.`);
    if (branch.deduplicate) lines.push(`- One row per ${branch.deduplicate.key.map((ref) => describeOperand(names, ref)).join(", ")} (keeps the ${branch.deduplicate.keep}).`);
    if (branch.group_by) lines.push(`- Grouped by ${branch.group_by.map((ref) => describeOperand(names, ref)).join(", ")}.`);
  }
  const consolidation = model.consolidation;
  if (consolidation) {
    lines.push("", "## Consolidation", "", `Rows of every source are combined (${consolidation.combine.replace("_", " ")}).`);
    if (consolidation.match) lines.push(`The same entity is recognized by ${consolidation.match.join(", ")}; rows without it are never merged. Priority: ${consolidation.survivorship?.priority.join(" > ")}.`);
    if (consolidation.add_source_column) lines.push(`Column \`${consolidation.add_source_column}\` tells which source each row comes from.`);
  }
  lines.push("", "## Columns", "", `| Column | Type | Definition | ${Object.entries(model.branches).map(([id, b]) => b.label ?? id).join(" | ")} |`, `|---|---|---|${Object.keys(model.branches).map(() => "---|").join("")}`);
  for (const [name, col] of Object.entries(model.columns)) {
    const provenance = Object.entries(model.branches).map(([branchId, branch]) => {
      const mapping = col.from[branchId] ?? col.from["*"];
      return mapping === undefined ? "" : cell(describeMapping(project, aliasNames(project, branch), mapping, link));
    });
    lines.push(`| \`${name}\`${col.key ? " (key)" : ""} | ${col.type} | ${cell(col.definition)} | ${provenance.join(" | ")} |`);
  }
  return `${lines.join("\n")}\n`;
}

/** UC-032: the Markdown documentation of a valid project (GEN-070…GEN-072). */
export function generateDocs(result: ValidationResult): GeneratedFile[] {
  if (result.errors > 0) throw new GenerationError(`The project has ${result.errors} validation error(s): fix them before generating (VAL-000).`);
  const { project } = result;
  const spec = project.project?.spec;
  const files: GeneratedFile[] = [];
  const index = [
    `# ${spec?.name ?? "Project"}`,
    "",
    spec?.description?.trim() ?? "",
    "",
    `Unstructured logic (SQL escape hatches): ${(result.unstructuredShare * 100).toFixed(1)} % of the target columns.`,
    "",
  ];
  for (const code of [...project.domains.keys()].sort()) {
    const domain = project.domains.get(code)?.spec;
    const models = [...project.models.values()].filter((m) => m.spec.domain === code).map((m) => m.spec).sort((a, b) => a.id.localeCompare(b.id));
    index.push(`## ${code} — ${domain?.name ?? ""}`, "", domain?.description ?? "", "", `Owner: ${domain?.owner ?? ""}. Stewards: ${domain?.stewards.join(", ") ?? ""}.`, "");
    for (const model of models) {
      index.push(`- [${model.name}](models/${code}/${model.id}.md): ${model.description.trim().replace(/\s+/g, " ")}`);
      files.push({ path: `models/${code}/${model.id}.md`, content: modelPage(project, model) });
    }
    index.push("");
  }
  index.push("## Business rules", "", ...[...project.rules.values()].map((r) => `- [${r.spec.name}](rules/${r.spec.id}.md) (${r.spec.domain})`), "");
  index.push("## Value mappings", "", ...[...project.valueMappings.values()].map((v) => `- [${v.spec.name}](value-mappings/${v.spec.id}.md) (${v.spec.domain})`), "");
  files.push({ path: "index.md", content: `${index.join("\n")}\n` });

  for (const { spec: rule } of project.rules.values()) {
    const link = (kind: "rules" | "value-mappings", id: string) => `[${id}](../${kind}/${id}.md)`;
    const names = new Map<string, string>();
    const steps = rule.logic.map((step, i) => `${i + 1}. ${describeStep(project, names, step, link)}`);
    files.push({
      path: `rules/${rule.id}.md`,
      content: [`# ${rule.name} (\`${rule.id}\`)`, "", `Domain: ${rule.domain}`, "", rule.statement.trim(), "", "| Parameter | Type |", "|---|---|", ...Object.entries(rule.parameters).map(([n, t]) => `| ${n} | ${t} |`), "", `Returns ${rule.returns}.`, "", "## Logic", "", ...steps, ""].join("\n"),
    });
  }
  for (const { spec: vm } of project.valueMappings.values()) {
    files.push({
      path: `value-mappings/${vm.id}.md`,
      content: [`# ${vm.name} (\`${vm.id}\`)`, "", `Domain: ${vm.domain}. From ${vm.from_type} to ${vm.to_type}.${vm.default !== undefined ? ` Default: "${vm.default}".` : ""}`, "", "| From | To |", "|---|---|", ...Object.entries(vm.entries ?? {}).map(([k, v]) => `| ${cell(k)} | ${cell(v)} |`), ""].join("\n"),
    });
  }
  const header = `<!-- Generated by Atlas from project "${spec?.id ?? "project"}" (format 1). Do not edit: change the spec in Atlas instead. -->\n`;
  return files.map((file) => ({ ...file, content: header + file.content })).sort((a, b) => a.path.localeCompare(b.path));
}

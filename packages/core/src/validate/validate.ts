/**
 * Validation of a project (docs/05-modules/validation.md). Each issue code is a VAL-xxx requirement.
 */
import { loadProject, type Loaded, type Project, type SpecFile } from "../spec/load";
import type { Condition, DatasetSpec, Mapping, ModelSpec, Operand, QualityCheck, Step } from "../spec/schemas";
import { checkArgument, FUNCTIONS, literalFits, type ValueType } from "../types/functions";
import { formatLogicalType, isComparable, isImplicitlyAssignable, isNumeric, parseLogicalType, type LogicalType } from "../types/logical-types";
import { IssueList, type Issue } from "./issues";

export interface ValidationResult {
  project: Project;
  issues: Issue[];
  errors: number;
  warnings: number;
  /** VAL-070: share of target columns whose logic contains an `sql` escape hatch (0 to 1). */
  unstructuredShare: number;
}

interface ColumnInfo {
  type: LogicalType;
  nativeType?: string;
}
type Columns = Map<string, ColumnInfo>;

interface Context {
  file: string;
  issues: IssueList;
  scope: Map<string, Columns>;
  params?: Map<string, LogicalType>;
  /** Primary keys of the datasets in scope, by alias (for VAL-034). */
  keys?: Map<string, string[]>;
  sqlSeen: { value: boolean };
}

const REF = /^([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z0-9_]+)$/;
const known = (type: LogicalType): ValueType => ({ type });
const typeName = (value: ValueType): string => ("type" in value ? formatLogicalType(value.type) : "literal" in value ? `"${value.literal}"` : "unknown");

function mustType(text: string): LogicalType {
  const type = parseLogicalType(text);
  if (!type) throw new Error(`Invalid logical type ${text}; the schemas should have rejected it.`);
  return type;
}

function datasetColumns(dataset: DatasetSpec): Columns {
  return new Map(
    Object.entries(dataset.columns).map(([name, column]) => [
      name,
      { type: mustType(column.type), ...(column.native_type ? { nativeType: column.native_type } : {}) },
    ]),
  );
}

function modelColumns(model: ModelSpec): Columns {
  const columns: Columns = new Map(Object.entries(model.columns).map(([name, column]) => [name, { type: mustType(column.type) }]));
  if (model.consolidation?.add_source_column) columns.set(model.consolidation.add_source_column, { type: { kind: "string", length: 20 } });
  return columns;
}

/** Columns and primary key of a `system.dataset` or a model id (chain). */
function resolveSource(project: Project, ref: string): { columns: Columns; key: string[] } | null {
  const dataset = project.datasets.get(ref);
  if (dataset) return { columns: datasetColumns(dataset.spec), key: dataset.spec.primary_key ?? [] };
  const model = project.models.get(ref);
  if (model) return { columns: modelColumns(model.spec), key: model.spec.grain.key };
  return null;
}

// -----------------------------------------------------------------------------------------------------------------
// Operands, conditions, steps
// -----------------------------------------------------------------------------------------------------------------

function resolveColumn(ctx: Context, ref: string, at: string): ValueType {
  const match = REF.exec(ref);
  if (!match) return { unknown: true };
  const [, alias = "", column = ""] = match;
  const columns = ctx.scope.get(alias);
  if (!columns) {
    ctx.issues.error("VAL-020", ctx.file, at, `Unknown alias "${alias}" in ${ref}.`);
    return { unknown: true };
  }
  const info = columns.get(column);
  if (!info) {
    ctx.issues.error("VAL-020", ctx.file, at, `Unknown column ${ref}: "${alias}" has no column ${column}.`);
    return { unknown: true };
  }
  return known(info.type);
}

function nativeTypeOf(ctx: Context, ref: string): string | undefined {
  const match = REF.exec(ref);
  return match ? ctx.scope.get(match[1] ?? "")?.get(match[2] ?? "")?.nativeType : undefined;
}

function operandType(ctx: Context, operand: Operand, at: string, current: ValueType | undefined): ValueType {
  if (typeof operand === "string") {
    if (operand === "current") {
      if (!current) {
        ctx.issues.error("VAL-043", ctx.file, at, "There is no current value here: give exactly one input, or start with a step that produces a value.");
        return { unknown: true };
      }
      return current;
    }
    return resolveColumn(ctx, operand, at);
  }
  if ("value" in operand) return { literal: operand.value };
  if ("param" in operand) {
    const type = ctx.params?.get(operand.param);
    if (!type) {
      ctx.issues.error("VAL-020", ctx.file, at, `Unknown parameter ${operand.param}.`);
      return { unknown: true };
    }
    return known(type);
  }
  return checkCalculate(ctx, operand.calculate, at, current);
}

function checkCalculate(ctx: Context, calc: { function: string; args: Operand[] }, at: string, current: ValueType | undefined): ValueType {
  const signature = FUNCTIONS[calc.function];
  const args = calc.args.map((arg, index) => operandType(ctx, arg, `${at}.args[${index}]`, current));
  if (!signature) {
    ctx.issues.error("VAL-047", ctx.file, at, `Unknown function "${calc.function}". Available: ${Object.keys(FUNCTIONS).join(", ")}.`);
    return { unknown: true };
  }
  const min = signature.args.length;
  if (args.length < min || (!signature.rest && args.length > min)) {
    ctx.issues.error("VAL-047", ctx.file, at, `${calc.function} takes ${signature.rest ? `at least ${min}` : min} argument(s), not ${args.length}.`);
    return { unknown: true };
  }
  args.forEach((arg, index) => {
    const kind = signature.args[index] ?? signature.rest ?? "any";
    const problem = checkArgument(kind, arg);
    if (problem) ctx.issues.error("VAL-047", ctx.file, `${at}.args[${index}]`, `${calc.function}: argument ${index + 1}, ${problem}.`);
  });
  return signature.result(args);
}

function checkComparable(ctx: Context, a: ValueType, b: ValueType, at: string): void {
  if ("type" in a && "type" in b && !isComparable(a.type, b.type)) {
    ctx.issues.error("VAL-032", ctx.file, at, `Cannot compare ${typeName(a)} with ${typeName(b)}: convert one of them first.`);
  }
  for (const [typed, other] of [[a, b], [b, a]] as const) {
    if ("type" in typed && "literal" in other && !literalFits(other.literal, typed.type) && typed.type.kind !== "string") {
      ctx.issues.error("VAL-032", ctx.file, at, `${typeName(other)} is not a valid ${formatLogicalType(typed.type)} value.`);
    }
  }
}

function checkCondition(ctx: Context, condition: Condition, at: string, current: ValueType | undefined): void {
  if ("all" in condition) return condition.all.forEach((child, index) => checkCondition(ctx, child, `${at}.all[${index}]`, current));
  if ("any" in condition) return condition.any.forEach((child, index) => checkCondition(ctx, child, `${at}.any[${index}]`, current));
  if ("not" in condition) return checkCondition(ctx, condition.not, `${at}.not`, current);
  if ("sql" in condition) {
    ctx.sqlSeen.value = true;
    ctx.issues.warning("VAL-046", ctx.file, at, "Unstructured SQL condition: Atlas cannot check its types or lineage.");
    return;
  }
  const left = operandType(ctx, condition.left, `${at}.left`, current);
  const unary = condition.op === "is_null" || condition.op === "is_not_null";
  const list = condition.op === "in" || condition.op === "not_in" || condition.op === "between";
  const others = [condition.right, condition.value, condition.values].filter((value) => value !== undefined).length;
  if (unary && others > 0) ctx.issues.error("VAL-013", ctx.file, at, `${condition.op} takes no value.`);
  if (!unary && others !== 1) ctx.issues.error("VAL-013", ctx.file, at, `${condition.op} needs exactly one of right, value or values.`);
  if (list && condition.values === undefined) ctx.issues.error("VAL-013", ctx.file, at, `${condition.op} needs a list: values: [...].`);
  if (condition.op === "between" && condition.values && condition.values.length !== 2) ctx.issues.error("VAL-013", ctx.file, at, "between needs exactly two values.");
  if (condition.right !== undefined) checkComparable(ctx, left, operandType(ctx, condition.right, `${at}.right`, current), at);
  if (condition.value !== undefined) checkComparable(ctx, left, { literal: condition.value }, at);
  for (const value of condition.values ?? []) checkComparable(ctx, left, { literal: value }, at);
}

/** Columns compared with `=` to another column or a literal in a condition (for VAL-034). */
function equalityColumns(condition: Condition, alias: string): Set<string> {
  const found = new Set<string>();
  const visit = (c: Condition) => {
    if ("all" in c) return c.all.forEach(visit);
    if (!("left" in c) || c.op !== "eq") return;
    for (const side of [c.left, c.right]) {
      const match = typeof side === "string" ? REF.exec(side) : null;
      if (match?.[1] === alias && match[2]) found.add(match[2]);
    }
  };
  visit(condition);
  return found;
}

interface StepOptions {
  project: Project;
  grouped: boolean;
  /** Native type of the single input, for the traps of VAL-044. */
  nativeType?: string;
}

function checkSteps(ctx: Context, steps: Step[], at: string, start: ValueType | undefined, options: StepOptions): ValueType | undefined {
  let current = start;
  const need = (stepAt: string, kind: string): ValueType | undefined => {
    if (!current) ctx.issues.error("VAL-043", ctx.file, stepAt, `${kind} works on the current value, and there is none: give exactly one input or start with a step that produces a value.`);
    return current;
  };

  steps.forEach((step, index) => {
    const stepAt = `${at}[${index}]`;
    if (step === "copy") {
      need(stepAt, "copy");
      return;
    }
    if ("constant" in step) {
      current = { literal: step.constant.value };
    } else if ("default" in step) {
      const value = need(stepAt, "default");
      if (value && "type" in value && !literalFits(step.default.value, value.type)) {
        ctx.issues.error("VAL-043", ctx.file, stepAt, `Default "${step.default.value}" is not a valid ${formatLogicalType(value.type)} value.`);
      }
    } else if ("convert" in step) {
      const value = need(stepAt, "convert");
      const to = mustType(step.convert.to);
      if (step.convert.on_error === "use_default" && step.convert.default === undefined) {
        ctx.issues.error("VAL-013", ctx.file, stepAt, "on_error: use_default needs a default value.");
      }
      if (step.convert.method === "parse" && value && "type" in value && value.type.kind !== "string") {
        ctx.issues.error("VAL-043", ctx.file, stepAt, `parse reads text, not ${formatLogicalType(value.type)}: use method: cast.`);
      }
      if (step.convert.method === "format" && to.kind !== "string") {
        ctx.issues.error("VAL-043", ctx.file, stepAt, "format produces text: convert to a string type.");
      }
      if (index === 0 && options.nativeType && /^NUMC/i.test(options.nativeType) && isNumeric(to)) {
        ctx.issues.warning("VAL-044", ctx.file, stepAt, `The source is ${options.nativeType} (text with leading zeros): converting it to a number removes them. Check that this is intended.`);
      }
      if (value && "type" in value && value.type.kind === "decimal" && to.kind === "decimal" && to.scale < value.type.scale) {
        ctx.issues.warning("VAL-044", ctx.file, stepAt, `Precision is lost: ${formatLogicalType(value.type)} converted to ${formatLogicalType(to)}.`);
      }
      current = known(to);
    } else if ("map_values" in step) {
      const value = need(stepAt, "map_values");
      const mapping = options.project.valueMappings.get(step.map_values.mapping);
      if (!mapping) {
        ctx.issues.error("VAL-020", ctx.file, stepAt, `Unknown value mapping ${step.map_values.mapping}.`);
        current = { unknown: true };
        return;
      }
      const from = mustType(mapping.spec.from_type);
      if (value && "type" in value && !isImplicitlyAssignable(value.type, from) && !isComparable(value.type, from)) {
        ctx.issues.error("VAL-048", ctx.file, stepAt, `${step.map_values.mapping} translates ${mapping.spec.from_type} values; the current value is ${formatLogicalType(value.type)}.`);
      }
      if (step.map_values.on_unmatched === "use_default" && mapping.spec.default === undefined) {
        ctx.issues.error("VAL-013", ctx.file, stepAt, `on_unmatched: use_default, but ${step.map_values.mapping} has no default.`);
      }
      current = known(mustType(mapping.spec.to_type));
    } else if ("case" in step) {
      const results: ValueType[] = [];
      step.case.when.forEach((branch, i) => {
        checkCondition(ctx, branch.if, `${stepAt}.case.when[${i}].if`, current);
        results.push(operandType(ctx, branch.then, `${stepAt}.case.when[${i}].then`, current));
      });
      if (step.case.else !== undefined) results.push(operandType(ctx, step.case.else, `${stepAt}.case.else`, current));
      current = results.find((result) => "type" in result) ?? results[0] ?? { unknown: true };
    } else if ("calculate" in step) {
      current = checkCalculate(ctx, step.calculate, `${stepAt}.calculate`, current);
    } else if ("concat" in step) {
      const parts = step.concat.parts.map((part, i) => operandType(ctx, part, `${stepAt}.concat.parts[${i}]`, current));
      const lengths = parts.map((part) => ("literal" in part ? part.literal.length : "type" in part && part.type.kind === "string" ? part.type.length : undefined));
      const separator = step.concat.separator ?? "";
      current = lengths.every((length) => length !== undefined)
        ? known({ kind: "string", length: lengths.reduce((sum: number, length) => sum + (length ?? 0), 0) + separator.length * (parts.length - 1) })
        : known({ kind: "string" });
    } else if ("lookup" in step) {
      const lookup = step.lookup;
      const source = resolveSource(options.project, lookup.dataset);
      if (!source) {
        ctx.issues.error("VAL-020", ctx.file, stepAt, `Unknown dataset or model ${lookup.dataset} in lookup.`);
        current = { unknown: true };
        return;
      }
      if (ctx.scope.has(lookup.alias)) {
        ctx.issues.error("VAL-017", ctx.file, stepAt, `The lookup alias "${lookup.alias}" is already used in this branch.`);
      }
      const local: Context = { ...ctx, scope: new Map([...ctx.scope, [lookup.alias, source.columns]]) };
      checkCondition(local, lookup.match, `${stepAt}.lookup.match`, current);
      const returned = REF.exec(lookup.return);
      if (returned?.[1] !== lookup.alias) {
        ctx.issues.error("VAL-020", ctx.file, `${stepAt}.lookup.return`, `return must be a column of the looked-up dataset (${lookup.alias}.COLUMN).`);
      }
      current = resolveColumn(local, lookup.return, `${stepAt}.lookup.return`);
      const covered = equalityColumns(lookup.match, lookup.alias);
      if (source.key.length > 0 && !source.key.every((column) => covered.has(column))) {
        ctx.issues.warning("VAL-034", ctx.file, `${stepAt}.lookup.match`, `The match does not cover the key of ${lookup.dataset} (${source.key.join(", ")}): the lookup may find several rows.`);
      }
      if (lookup.on_missing === "use_default" && lookup.default === undefined) {
        ctx.issues.error("VAL-013", ctx.file, stepAt, "on_missing: use_default needs a default value.");
      }
    } else if ("aggregate" in step) {
      const value = need(stepAt, "aggregate");
      if (!options.grouped) ctx.issues.error("VAL-035", ctx.file, stepAt, "Aggregation is only possible in a branch with group_by (MM-112).");
      if (index !== steps.length - 1) ctx.issues.error("VAL-035", ctx.file, stepAt, "Aggregation must be the last step (MM-112).");
      const fn = step.aggregate;
      if ((fn === "sum" || fn === "avg") && value && "type" in value && !isNumeric(value.type)) {
        ctx.issues.error("VAL-043", ctx.file, stepAt, `${fn} needs numbers, not ${formatLogicalType(value.type)}.`);
      }
      if (fn === "count" || fn === "count_distinct") current = known({ kind: "bigint" });
      else if (fn === "sum" && value && "type" in value) {
        current = value.type.kind === "decimal" ? known({ kind: "decimal", precision: 38, scale: value.type.scale }) : value.type.kind === "float" ? value : known({ kind: "bigint" });
      } else if (fn === "avg") current = known({ kind: "decimal", precision: 38, scale: 6 });
    } else if ("rule" in step) {
      const rule = options.project.rules.get(step.rule.id);
      if (!rule) {
        ctx.issues.error("VAL-020", ctx.file, stepAt, `Unknown business rule ${step.rule.id}.`);
        current = { unknown: true };
        return;
      }
      const params = Object.keys(rule.spec.parameters);
      const args = Object.keys(step.rule.args);
      const missing = params.filter((p) => !args.includes(p));
      const extra = args.filter((a) => !params.includes(a));
      if (missing.length > 0 || extra.length > 0) {
        ctx.issues.error("VAL-023", ctx.file, stepAt, `Arguments of ${step.rule.id} must be exactly: ${params.join(", ")}.${missing.length ? ` Missing: ${missing.join(", ")}.` : ""}${extra.length ? ` Unknown: ${extra.join(", ")}.` : ""}`);
      }
      for (const [name, arg] of Object.entries(step.rule.args)) {
        const value = operandType(ctx, arg, `${stepAt}.rule.args.${name}`, current);
        const paramText = rule.spec.parameters[name];
        if (!paramText) continue;
        const param = mustType(paramText);
        if ("type" in value && !isImplicitlyAssignable(value.type, param)) {
          ctx.issues.error("VAL-043", ctx.file, `${stepAt}.rule.args.${name}`, `${step.rule.id} expects ${name} as ${paramText}; got ${formatLogicalType(value.type)}. Convert it first.`);
        }
        if ("literal" in value && !literalFits(value.literal, param)) {
          ctx.issues.error("VAL-043", ctx.file, `${stepAt}.rule.args.${name}`, `"${value.literal}" is not a valid ${paramText} value for ${name}.`);
        }
      }
      current = known(mustType(rule.spec.returns));
    } else if ("sql" in step) {
      ctx.sqlSeen.value = true;
      ctx.issues.warning("VAL-046", ctx.file, stepAt, `Unstructured SQL: Atlas cannot check its types or lineage. Reason given: ${step.sql.reason.trim()}`);
      current = { unknown: true };
    }
  });
  return current;
}

function checkResultType(ctx: Context, result: ValueType | undefined, target: LogicalType, at: string, label: string): void {
  if (!result) {
    ctx.issues.error("VAL-042", ctx.file, at, `${label} produces no value.`);
    return;
  }
  if ("type" in result && !isImplicitlyAssignable(result.type, target)) {
    ctx.issues.error("VAL-042", ctx.file, at, `${label} produces ${formatLogicalType(result.type)}, but ${formatLogicalType(target)} is expected: add a convert step (MM-411).`);
  }
  if ("literal" in result && !literalFits(result.literal, target)) {
    ctx.issues.error("VAL-042", ctx.file, at, `"${result.literal}" is not a valid ${formatLogicalType(target)} value.`);
  }
}

// -----------------------------------------------------------------------------------------------------------------
// Objects
// -----------------------------------------------------------------------------------------------------------------

function findCycles(graph: Map<string, Set<string>>): string[][] {
  const cycles: string[][] = [];
  const state = new Map<string, "visiting" | "done">();
  const visit = (node: string, path: string[]) => {
    if (state.get(node) === "done") return;
    if (state.get(node) === "visiting") {
      cycles.push([...path.slice(path.indexOf(node)), node]);
      return;
    }
    state.set(node, "visiting");
    for (const next of graph.get(node) ?? []) visit(next, [...path, node]);
    state.set(node, "done");
  };
  for (const node of [...graph.keys()].sort()) visit(node, []);
  return cycles;
}

function rulesCalled(steps: Step[]): string[] {
  return steps.flatMap((step) => (typeof step === "object" && "rule" in step ? [step.rule.id] : []));
}

function checkQuality(ctx: Context, project: Project, model: ModelSpec, checks: QualityCheck[], at: string): void {
  checks.forEach((check, index) => {
    const checkAt = `${at}[${index}]`;
    if (typeof check === "string") return;
    if ("relationship" in check) {
      const [modelId = "", column = ""] = check.relationship.to.split(".");
      const target = project.models.get(modelId);
      if (!target || !(column in target.spec.columns)) {
        ctx.issues.error("VAL-050", ctx.file, checkAt, `Relationship to unknown column ${check.relationship.to}.`);
      }
    }
    if ("accepted_values" in check) {
      const { values, mapping } = check.accepted_values;
      if ((values === undefined) === (mapping === undefined)) ctx.issues.error("VAL-013", ctx.file, checkAt, "accepted_values takes either values or mapping.");
      if (mapping && !project.valueMappings.has(mapping)) ctx.issues.error("VAL-050", ctx.file, checkAt, `Unknown value mapping ${mapping}.`);
    }
    if ("unique_combination" in check) {
      for (const column of check.unique_combination.columns) {
        if (!(column in model.columns)) ctx.issues.error("VAL-050", ctx.file, checkAt, `Unknown column ${column} in unique_combination.`);
      }
    }
  });
}

function checkModel(project: Project, loaded: Loaded<ModelSpec>, issues: IssueList): { columns: number; unstructured: number } {
  const model = loaded.spec;
  const file = loaded.path;
  let unstructured = 0;

  if (!project.domains.has(model.domain)) issues.error("VAL-024", file, "domain", `Unknown domain ${model.domain}: it must be in the organization's catalogue (MM-020).`);
  for (const key of model.grain.key) {
    if (!(key in model.columns)) issues.error("VAL-020", file, "grain.key", `Grain key ${key} is not a column of the model.`);
  }

  // Branches
  const scopes = new Map<string, Context>();
  for (const [branchId, branch] of Object.entries(model.branches)) {
    const at = `branches.${branchId}`;
    const ctx: Context = { file, issues, scope: new Map(), keys: new Map(), sqlSeen: { value: false } };
    branch.datasets.forEach((use, index) => {
      const [alias = "", ref = ""] = Object.entries(use)[0] ?? [];
      if (ctx.scope.has(alias)) issues.error("VAL-017", file, `${at}.datasets[${index}]`, `Alias "${alias}" is used twice in branch ${branchId}.`);
      if (ref === model.id) issues.error("VAL-021", file, `${at}.datasets[${index}]`, "A model cannot read itself (MM-111).");
      const source = resolveSource(project, ref);
      if (!source) {
        issues.error("VAL-020", file, `${at}.datasets[${index}]`, `Unknown dataset or model ${ref}. Datasets are written system.dataset.`);
        ctx.scope.set(alias, new Map());
        return;
      }
      ctx.scope.set(alias, source.columns);
      ctx.keys?.set(alias, source.key);
    });

    const joined = new Set<string>([Object.keys(branch.datasets[0] ?? {})[0] ?? ""]);
    (branch.joins ?? []).forEach((join, index) => {
      const joinAt = `${at}.joins[${index}]`;
      for (const side of [join.left, join.right]) {
        if (!ctx.scope.has(side)) issues.error("VAL-020", file, joinAt, `Unknown alias "${side}" in join.`);
      }
      joined.add(join.left).add(join.right);
      if (join.cardinality === "many_to_many") {
        if (join.confirmed === true) issues.warning("VAL-031", file, joinAt, `Confirmed many-to-many join ${join.left} → ${join.right}: rows are multiplied.`);
        else issues.error("VAL-031", file, joinAt, `Many-to-many join ${join.left} → ${join.right} multiplies rows: confirm it with confirmed: true (MM-121).`);
      }
      checkCondition(ctx, join.condition, `${joinAt}.condition`, undefined);
    });
    for (const alias of ctx.scope.keys()) {
      if (!joined.has(alias)) issues.error("VAL-020", file, `${at}.datasets`, `Dataset "${alias}" is not joined to the others: add a join.`);
    }
    if (branch.filter) checkCondition(ctx, branch.filter, `${at}.filter`, undefined);
    if (branch.deduplicate) {
      branch.deduplicate.key.forEach((ref, i) => resolveColumn(ctx, ref, `${at}.deduplicate.key[${i}]`));
      (branch.deduplicate.order_by ?? []).forEach((order, i) => resolveColumn(ctx, order.column, `${at}.deduplicate.order_by[${i}]`));
    }
    (branch.group_by ?? []).forEach((ref, i) => resolveColumn(ctx, ref, `${at}.group_by[${i}]`));
    scopes.set(branchId, ctx);
  }

  // Consolidation
  const branchIds = Object.keys(model.branches);
  const consolidation = model.consolidation;
  if (branchIds.length > 1 && !consolidation) issues.error("VAL-030", file, "branches", "A model with several branches needs a consolidation (union).");
  if (consolidation) {
    for (const column of consolidation.match ?? []) {
      if (!(column in model.columns)) issues.error("VAL-036", file, "consolidation.match", `Match on unknown column ${column}.`);
    }
    if (consolidation.match && !consolidation.survivorship) issues.error("VAL-036", file, "consolidation", "A match needs a survivorship (which branch wins).");
    const survivorship = consolidation.survivorship;
    if (survivorship) {
      for (const branchId of survivorship.priority) {
        if (!branchIds.includes(branchId)) issues.error("VAL-036", file, "consolidation.survivorship.priority", `Unknown branch ${branchId}.`);
      }
      for (const branchId of branchIds) {
        if (!survivorship.priority.includes(branchId)) issues.error("VAL-036", file, "consolidation.survivorship.priority", `Branch ${branchId} is missing from the priority.`);
      }
      for (const [column, strategy] of Object.entries(survivorship.columns ?? {})) {
        const at = `consolidation.survivorship.columns.${column}`;
        if (!(column in model.columns)) issues.error("VAL-036", file, at, `Unknown column ${column}.`);
        for (const branchId of strategy.priority ?? []) {
          if (!branchIds.includes(branchId)) issues.error("VAL-036", file, at, `Unknown branch ${branchId}.`);
        }
        if (strategy.strategy === "most_recent" && !(strategy.by && strategy.by in model.columns)) issues.error("VAL-036", file, at, "most_recent needs by: <column of the model>.");
        if (strategy.strategy === "rule" && !(strategy.rule && project.rules.has(strategy.rule))) issues.error("VAL-036", file, at, "strategy rule needs rule: <existing rule>.");
      }
    }
    if (consolidation.add_source_column && consolidation.add_source_column in model.columns) {
      issues.error("VAL-017", file, "consolidation.add_source_column", `${consolidation.add_source_column} is already a column of the model.`);
    }
  }

  // Columns
  for (const [name, column] of Object.entries(model.columns)) {
    const at = `columns.${name}`;
    const target = mustType(column.type);
    let usesSql = false;
    for (const key of Object.keys(column.from)) {
      if (key !== "*" && !branchIds.includes(key)) issues.error("VAL-020", file, `${at}.from.${key}`, `Unknown branch ${key}.`);
    }
    for (const branchId of branchIds) {
      const explicit = column.from[branchId];
      const mapping: Mapping | undefined = explicit ?? column.from["*"];
      const mapAt = `${at}.from.${explicit ? branchId : "*"}`;
      const ctx = scopes.get(branchId);
      if (!ctx) continue;
      if (mapping === undefined) {
        issues.error("VAL-040", file, `${at}.from`, `No mapping for branch ${branchId} (MM-100): map it, or write not_provided with a reason.`);
        continue;
      }
      const grouped = model.branches[branchId]?.group_by;
      const branchCtx: Context = { ...ctx, sqlSeen: { value: false } };
      if (typeof mapping === "string") {
        const value = resolveColumn(branchCtx, mapping, mapAt);
        checkResultType(branchCtx, value, target, mapAt, `Column ${name} (${branchId})`);
        if (grouped && !grouped.includes(mapping)) issues.error("VAL-035", file, mapAt, "In a grouped branch, a column is a grouping column or ends with an aggregation (MM-112).");
        const native = nativeTypeOf(branchCtx, mapping);
        if (native && /^DATS/i.test(native) && target.kind === "string") {
          issues.warning("VAL-044", file, mapAt, `The source is a date stored as text (${native}); it is kept as text. Check that this is intended.`);
        }
        continue;
      }
      if ("not_provided" in mapping) {
        if (!column.nullable) issues.error("VAL-041", file, mapAt, `Column ${name} is not nullable, so every branch must provide it (MM-100).`);
        continue;
      }
      const inputs = mapping.inputs ?? [];
      const inputTypes = inputs.map((ref, i) => resolveColumn(branchCtx, ref, `${mapAt}.inputs[${i}]`));
      const start = inputs.length === 1 ? inputTypes[0] : undefined;
      const steps = mapping.steps ?? [];
      const native = inputs.length === 1 && inputs[0] ? nativeTypeOf(branchCtx, inputs[0]) : undefined;
      const result = checkSteps(branchCtx, steps, `${mapAt}.steps`, start, { project, grouped: Boolean(grouped), ...(native ? { nativeType: native } : {}) });
      checkResultType(branchCtx, result, target, mapAt, `Column ${name} (${branchId})`);
      if (grouped) {
        const last = steps[steps.length - 1];
        const isAggregate = typeof last === "object" && "aggregate" in last;
        const isGroupingColumn = steps.length === 0 && inputs.length === 1 && grouped.includes(inputs[0] ?? "");
        if (!isAggregate && !isGroupingColumn) issues.error("VAL-035", file, mapAt, "In a grouped branch, a column is a grouping column or ends with an aggregation (MM-112).");
      }
      usesSql ||= branchCtx.sqlSeen.value;
    }
    if (usesSql) unstructured += 1;
    const qualityCtx: Context = { file, issues, scope: new Map(), sqlSeen: { value: false } };
    checkQuality(qualityCtx, project, model, column.quality ?? [], `${at}.quality`);
  }
  checkQuality({ file, issues, scope: new Map(), sqlSeen: { value: false } }, project, model, model.quality ?? [], "quality");
  return { columns: Object.keys(model.columns).length, unstructured };
}

function checkProject(project: Project, issues: IssueList): number {
  for (const { path, spec } of project.datasets.values()) {
    if (!project.systems.has(spec.system)) issues.error("VAL-020", path, "system", `Unknown system ${spec.system}.`);
    for (const column of spec.primary_key ?? []) {
      if (!(column in spec.columns)) issues.error("VAL-020", path, "primary_key", `Primary key column ${column} is not a column of the dataset.`);
    }
  }
  for (const { path, spec } of project.systems.values()) {
    if (!spec.landing) issues.warning("VAL-013", path, "landing", "No landing location: generation needs to know where this system's raw data lands.");
  }

  for (const { path, spec } of project.valueMappings.values()) {
    if (!project.domains.has(spec.domain)) issues.error("VAL-024", path, "domain", `Unknown domain ${spec.domain}.`);
    const entries = Object.entries(spec.entries ?? {});
    if (entries.length > 1000) issues.error("VAL-051", path, "entries", `${entries.length} entries: at most 1,000 inline, use a reference beyond (MM-310).`);
    const from = mustType(spec.from_type);
    const to = mustType(spec.to_type);
    for (const [key, value] of entries) {
      if (!literalFits(key, from)) issues.error("VAL-043", path, `entries.${key}`, `"${key}" is not a valid ${spec.from_type} value.`);
      if (!literalFits(value, to)) issues.error("VAL-043", path, `entries.${key}`, `"${value}" is not a valid ${spec.to_type} value.`);
    }
    if (spec.default !== undefined && !literalFits(spec.default, to)) issues.error("VAL-043", path, "default", `"${spec.default}" is not a valid ${spec.to_type} value.`);
    if (spec.reference) {
      const source = resolveSource(project, spec.reference.dataset);
      if (!source) issues.error("VAL-020", path, "reference.dataset", `Unknown dataset ${spec.reference.dataset}.`);
      else for (const column of [spec.reference.key, spec.reference.value]) {
        if (!source.columns.has(column)) issues.error("VAL-020", path, "reference", `Unknown column ${column} in ${spec.reference.dataset}.`);
      }
    }
  }

  for (const { path, spec } of project.rules.values()) {
    if (!project.domains.has(spec.domain)) issues.error("VAL-024", path, "domain", `Unknown domain ${spec.domain}.`);
    const params = new Map(Object.entries(spec.parameters).map(([name, text]) => [name, mustType(text)]));
    const ctx: Context = { file: path, issues, scope: new Map(), params, sqlSeen: { value: false } };
    const only = params.size === 1 ? [...params.values()][0] : undefined;
    const result = checkSteps(ctx, spec.logic, "logic", only ? known(only) : undefined, { project, grouped: false });
    checkResultType(ctx, result, mustType(spec.returns), "logic", `Rule ${spec.id}`);
  }
  const ruleGraph = new Map([...project.rules].map(([id, { spec }]) => [id, new Set(rulesCalled(spec.logic))]));
  for (const cycle of findCycles(ruleGraph)) {
    issues.error("VAL-022", project.rules.get(cycle[0] ?? "")?.path ?? "", "logic", `Business rules call each other in a loop: ${cycle.join(" → ")} (MM-300).`);
  }

  const modelGraph = new Map(
    [...project.models].map(([id, { spec }]) => [
      id,
      new Set(Object.values(spec.branches).flatMap((branch) => branch.datasets.flatMap((use) => Object.values(use)).filter((ref) => project.models.has(ref)))),
    ]),
  );
  for (const cycle of findCycles(modelGraph)) {
    issues.error("VAL-021", project.models.get(cycle[0] ?? "")?.path ?? "", "branches", `Models read each other in a loop: ${cycle.join(" → ")} (MM-111).`);
  }

  let columns = 0;
  let unstructured = 0;
  for (const loaded of project.models.values()) {
    const stats = checkModel(project, loaded, issues);
    columns += stats.columns;
    unstructured += stats.unstructured;
  }
  return columns === 0 ? 0 : unstructured / columns;
}

/** Validates a project export (VAL-000…VAL-070). */
export function validateProject(files: SpecFile[]): ValidationResult {
  const { project, issues } = loadProject(files);
  const unstructuredShare = checkProject(project, issues);
  const sorted = issues.sorted();
  return {
    project,
    issues: sorted,
    errors: sorted.filter((issue) => issue.severity === "error").length,
    warnings: sorted.filter((issue) => issue.severity === "warning").length,
    unstructuredShare,
  };
}


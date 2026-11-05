/**
 * Structure of every spec object, exactly as written in YAML (docs/03-spec-format.md).
 * Keys are snake_case like the format; the meaning of each attribute is in docs/02-metamodel.md.
 * Semantic checks (references, types, completeness) are in ../validate.
 */
import { z } from "zod";
import { parseLogicalType } from "../types/logical-types";

const text = z.string().min(1);
const id = z.string().regex(/^[a-z0-9_-]+$/, "Ids use lowercase letters, digits, _ and - (MM-600).");
const domainCode = z.string().regex(/^[A-Z0-9]{2,5}$/, "Domain codes are 2 to 5 uppercase letters or digits.");
/** Literal values are always text (FMT-020): `value: "2"`, never `value: 2`. */
const literal = z.string({ error: "Literals must be written as quoted text (FMT-020), e.g. value: \"2\"." });
const logicalType = z.string().refine((value) => parseLogicalType(value) !== null, {
  error: "Not a logical type (FMT-022), e.g. string(10), decimal(15,2), date.",
});
const severity = z.enum(["error", "warn"]);

// ---------------------------------------------------------------------------------------------------------------
// Operands and conditions (docs/02-metamodel.md §5.3, FMT §2.5 and §5.2)
// ---------------------------------------------------------------------------------------------------------------

/** `alias.COLUMN` or `current`. */
export const columnRef = z.string().regex(/^(current|[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z0-9_]+)$/, "Expected alias.COLUMN or current.");

const simpleOperand = z.union([
  columnRef,
  z.strictObject({ value: literal }),
  z.strictObject({ param: z.string().min(1) }),
]);
export const calculation = z.strictObject({ function: z.string().min(1), args: z.array(simpleOperand) });
/** An operand may be one calculation whose arguments are simple operands (F-1, §5.3). */
export const operand = z.union([simpleOperand, z.strictObject({ calculate: calculation })]);

export const comparisonOperator = z.enum(["eq", "ne", "lt", "le", "gt", "ge", "in", "not_in", "between", "like", "is_null", "is_not_null"]);

export type Condition =
  | { left: z.infer<typeof operand>; op: z.infer<typeof comparisonOperator>; right?: z.infer<typeof operand>; value?: string; values?: string[] }
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | { sql: string; reason: string };

const RESERVED_CONDITION_KEYS = ["left", "all", "any", "not", "sql"];

/** Short form (FMT-071): `{ a.KEY: b.KEY, … }` = equality of each pair, combined with "and". */
function expandShortCondition(value: unknown): unknown {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return value;
  const keys = Object.keys(value);
  if (keys.length === 0 || keys.some((key) => RESERVED_CONDITION_KEYS.includes(key))) return value;
  const pairs = Object.entries(value as Record<string, unknown>);
  if (!pairs.every(([, right]) => typeof right === "string")) return value;
  const all = pairs.map(([left, right]) => ({ left, op: "eq", right }));
  return all.length === 1 ? all[0] : { all };
}

export const condition: z.ZodType<Condition> = z.lazy(() =>
  z.preprocess(
    expandShortCondition,
    z.union([
      z.strictObject({
        left: operand,
        op: comparisonOperator,
        right: operand.optional(),
        value: literal.optional(),
        values: z.array(literal).optional(),
      }),
      z.strictObject({ all: z.array(condition).min(1) }),
      z.strictObject({ any: z.array(condition).min(1) }),
      z.strictObject({ not: condition }),
      z.strictObject({ sql: text, reason: text }),
    ]),
  ),
) as z.ZodType<Condition>;

// ---------------------------------------------------------------------------------------------------------------
// Steps (docs/02-metamodel.md §5.2, FMT §5.1)
// ---------------------------------------------------------------------------------------------------------------

export const stepBodies = {
  constant: z.strictObject({ value: literal }),
  default: z.strictObject({ value: literal, also_empty: z.boolean().optional() }),
  convert: z.strictObject({
    to: logicalType,
    method: z.enum(["cast", "parse", "format"]),
    pattern: z.string().optional(),
    on_error: z.enum(["fail", "set_null", "use_default"]),
    default: literal.optional(),
  }),
  map_values: z.strictObject({ mapping: id, on_unmatched: z.enum(["keep", "set_null", "use_default", "fail"]) }),
  case: z.strictObject({
    when: z.array(z.strictObject({ if: condition, then: operand })).min(1),
    else: operand.optional(),
  }),
  calculate: calculation,
  concat: z.strictObject({ parts: z.array(operand).min(2), separator: z.string().optional() }),
  lookup: z.strictObject({
    dataset: z.string().min(1),
    alias: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/),
    match: condition,
    return: columnRef,
    on_missing: z.enum(["fail", "set_null", "use_default"]),
    default: literal.optional(),
  }),
  aggregate: z.enum(["sum", "count", "count_distinct", "min", "max", "avg"]),
  rule: z.strictObject({ id, args: z.record(z.string(), operand) }),
  sql: z.strictObject({ expression: text, reason: text }),
} as const;

export type StepKind = keyof typeof stepBodies | "copy";
export const STEP_KINDS = ["copy", ...Object.keys(stepBodies)] as StepKind[];

export type Step = "copy" | { [K in keyof typeof stepBodies]: { [P in K]: z.infer<(typeof stepBodies)[K]> } }[keyof typeof stepBodies];

export const step = z.union([
  z.literal("copy"),
  ...Object.entries(stepBodies).map(([kind, body]) => z.strictObject({ [kind]: body })),
]) as unknown as z.ZodType<Step>;

// ---------------------------------------------------------------------------------------------------------------
// Objects
// ---------------------------------------------------------------------------------------------------------------

const header = { atlas: z.literal(1, { error: "Unsupported format version: write atlas: 1 (FMT-002)." }) };

export const projectSchema = z.strictObject({
  ...header,
  kind: z.literal("project"),
  id,
  name: text,
  description: z.string().optional(),
  target_platform: z.enum(["snowflake", "databricks", "bigquery", "postgresql"]),
  defaults: z.strictObject({ materialization: z.enum(["table", "view", "incremental"]).optional() }).optional(),
});

export const domainSchema = z.strictObject({
  ...header,
  kind: z.literal("domain"),
  code: domainCode,
  name: text,
  description: z.string().optional(),
  owner: z.email(),
  stewards: z.array(z.email()).min(1, "A domain needs at least one steward (MM-021)."),
});

export const systemSchema = z.strictObject({
  ...header,
  kind: z.literal("system"),
  id,
  name: text,
  system_type: z.enum(["erp", "mes", "crm", "database", "file", "api", "other"]),
  product: z.string().optional(),
  description: z.string().optional(),
  landing: z.strictObject({ database: text, schema: text, naming_pattern: z.string().optional() }).optional(),
});

export const datasetSchema = z.strictObject({
  ...header,
  kind: z.literal("dataset"),
  id,
  system: id,
  name: text,
  namespace: z.string().optional(),
  dataset_type: z.enum(["table", "view", "file", "other"]),
  description: z.string().optional(),
  primary_key: z.array(text).optional(),
  landing_name: z.string().optional(),
  metadata_origin: z.strictObject({ method: z.enum(["manual", "file_import", "cli_import"]), date: z.string() }),
  columns: z.record(
    text,
    z.strictObject({
      native_type: z.string().optional(),
      type: logicalType,
      nullable: z.boolean().optional(),
      description: z.string().optional(),
    }),
  ),
});

const qualityCheck = z.union([
  z.enum(["not_null", "unique"]),
  z.strictObject({ not_null: z.strictObject({ severity }) }),
  z.strictObject({ unique: z.strictObject({ severity }) }),
  z.strictObject({
    accepted_values: z.strictObject({ values: z.array(literal).optional(), mapping: id.optional(), severity: severity.optional() }),
  }),
  z.strictObject({ relationship: z.strictObject({ to: z.string().regex(/^[a-z0-9_-]+\.[a-z0-9_]+$/), severity: severity.optional() }) }),
  z.strictObject({ unique_combination: z.strictObject({ columns: z.array(text).min(2), severity: severity.optional() }) }),
]);
export type QualityCheck = z.infer<typeof qualityCheck>;

export const mappingSchema = z.union([
  columnRef,
  z.strictObject({ not_provided: text }),
  z.strictObject({ inputs: z.array(columnRef).optional(), steps: z.array(step).optional(), note: z.string().optional() }),
]);
export type Mapping = z.infer<typeof mappingSchema>;

const joinSchema = z.strictObject({
  left: text,
  right: text,
  type: z.enum(["inner", "left", "right", "full"]),
  condition,
  cardinality: z.enum(["one_to_one", "one_to_many", "many_to_one", "many_to_many"]),
  confirmed: z.boolean().optional(),
  description: z.string().optional(),
});
export type Join = z.infer<typeof joinSchema>;

const branchSchema = z.strictObject({
  label: z.string().optional(),
  source_tag: z.string().optional(),
  datasets: z
    .array(z.record(z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "Aliases are letters, digits and _."), text))
    .min(1)
    .refine((uses) => uses.every((use) => Object.keys(use).length === 1), { error: "Write each dataset use as `- alias: system.dataset`." }),
  joins: z.array(joinSchema).optional(),
  filter: condition.optional(),
  deduplicate: z
    .strictObject({
      key: z.array(columnRef).min(1),
      order_by: z.array(z.strictObject({ column: columnRef, direction: z.enum(["asc", "desc"]) })).optional(),
      keep: z.enum(["first", "last"]),
    })
    .optional(),
  group_by: z.array(columnRef).min(1).optional(),
});
export type Branch = z.infer<typeof branchSchema>;

const consolidationSchema = z.strictObject({
  combine: z.enum(["union_all", "union_distinct"]),
  add_source_column: id.optional(),
  match: z.array(text).min(1).optional(),
  survivorship: z
    .strictObject({
      priority: z.array(text).min(1),
      columns: z
        .record(
          text,
          z.strictObject({
            strategy: z.enum(["priority", "first_not_null", "most_recent", "rule"]),
            priority: z.array(text).optional(),
            by: z.string().optional(),
            rule: id.optional(),
          }),
        )
        .optional(),
    })
    .optional(),
});

export const modelSchema = z.strictObject({
  ...header,
  kind: z.literal("model"),
  id,
  name: text,
  domain: domainCode,
  description: text,
  grain: z.strictObject({ description: text, key: z.array(text).min(1) }),
  layer: z.string().optional(),
  materialization: z.enum(["table", "view", "incremental"]).optional(),
  branches: z.record(id, branchSchema).refine((branches) => Object.keys(branches).length > 0, { error: "A model needs at least one branch." }),
  consolidation: consolidationSchema.optional(),
  columns: z.record(
    id,
    z.strictObject({
      definition: text,
      type: logicalType,
      nullable: z.boolean(),
      key: z.boolean().optional(),
      classification: z.enum(["public", "internal", "confidential", "personal"]).optional(),
      quality: z.array(qualityCheck).optional(),
      tags: z.array(z.string()).optional(),
      from: z.record(z.string(), mappingSchema),
    }),
  ),
  quality: z.array(qualityCheck).optional(),
  tags: z.array(z.string()).optional(),
});

export const ruleSchema = z.strictObject({
  ...header,
  kind: z.literal("rule"),
  id,
  name: text,
  domain: domainCode,
  statement: text,
  parameters: z.record(id, logicalType),
  returns: logicalType,
  logic: z.array(step).min(1),
});

export const valueMappingSchema = z
  .strictObject({
    ...header,
    kind: z.literal("value_mapping"),
    id,
    name: text,
    domain: domainCode,
    from_type: logicalType,
    to_type: logicalType,
    entries: z.record(z.string(), literal).optional(),
    reference: z.strictObject({ dataset: text, key: text, value: text }).optional(),
    default: literal.optional(),
  })
  .refine((vm) => (vm.entries === undefined) !== (vm.reference === undefined), {
    error: "A value mapping has either entries or a reference (MM-310).",
  });

export type ProjectSpec = z.infer<typeof projectSchema>;
export type DomainSpec = z.infer<typeof domainSchema>;
export type SystemSpec = z.infer<typeof systemSchema>;
export type DatasetSpec = z.infer<typeof datasetSchema>;
export type ModelSpec = z.infer<typeof modelSchema>;
export type ColumnSpec = ModelSpec["columns"][string];
export type RuleSpec = z.infer<typeof ruleSchema>;
export type ValueMappingSpec = z.infer<typeof valueMappingSchema>;
export type Operand = z.infer<typeof operand>;

export const schemasByKind = {
  project: projectSchema,
  domain: domainSchema,
  system: systemSchema,
  dataset: datasetSchema,
  model: modelSchema,
  rule: ruleSchema,
  value_mapping: valueMappingSchema,
} as const;
export type SpecKind = keyof typeof schemasByKind;

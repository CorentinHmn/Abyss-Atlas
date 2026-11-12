/**
 * Business rules and value mappings (docs/02-metamodel.md §6): builders in file order, and where they are used.
 */

export type RuleContent = Record<string, unknown> & {
  id: string;
  name: string;
  domain: string;
  statement: string;
  parameters: Record<string, string>;
  returns: string;
  logic: unknown[];
};

export type ValueMappingContent = Record<string, unknown> & {
  id: string;
  name: string;
  domain: string;
  from_type: string;
  to_type: string;
  entries?: Record<string, string>;
  reference?: { dataset: string; key: string; value: string };
  default?: string;
};

function ordered<T extends Record<string, unknown>>(value: T, order: string[]): T {
  const result: Record<string, unknown> = {};
  for (const key of order) if (value[key] !== undefined && value[key] !== "") result[key] = value[key];
  return result as T;
}

export function normalizeRule(rule: RuleContent): RuleContent {
  return ordered({ ...rule, atlas: 1, kind: "rule" }, ["atlas", "kind", "id", "name", "domain", "statement", "parameters", "returns", "logic"]);
}

export function normalizeValueMapping(mapping: ValueMappingContent): ValueMappingContent {
  return ordered({ ...mapping, atlas: 1, kind: "value_mapping" }, ["atlas", "kind", "id", "name", "domain", "from_type", "to_type", "entries", "reference", "default"]);
}

/** MM-310 */
export const MAX_ENTRIES = 1000;

/** Which business rules and value mappings an object uses (steps, consolidation, quality checks). */
export function usesOf(content: unknown): { rules: Set<string>; valueMappings: Set<string> } {
  const rules = new Set<string>();
  const valueMappings = new Set<string>();
  const visit = (node: unknown, parent?: string) => {
    if (Array.isArray(node)) return node.forEach((item) => visit(item, parent));
    if (!node || typeof node !== "object") return;
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === "rule" && value && typeof value === "object" && "id" in value) rules.add(String((value as { id: unknown }).id));
      else if (key === "rule" && typeof value === "string" && parent === "survivorship") rules.add(value);
      if (key === "map_values" && value && typeof value === "object" && "mapping" in value) valueMappings.add(String((value as { mapping: unknown }).mapping));
      if (key === "accepted_values" && value && typeof value === "object" && "mapping" in value) valueMappings.add(String((value as { mapping: unknown }).mapping));
      visit(value, key === "columns" && parent === "survivorship" ? "survivorship" : key);
    }
  };
  visit(content);
  return { rules, valueMappings };
}

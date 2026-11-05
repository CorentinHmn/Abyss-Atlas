import { describe, expect, it } from "vitest";
import type { SpecFile } from "../spec/load";
import { readProject, REFERENCE_PROJECT } from "../testing/read-project";
import { validateProject } from "./validate";

const reference = readProject(REFERENCE_PROJECT);

function mutate(path: string, change: (content: string) => string, files: SpecFile[] = reference): SpecFile[] {
  let found = false;
  const result = files.map((file) => {
    if (file.path !== path) return file;
    found = true;
    const content = change(file.content);
    if (content === file.content) throw new Error(`The mutation of ${path} changed nothing.`);
    return { ...file, content };
  });
  if (!found) throw new Error(`No file ${path}.`);
  return result;
}

const replace = (from: string, to: string) => (content: string) => content.replace(from, to);
const errorCodes = (files: SpecFile[]) =>
  validateProject(files)
    .issues.filter((issue) => issue.severity === "error")
    .map((issue) => issue.code);

describe("the reference project (RM-020)", () => {
  const result = validateProject(reference);

  it("has no validation error", () => {
    expect(result.issues.filter((issue) => issue.severity === "error")).toEqual([]);
  });

  it("loads every object", () => {
    expect(result.project.models.size).toBe(7);
    expect(result.project.datasets.size).toBe(30);
    expect(result.project.rules.size).toBe(5);
    expect(result.project.valueMappings.size).toBe(5);
    expect(result.project.domains.size).toBe(3);
  });

  it("reports the expected warnings only", () => {
    expect([...new Set(result.issues.map((issue) => issue.code))].sort()).toEqual(["VAL-031", "VAL-034", "VAL-044", "VAL-046"]);
  });

  it("measures unstructured logic (VAL-070)", () => {
    expect(result.unstructuredShare).toBeCloseTo(1 / 61, 5);
  });

  it("gives the same report twice (VAL-001)", () => {
    expect(validateProject(reference).issues).toEqual(result.issues);
  });
});

describe("each fault is reported with its code", () => {
  const cases: [string, string, SpecFile[]][] = [
    ["VAL-010", "invalid YAML", mutate("models/GOV/dim_plant.yaml", replace("grain:\n", "grain: [\n"))],
    ["VAL-012", "unknown key", mutate("models/GOV/dim_plant.yaml", replace("layer: mart", "layer: mart\nowner: someone"))],
    ["VAL-014", "file in the wrong folder", mutate("models/GOV/dim_plant.yaml", replace("domain: GOV", "domain: MFG"))],
    ["VAL-015", "unquoted literal", mutate("models/SEL/fact_sales_order_line.yaml", replace('{ value: "2" }', "{ value: 2 }"))],
    ["VAL-018", "duplicate key", mutate("value-mappings/MFG/material_type_sap.yaml", replace('  "ROH": "RAW"\n', '  "ROH": "RAW"\n  "ROH": "RAW"\n'))],
    ["VAL-020", "unknown column", mutate("models/MFG/dim_material.yaml", replace("oracle: c.SEGMENT1", "oracle: c.SEGMENT9"))],
    ["VAL-021", "models reading each other", mutate("models/MFG/int_mes_order_output.yaml", replace("      - w: mes.work_orders\n", "      - w: mes.work_orders\n      - f: fact_production_order\n    joins:\n      - { left: w, right: f, type: left, condition: { w.ERP_ORDER_REF: f.order_number }, cardinality: many_to_one }\n"))],
    ["VAL-022", "rule calling itself", mutate("rules/GOV/sap_date.yaml", replace("logic:\n", "logic:\n  - rule: { id: sap_date, args: { value: current } }\n"))],
    ["VAL-023", "wrong rule arguments", mutate("models/GOV/dim_plant.yaml", replace("local_key: t.WERKS } }\n      sap_de", "plant: t.WERKS } }\n      sap_de"))],
    ["VAL-031", "unconfirmed many-to-many", mutate("models/MFG/dim_material.yaml", replace("        confirmed: true\n", ""))],
    ["VAL-032", "comparing text with a number", mutate("models/SEL/fact_sales_order_line.yaml", replace("condition: { i.VBELN: h.VBELN }", "condition: { i.KWMENG: h.VBELN }"))],
    ["VAL-035", "aggregation without group_by", mutate("models/GOV/dim_plant.yaml", replace('        steps:\n          - constant: { value: "SAP S/4HANA" }', '        inputs: [t.WERKS]\n        steps:\n          - aggregate: count'))],
    ["VAL-040", "missing branch mapping", mutate("models/SEL/fact_sales_order_line.yaml", replace("      oracle: l.ORDER_QUANTITY_UOM\n", ""))],
    ["VAL-041", "not_provided on a required column", mutate("models/SEL/dim_customer.yaml", replace("    type: decimal(15,2)\n    nullable: true", "    type: decimal(15,2)\n    nullable: false"))],
    ["VAL-042", "missing conversion", mutate("models/GOV/dim_plant.yaml", replace("    type: string(4)\n    nullable: false", "    type: string(2)\n    nullable: false"))],
    ["VAL-047", "arithmetic on text", mutate("models/SEL/fact_sales_order_line.yaml", replace("args: [l.ORDERED_QUANTITY, l.UNIT_SELLING_PRICE]", "args: [l.ORDER_QUANTITY_UOM, l.UNIT_SELLING_PRICE]"))],
  ];

  it.each(cases)("%s: %s", (code, _label, files) => {
    expect(errorCodes(files)).toContain(code);
  });
});

describe("YAML 1.2 and extensions", () => {
  it("reads on, yes and NO as text, not booleans (FMT-001)", () => {
    const files = mutate("value-mappings/GOV/rate_type_sap.yaml", replace('  "P": "PLANNING"', '  "P": "PLANNING"\n  NO: "NORWAY"\n  on: "ON"'));
    expect(errorCodes(files)).toEqual([]);
  });

  it("ignores x_ extension keys (FMT-012)", () => {
    const files = mutate("models/GOV/dim_plant.yaml", replace("layer: mart", "layer: mart\nx_owner_team: Group data office"));
    expect(errorCodes(files)).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { checkSpecFile, lineOf, splitPath } from "./edit";

const rule = `atlas: 1
kind: rule
id: sap_date
name: SAP date
domain: GOV
statement: SAP stores dates as text.
parameters:
  value: string(8)
returns: date
logic:
  - convert: { to: date, method: parse, pattern: YYYYMMDD, on_error: set_null }
`;

describe("YAML view of one object (MAP-060…MAP-062)", () => {
  it("splits issue paths", () => {
    expect(splitPath("columns.a.from.x.steps[2]")).toEqual(["columns", "a", "from", "x", "steps", 2]);
    expect(splitPath("logic[0]")).toEqual(["logic", 0]);
    expect(splitPath("")).toEqual([]);
  });

  it("accepts a valid file and keeps its content", () => {
    const result = checkSpecFile(rule, "rule");
    expect(result.issues).toEqual([]);
    expect(result.spec?.parameters).toEqual({ value: "string(8)" });
  });

  it("reports YAML errors with their line", () => {
    const result = checkSpecFile(rule.replace("returns: date", "returns: [date"), "rule");
    expect(result.spec).toBeUndefined();
    expect(result.issues[0]?.code).toBe("VAL-010");
    expect(result.issues[0]?.line).toBeGreaterThanOrEqual(9);
  });

  it("reports schema errors with the validation codes and the line of the value", () => {
    const result = checkSpecFile(rule.replace("name: SAP date\n", "name: SAP date\ncolour: red\n"), "rule");
    expect(result.issues.map((issue) => [issue.code, issue.line])).toEqual([["VAL-012", 5]]);
    const missing = checkSpecFile(rule.replace("returns: date\n", ""), "rule");
    expect(missing.issues[0]).toMatchObject({ code: "VAL-013", at: "returns" });
  });

  it("refuses another kind", () => {
    expect(checkSpecFile(rule.replace("kind: rule", "kind: model"), "rule").issues[0]).toMatchObject({ code: "VAL-012", line: 2 });
  });

  it("finds the line of an issue, or of its closest parent", () => {
    expect(lineOf(rule, "logic[0]")).toBe(11);
    expect(lineOf(rule, "parameters.value")).toBe(8);
    expect(lineOf(rule, "parameters.missing")).toBe(8);
    expect(lineOf(rule, "")).toBe(1);
  });
});

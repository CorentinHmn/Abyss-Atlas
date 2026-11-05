import { expect, it } from "vitest";
import { loadProject } from "../spec/load";
import { readProject, REFERENCE_PROJECT } from "../testing/read-project";
import { diffProjects } from "./diff";

it("lists added, removed and changed objects, attribute by attribute (UC-023)", () => {
  const files = readProject(REFERENCE_PROJECT);
  const before = loadProject(files).project;
  const after = loadProject(
    files
      .filter((f) => f.path !== "value-mappings/MFG/weight_unit_to_kg_factor.yaml")
      .map((f) => (f.path === "models/GOV/dim_plant.yaml" ? { ...f, content: f.content.replace("type: string(25)", "type: string(40)") } : f))
      .concat({ path: "domains/HR.yaml", content: "atlas: 1\nkind: domain\ncode: HR\nname: Human resources\nowner: hr@example.com\nstewards: [hr@example.com]\n" }),
  ).project;
  expect(diffProjects(before, after)).toEqual([
    { change: "added", kind: "domain", key: "HR", fields: [] },
    { change: "changed", kind: "model", key: "dim_plant", fields: [{ path: "columns.city.type", before: "string(25)", after: "string(40)" }] },
    { change: "removed", kind: "value_mapping", key: "weight_unit_to_kg_factor", fields: [] },
  ]);
  expect(diffProjects(before, before)).toEqual([]);
});

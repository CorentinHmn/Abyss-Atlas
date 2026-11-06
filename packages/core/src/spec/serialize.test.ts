import { describe, expect, it } from "vitest";
import { CATALOG_QUERIES } from "../import/catalog-queries";
import { DICTIONARY_COLUMNS, importDictionary } from "../import/dictionary";
import { readProject, REFERENCE_PROJECT } from "../testing/read-project";
import { canonicalJson, contentHash } from "./canonical";
import { loadProject } from "./load";
import { specKey, specPath, specToFile } from "./serialize";
import type { SpecKind } from "./schemas";

describe("canonical form (FMT-122, RFC 8785)", () => {
  it("sorts keys, drops whitespace and keeps array order", () => {
    expect(canonicalJson({ b: [3, 1], a: { d: true, c: null }, "é": "x" })).toBe('{"a":{"c":null,"d":true},"b":[3,1],"é":"x"}');
  });

  it("gives the same hash whatever the key order, and another hash when a value changes", async () => {
    const one = await contentHash({ id: "kna1", columns: { A: 1, B: 2 } });
    expect(one).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(await contentHash({ columns: { B: 2, A: 1 }, id: "kna1" })).toBe(one);
    expect(await contentHash({ id: "kna1", columns: { A: 1, B: 3 } })).not.toBe(one);
  });

  it("refuses values that JSON cannot carry", () => {
    expect(() => canonicalJson({ n: Number.NaN })).toThrow();
  });
});

describe("stored objects back to export files", () => {
  it("regenerates the reference project with the same objects (round trip)", () => {
    const original = loadProject(readProject(REFERENCE_PROJECT));
    const files = [];
    const kinds: [SpecKind, Map<string, { spec: unknown }>][] = [
      ["domain", original.project.domains],
      ["system", original.project.systems],
      ["dataset", original.project.datasets],
      ["model", original.project.models],
      ["rule", original.project.rules],
      ["value_mapping", original.project.valueMappings],
    ];
    for (const [kind, map] of kinds) {
      for (const [key, loaded] of map) {
        const spec = loaded.spec as Record<string, unknown>;
        expect(specKey(kind, spec)).toBe(key);
        const file = specToFile(kind, spec);
        expect(file.path).toBe(specPath(kind, spec));
        files.push(file);
      }
    }
    if (original.project.project) files.push(specToFile("project", original.project.project.spec as Record<string, unknown>));
    const again = loadProject(files);
    expect(again.issues.items).toEqual([]);
    expect([...again.project.datasets.values()].map((loaded) => loaded.spec)).toEqual([...original.project.datasets.values()].map((loaded) => loaded.spec));
    expect([...again.project.models.values()].map((loaded) => loaded.spec)).toEqual([...original.project.models.values()].map((loaded) => loaded.spec));
    expect([...again.project.systems.values()].map((loaded) => loaded.spec)).toEqual([...original.project.systems.values()].map((loaded) => loaded.spec));
  });
});

describe("dictionary import from rows (SRC-021, Excel sheets)", () => {
  it("gives the same result as the CSV text", () => {
    const rows = [["dataset", "column", "native_type", "primary_key_position"], ["KNA1", "KUNNR", "CHAR(10)", "1"]];
    const fromRows = importDictionary({ rows, system: "sap_fr", dialect: "sap", existing: new Map(), date: "2026-11-06" });
    const fromCsv = importDictionary({ csv: "dataset,column,native_type,primary_key_position\nKNA1,KUNNR,CHAR(10),1\n", system: "sap_fr", dialect: "sap", existing: new Map(), date: "2026-11-06" });
    expect(fromRows).toEqual(fromCsv);
    expect(fromRows.report.created).toEqual(["kna1"]);
  });
});

describe("catalog queries (IE-010, IE-011)", () => {
  it.each(Object.entries(CATALOG_QUERIES))("%s returns exactly the dictionary columns, in order", (_, sql) => {
    const select = sql.slice(sql.search(/^select$/m), sql.search(/^from /m));
    const aliases = [...select.matchAll(/\bas\s+(?:"|\[)?([a-z_]+)(?:"|\])?\s*,?\s*$/gm)].map((match) => match[1]);
    expect(aliases).toEqual([...DICTIONARY_COLUMNS]);
    expect(sql).not.toMatch(/\b(insert|update|delete|drop|alter|create)\b/i);
  });
});

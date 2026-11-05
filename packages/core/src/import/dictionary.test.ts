import { describe, expect, it } from "vitest";
import { loadProject } from "../spec/load";
import { readProject, REFERENCE_PROJECT } from "../testing/read-project";
import { parseCsv } from "./csv";
import { importDictionary } from "./dictionary";
import { logicalTypeFor } from "./native-types";

describe("CSV reader (IE-001)", () => {
  it("reads quoted fields, doubled quotes, CRLF and a byte-order mark", () => {
    expect(parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n')).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"'],
    ]);
  });

  it("detects the semicolon separator of European Excel", () => {
    expect(parseCsv("dataset;column\nKNA1;KUNNR\n")).toEqual([
      ["dataset", "column"],
      ["KNA1", "KUNNR"],
    ]);
  });
});

describe("native types (IE §1.3)", () => {
  it.each([
    ["postgresql", "character varying(40)", "string(40)"],
    ["postgresql", "numeric(15,2)", "decimal(15,2)"],
    ["postgresql", "timestamp without time zone", "timestamp"],
    ["postgresql", "timestamp with time zone", "timestamp_tz"],
    ["postgresql", "uuid", "string(36)"],
    ["sqlserver", "nvarchar(max)", "string"],
    ["sqlserver", "datetime2", "timestamp"],
    ["sqlserver", "bit", "boolean"],
    ["sap", "NUMC(6)", "string(6)"],
    ["sap", "DATS", "string(8)"],
    ["sap", "QUAN(13,3)", "decimal(13,3)"],
    ["oracle", "NUMBER(15)", "bigint"],
    ["oracle", "NUMBER", "decimal(38,10)"],
    ["oracle", "TIMESTAMP(6) WITH TIME ZONE", "timestamp_tz"],
    ["oracle", "DATE", "timestamp"],
  ] as const)("%s %s → %s", (dialect, native, logical) => {
    expect(logicalTypeFor(native, dialect)).toBe(logical);
  });

  it("returns null for an unknown type", () => {
    expect(logicalTypeFor("geometry", "postgresql")).toBeNull();
  });
});

describe("dictionary import (UC-001, IE-002…IE-004)", () => {
  const csv = [
    "dataset;column;native_type;nullable;primary_key_position;description;dataset_description;namespace",
    "customers;id;integer;NO;1;Customer identifier;Customers of the web shop;shop",
    "customers;email;character varying(254);YES;;E-mail;;shop",
    "customers;location;geometry;YES;;;;shop",
    "Order Lines;order_id;bigint;NO;1;;;shop",
    "Order Lines;line;smallint;NO;2;;;shop",
  ].join("\n");

  it("creates one valid dataset file per table", () => {
    const { files, report } = importDictionary({ csv, system: "webshop", dialect: "postgresql", existing: new Map(), date: "2026-11-05" });
    expect(report.created).toEqual(["customers", "order_lines"]);
    expect(report.unknownTypes).toEqual([{ dataset: "customers", column: "location", nativeType: "geometry" }]);
    const customers = files.find((f) => f.path === "systems/webshop/datasets/customers.yaml")?.content ?? "";
    expect(customers).toContain('primary_key: ["id"]');
    expect(customers).toContain('id:       { native_type: "integer", type: "integer", nullable: false, description: "Customer identifier" }');
    const system = { path: "systems/webshop/system.yaml", content: "atlas: 1\nkind: system\nid: webshop\nname: Web shop\nsystem_type: database\n" };
    const { issues } = loadProject([...files, system]);
    expect(issues.items.filter((i) => i.file !== "atlas.yaml")).toEqual([]);
  });

  it("updates an existing dataset: keeps descriptions written in Atlas and never drops columns", () => {
    const { project } = loadProject(readProject(REFERENCE_PROJECT));
    const kna1 = project.datasets.get("sap_fr.kna1")?.spec;
    if (!kna1) throw new Error("reference dataset missing");
    const reimport = ["dataset,column,native_type,description", "KNA1,KUNNR,CHAR(10),Imported text", "KNA1,LAND1,CHAR(3),", "KNA1,BRSCH,CHAR(4),Industry key"].join("\n");
    const { files, report } = importDictionary({ csv: reimport, system: "sap_fr", dialect: "sap", existing: new Map([["kna1", kna1]]), date: "2026-11-06" });
    expect(report.updated).toEqual(["kna1"]);
    expect(report.missingColumns.map((m) => m.column)).toContain("STCEG");
    const content = files[0]?.content ?? "";
    expect(content).toContain('description: "Customer number"');
    expect(content).toContain('BRSCH: { native_type: "CHAR(4)", type: "string(4)", description: "Industry key" }');
    expect(content).toContain("STCEG:");
  });

  it("reports a file without the required columns", () => {
    const { report } = importDictionary({ csv: "table,field\nA,B", system: "x", dialect: "sap", existing: new Map(), date: "2026-11-05" });
    expect(report.errors[0]).toContain('no "dataset" column');
  });
});

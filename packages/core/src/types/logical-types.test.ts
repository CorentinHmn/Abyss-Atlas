import { describe, expect, it } from "vitest";
import { formatLogicalType, isComparable, isImplicitlyAssignable, parseLogicalType, type LogicalType } from "./logical-types";

const t = (text: string): LogicalType => {
  const type = parseLogicalType(text);
  if (!type) throw new Error(`not a type: ${text}`);
  return type;
};

describe("parseLogicalType (FMT-022)", () => {
  it.each(["string", "string(10)", "integer", "bigint", "decimal(15,2)", "decimal(38,10)", "float", "boolean", "date", "time", "timestamp", "timestamp_tz", "binary", "json"])(
    "round-trips %s",
    (text) => {
      expect(formatLogicalType(t(text))).toBe(text);
    },
  );

  it("normalizes spaces in decimal", () => {
    expect(formatLogicalType(t("decimal(15, 2)"))).toBe("decimal(15,2)");
  });

  it.each(["", "varchar(10)", "string(0)", "string(1,2)", "decimal", "decimal(40,2)", "decimal(5,6)", "date(2)", "STRING"])(
    "rejects %j",
    (text) => {
      expect(parseLogicalType(text)).toBeNull();
    },
  );
});

describe("isImplicitlyAssignable (MM-410, MM-411)", () => {
  it.each([
    ["integer", "bigint"],
    ["string(10)", "string(40)"],
    ["string(10)", "string"],
    ["date", "timestamp"],
    ["decimal(13,3)", "decimal(15,3)"],
    ["integer", "decimal(12,2)"],
    ["string(3)", "string(3)"],
  ])("%s → %s is a safe widening", (from, to) => {
    expect(isImplicitlyAssignable(t(from), t(to))).toBe(true);
  });

  it.each([
    ["bigint", "integer"],
    ["string(40)", "string(10)"],
    ["string", "string(10)"],
    ["string(8)", "date"],
    ["decimal(15,2)", "decimal(15,3)"],
    ["decimal(38,10)", "decimal(15,2)"],
    ["timestamp", "date"],
    ["float", "decimal(15,2)"],
    ["string(10)", "integer"],
  ])("%s → %s needs a convert step", (from, to) => {
    expect(isImplicitlyAssignable(t(from), t(to))).toBe(false);
  });
});

describe("isComparable (MM-120)", () => {
  it("compares numbers and dates within their family only", () => {
    expect(isComparable(t("integer"), t("decimal(9,5)"))).toBe(true);
    expect(isComparable(t("date"), t("timestamp"))).toBe(true);
    expect(isComparable(t("string(10)"), t("integer"))).toBe(false);
    expect(isComparable(t("string(4)"), t("string(40)"))).toBe(true);
  });
});

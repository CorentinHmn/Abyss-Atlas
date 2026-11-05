import { describe, expect, it } from "vitest";
import { isValidId } from "./ids";

describe("isValidId (MM-600)", () => {
  it.each(["dim_customer", "sap_fr", "country-codes", "kna1", "q4_2026"])("accepts %s", (id) => {
    expect(isValidId(id)).toBe(true);
  });

  it.each(["", "Dim_Customer", "sap fr", "kna1.KUNNR", "café", "a/b"])("rejects %j", (id) => {
    expect(isValidId(id)).toBe(false);
  });
});

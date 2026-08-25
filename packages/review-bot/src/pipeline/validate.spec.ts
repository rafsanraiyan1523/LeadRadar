import { describe, expect, it } from "vitest";
import { FindingsValidationError, validateFindings } from "./validate";

function validFinding() {
  return {
    id: "F1",
    source: "logic",
    category: "logic-error",
    severity: "MUST-FIX",
    title: "t",
    file: "src/x.ts",
    line: "1",
    explanation: "e",
    evidence: "ev",
    suggested_fix: "fix",
    confidence: "high",
  };
}

describe("validateFindings — malformed review output", () => {
  it("accepts a well-formed findings array without throwing", () => {
    expect(() => validateFindings([validFinding()])).not.toThrow();
  });

  it("accepts an empty array (a clean PR)", () => {
    expect(() => validateFindings([])).not.toThrow();
  });

  it("rejects a non-array payload", () => {
    expect(() => validateFindings({ not: "an array" })).toThrow(FindingsValidationError);
    expect(() => validateFindings(null)).toThrow(FindingsValidationError);
    expect(() => validateFindings("just a string")).toThrow(FindingsValidationError);
  });

  it("rejects a finding missing a required field", () => {
    const broken = validFinding();
    delete (broken as Record<string, unknown>).file;
    expect(() => validateFindings([broken])).toThrow(/missing required non-empty string field "file"/);
  });

  it("rejects a finding with an empty-string field", () => {
    const broken = { ...validFinding(), title: "" };
    expect(() => validateFindings([broken])).toThrow(/title/);
  });

  it("rejects an invalid category", () => {
    const broken = { ...validFinding(), category: "not-a-real-category" };
    expect(() => validateFindings([broken])).toThrow(/invalid category/);
  });

  it("rejects a severity of IGNORE (must already be filtered before this point)", () => {
    const broken = { ...validFinding(), severity: "IGNORE" };
    expect(() => validateFindings([broken])).toThrow(/invalid severity/);
  });

  it("rejects a confidence of low (must already be filtered before this point)", () => {
    const broken = { ...validFinding(), confidence: "low" };
    expect(() => validateFindings([broken])).toThrow(/invalid confidence/);
  });

  it("rejects an unknown source reviewer", () => {
    const broken = { ...validFinding(), source: "not-a-real-reviewer" };
    expect(() => validateFindings([broken])).toThrow(/invalid source/);
  });

  it("rejects a non-object entry inside an otherwise-array payload", () => {
    expect(() => validateFindings([validFinding(), "not an object", validFinding()])).toThrow(/Finding\[1\] is not an object/);
  });
});

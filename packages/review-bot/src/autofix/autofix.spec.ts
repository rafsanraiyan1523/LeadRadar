import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runSafeAutofix } from "./autofix";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "review-bot-autofix-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("runSafeAutofix — safe auto-fix", () => {
  it("automatically fixes a formatting-only issue and writes the result to disk", async () => {
    writeFileSync(join(dir, "messy.ts"), "export function add(a:number,b:number){return a+b}\n", "utf8");

    const result = await runSafeAutofix(dir, ["messy.ts"]);

    expect(result.filesChanged).toEqual(["messy.ts"]);
    expect(result.applied).toBe(true);
    const after = readFileSync(join(dir, "messy.ts"), "utf8");
    // Formatted: spacing/semicolons normalized by Prettier — never a
    // semantic change (same function, same parameters, same body).
    expect(after).toContain("export function add(a: number, b: number)");
    expect(after).not.toBe("export function add(a:number,b:number){return a+b}\n");
  });

  it("does not modify an already-well-formatted file, and reports it as unchanged", async () => {
    const clean = "export function add(a: number, b: number) {\n  return a + b;\n}\n";
    writeFileSync(join(dir, "clean.ts"), clean, "utf8");

    const result = await runSafeAutofix(dir, ["clean.ts"]);

    expect(result.filesChanged).toEqual([]);
    expect(result.applied).toBe(false);
    expect(readFileSync(join(dir, "clean.ts"), "utf8")).toBe(clean);
  });

  it("in dry-run mode, reports what would change but never writes to disk", async () => {
    const original = "export function add(a:number,b:number){return a+b}\n";
    writeFileSync(join(dir, "messy.ts"), original, "utf8");

    const result = await runSafeAutofix(dir, ["messy.ts"], { dryRun: true });

    expect(result.filesChanged).toEqual(["messy.ts"]);
    expect(result.applied).toBe(false); // nothing was actually written
    expect(readFileSync(join(dir, "messy.ts"), "utf8")).toBe(original); // untouched on disk
  });

  it("skips a file that doesn't exist, rather than throwing", async () => {
    const result = await runSafeAutofix(dir, ["does-not-exist.ts"]);
    expect(result.files).toEqual([]);
    expect(result.filesChanged).toEqual([]);
  });

  it("only touches the files it's given, never other files in the same directory", async () => {
    writeFileSync(join(dir, "messy.ts"), "export function add(a:number,b:number){return a+b}\n", "utf8");
    const untouchedContent = "export function sub(a:number,b:number){return a-b}\n";
    writeFileSync(join(dir, "untouched.ts"), untouchedContent, "utf8");

    await runSafeAutofix(dir, ["messy.ts"]);

    expect(readFileSync(join(dir, "untouched.ts"), "utf8")).toBe(untouchedContent);
  });
});

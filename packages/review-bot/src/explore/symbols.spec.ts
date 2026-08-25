import { describe, expect, it } from "vitest";
import { extractTopLevelSymbols, symbolsForLineRange } from "./symbols";

describe("extractTopLevelSymbols", () => {
  it("finds exported function, class, interface, and const declarations with their line numbers", () => {
    const content = [
      "import { x } from './x';",
      "",
      "export interface Foo {",
      "  a: number;",
      "}",
      "",
      "export function bar(): void {}",
      "",
      "export const baz = 1;",
      "",
      "export class Qux {}",
      "",
      "function notExported() {}",
    ].join("\n");

    const { symbols } = extractTopLevelSymbols(content);
    expect(symbols).toEqual([
      { name: "Foo", kind: "interface", line: 3 },
      { name: "bar", kind: "function", line: 7 },
      { name: "baz", kind: "const", line: 9 },
      { name: "Qux", kind: "class", line: 11 },
    ]);
  });

  it("does not index non-exported declarations", () => {
    const content = "function helper() {}\nconst internal = 1;\n";
    expect(extractTopLevelSymbols(content).symbols).toEqual([]);
  });
});

describe("symbolsForLineRange", () => {
  it("attributes a changed line range to the symbol whose declaration owns it", () => {
    const index = {
      symbols: [
        { name: "first", kind: "function" as const, line: 1 },
        { name: "second", kind: "function" as const, line: 10 },
        { name: "third", kind: "function" as const, line: 20 },
      ],
    };

    expect(symbolsForLineRange(index, 12, 15)).toEqual([{ name: "second", kind: "function", line: 10 }]);
  });

  it("returns multiple symbols when a change spans more than one declaration", () => {
    const index = {
      symbols: [
        { name: "first", kind: "function" as const, line: 1 },
        { name: "second", kind: "function" as const, line: 10 },
      ],
    };
    expect(symbolsForLineRange(index, 5, 12)).toEqual(index.symbols);
  });

  it("returns nothing for a range before the first declaration", () => {
    const index = { symbols: [{ name: "only", kind: "function" as const, line: 10 }] };
    expect(symbolsForLineRange(index, 1, 5)).toEqual([]);
  });
});

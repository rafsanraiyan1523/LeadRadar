import type { ChangedSymbol } from "./types";

/**
 * Heuristic, regex-based top-level symbol extraction for TS/JS. Deliberately
 * not a full TypeScript-compiler-API parse: Explore only needs "roughly
 * which named things exist and where they start" to label a hunk and find
 * callers/tests by name — not a fully accurate AST. Keeping this a plain
 * line scan keeps it dependency-free and fast on files of any size.
 */
const DECLARATION_PATTERNS: Array<{ kind: ChangedSymbol["kind"]; regex: RegExp }> = [
  { kind: "function", regex: /^export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)/ },
  { kind: "class", regex: /^export\s+(?:default\s+)?class\s+([A-Za-z0-9_$]+)/ },
  { kind: "interface", regex: /^export\s+interface\s+([A-Za-z0-9_$]+)/ },
  { kind: "const", regex: /^export\s+const\s+([A-Za-z0-9_$]+)/ },
];

export interface FileSymbolIndex {
  /** All declarations found, ordered by line ascending. */
  symbols: ChangedSymbol[];
}

export function extractTopLevelSymbols(fileContent: string): FileSymbolIndex {
  const lines = fileContent.split("\n");
  const symbols: ChangedSymbol[] = [];

  lines.forEach((line, index) => {
    const trimmed = line.trimStart();
    for (const { kind, regex } of DECLARATION_PATTERNS) {
      const match = regex.exec(trimmed);
      if (match?.[1]) {
        symbols.push({ name: match[1], kind, line: index + 1 });
        break;
      }
    }
  });

  return { symbols };
}

/**
 * Given the file's symbol index, finds which declaration(s) a changed line
 * range overlaps — a symbol "owns" every line from its own declaration line
 * up to (but not including) the next top-level declaration's line.
 */
export function symbolsForLineRange(
  index: FileSymbolIndex,
  startLine: number,
  endLine: number,
): ChangedSymbol[] {
  const sorted = [...index.symbols].sort((a, b) => a.line - b.line);
  const owning: ChangedSymbol[] = [];

  sorted.forEach((symbol, i) => {
    const nextStart = sorted[i + 1]?.line ?? Number.POSITIVE_INFINITY;
    const ownsRange = symbol.line <= endLine && nextStart > startLine;
    if (ownsRange) owning.push(symbol);
  });

  return owning;
}

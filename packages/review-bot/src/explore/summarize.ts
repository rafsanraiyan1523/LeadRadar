import type { ChangeKind, ChangedSymbol } from "./types";

/**
 * A short, mechanically-templated description of what changed — describes
 * shape (what kind of change, to what names), never quality or correctness.
 */
export function derivePurpose(params: {
  changeKind: ChangeKind;
  renamedFrom?: string;
  symbols: ChangedSymbol[];
  hunkCount: number;
  linesAdded: number;
  linesRemoved: number;
}): string {
  const { changeKind, renamedFrom, symbols, hunkCount, linesAdded, linesRemoved } = params;

  if (changeKind === "added") {
    return symbols.length > 0
      ? `New file adding ${describeSymbolList(symbols)}.`
      : `New file (+${linesAdded} lines).`;
  }
  if (changeKind === "deleted") {
    return "File removed.";
  }
  if (changeKind === "renamed") {
    return `Renamed from ${renamedFrom ?? "(unknown)"}${linesAdded + linesRemoved > 0 ? ", with content changes" : ", content unchanged"}.`;
  }

  const symbolPart = symbols.length > 0 ? `Touches ${describeSymbolList(symbols)}` : "Touches file-level code outside any exported declaration";
  return `${symbolPart} across ${hunkCount} hunk(s) (+${linesAdded}/-${linesRemoved} lines).`;
}

function describeSymbolList(symbols: ChangedSymbol[]): string {
  const names = symbols.map((s) => `${s.kind} ${s.name}`);
  if (names.length <= 3) return names.join(", ");
  return `${names.slice(0, 3).join(", ")}, and ${names.length - 3} more`;
}

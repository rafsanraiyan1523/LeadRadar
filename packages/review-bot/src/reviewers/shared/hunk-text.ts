import type { ChangeHunkSummary } from "../../explore/types";

/** Lines added by this hunk, with the leading "+" stripped. */
export function addedLines(hunk: ChangeHunkSummary): string[] {
  return hunk.excerpt
    .split("\n")
    .filter((l) => l.startsWith("+"))
    .map((l) => l.slice(1));
}

/** Lines removed by this hunk, with the leading "-" stripped. */
export function removedLines(hunk: ChangeHunkSummary): string[] {
  return hunk.excerpt
    .split("\n")
    .filter((l) => l.startsWith("-"))
    .map((l) => l.slice(1));
}

/** All added lines across every hunk of a file, joined as one block — the unit most detectors reason about. */
export function joinedAddedText(hunks: ChangeHunkSummary[]): string {
  return hunks.flatMap(addedLines).join("\n");
}

export function joinedRemovedText(hunks: ChangeHunkSummary[]): string {
  return hunks.flatMap(removedLines).join("\n");
}

/** Leading-whitespace column count — a rough, language-agnostic nesting-depth proxy. */
export function indentWidth(line: string): number {
  const match = /^[ \t]*/.exec(line);
  return match ? match[0].replace(/\t/g, "  ").length : 0;
}

/** A rubric-format "line" string: a single number, or an inclusive range. */
export function lineRangeLabel(start: number, end: number): string {
  return start === end ? String(start) : `${start}-${end}`;
}

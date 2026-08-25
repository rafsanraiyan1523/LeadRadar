export interface ChangedLine {
  text: string; // includes the leading "+"/"-"
  /** 1-indexed line number in the post-change (new) file. null for a removed ("-") line — it doesn't exist there. */
  newLine: number | null;
}

export interface ParsedHunk {
  header: string;
  /** 1-indexed, in the post-change (new) file. */
  newStart: number;
  newLines: number;
  /** Full +/- body lines (context lines dropped), still uncapped — callers truncate for display. */
  changedLines: ChangedLine[];
}

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

/**
 * Parses `git diff --unified=N` output for a single file into its hunks.
 * Pure text parsing — no external deps. Tracks each changed line's actual
 * line number in the post-change file (context lines advance the counter
 * without being recorded, since a hunk's own `newStart`/`newLines` span the
 * whole hunk — often much wider than the line(s) that actually changed).
 */
export function parseUnifiedDiff(diffText: string): ParsedHunk[] {
  const lines = diffText.split("\n");
  const hunks: ParsedHunk[] = [];
  let current: ParsedHunk | null = null;
  let newLineCursor = 0;

  for (const line of lines) {
    const match = HUNK_HEADER.exec(line);
    if (match) {
      if (current) hunks.push(current);
      const newStart = Number(match[3]);
      current = { header: line, newStart, newLines: Number(match[4] ?? "1"), changedLines: [] };
      newLineCursor = newStart;
      continue;
    }
    if (!current) continue; // still in the file-level +++ / --- preamble

    if (line.startsWith("+")) {
      current.changedLines.push({ text: line, newLine: newLineCursor });
      newLineCursor += 1;
    } else if (line.startsWith("-")) {
      current.changedLines.push({ text: line, newLine: null }); // removed — no position in the new file
    } else {
      newLineCursor += 1; // context line: exists in both files, advances the new-file position
    }
  }
  if (current) hunks.push(current);
  return hunks;
}

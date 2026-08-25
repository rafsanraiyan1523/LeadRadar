import type { Finding } from "../../rubric/types";
import type { StyleReviewFile, StyleReviewInput } from "../shared/types";
import { addedLines, indentWidth, lineRangeLabel } from "../shared/hunk-text";
import type { ChangeHunkSummary } from "../../explore/types";

/**
 * Style/maintainability reviewer — rubric Category 4, deliberately the
 * narrowest of the four. This repo already runs ESLint + Prettier
 * (packages/eslint-config), so nothing formatting/import-order/unused-var
 * related belongs here — those are out of scope by construction, since
 * neither detector below reasons about formatting at all. Only two
 * detectors, matching the rubric's restriction to "a real, statable
 * maintenance cost."
 */

const NESTING_INDENT_THRESHOLD = 12; // ~6 levels of 2-space indentation
const LARGE_HUNK_LINE_THRESHOLD = 60;

/** Detector 1 — a hunk that adds either deeply-nested code or a very large single block. */
function detectComplexityGrowth(file: StyleReviewFile, hunk: ChangeHunkSummary): Finding | null {
  const added = addedLines(hunk);
  const deepLine = added.find((l) => l.trim().length > 0 && indentWidth(l) >= NESTING_INDENT_THRESHOLD);

  if (deepLine) {
    return {
      category: "style-maintainability",
      severity: "SHOULD-FIX",
      title: "Deeply nested code added",
      file: file.path,
      line: lineRangeLabel(hunk.startLine, hunk.endLine),
      explanation:
        `A line in this hunk is indented ${indentWidth(deepLine)} columns deep (~${Math.round(indentWidth(deepLine) / 2)} nesting levels), ` +
        "which is meaningfully harder to follow than the shallower nesting typical elsewhere in this codebase. This is not something " +
        "ESLint's default rules in this repo flag (no max-depth/complexity rule is configured).",
      evidence: deepLine.trim(),
      suggested_fix: "Consider extracting the innermost block into a named helper function, or using early returns/guard clauses to flatten the nesting.",
      confidence: "medium",
    };
  }

  if (added.length > LARGE_HUNK_LINE_THRESHOLD) {
    return {
      category: "style-maintainability",
      severity: "SHOULD-FIX",
      title: "Large block of new logic added in one hunk",
      file: file.path,
      line: lineRangeLabel(hunk.startLine, hunk.endLine),
      explanation: `This hunk adds ${added.length} lines in one contiguous block, which is harder to review and maintain as a single unit than several smaller, named pieces.`,
      evidence: `${added.length} added lines in one hunk (threshold: ${LARGE_HUNK_LINE_THRESHOLD}).`,
      suggested_fix: "Consider splitting this into smaller, independently-named functions if the logic has more than one responsibility.",
      confidence: "low",
    };
  }

  return null;
}

const MIN_DUPLICATE_BLOCK_LINES = 5;
const MIN_DUPLICATE_BLOCK_CHARS = 60;

function normalizeLines(lines: string[]): string[] {
  return lines.map((l) => l.trim()).filter((l) => l.length > 0);
}

function countOccurrences(haystack: string, needle: string): number {
  if (needle.length === 0) return 0;
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + 1);
  }
  return count;
}

/**
 * Detector 2 — an added block that already appears (verbatim, modulo
 * whitespace) elsewhere in the same file. Deliberately scoped to
 * within-file duplication only (not cross-file) — reliably detecting that
 * an added block duplicates logic in a *different* file would need a much
 * broader, riskier search; see docs/assignment/review-subagents.md's
 * limitations section.
 */
function detectWithinFileDuplication(
  file: StyleReviewFile,
  hunk: ChangeHunkSummary,
  readFile: (path: string) => string | null,
): Finding | null {
  const content = readFile(file.path);
  if (content === null) return null;

  const normalizedFile = normalizeLines(content.split("\n")).join("\n");
  const addedNormalized = normalizeLines(addedLines(hunk));

  for (let start = 0; start + MIN_DUPLICATE_BLOCK_LINES <= addedNormalized.length; start += 1) {
    const candidate = addedNormalized.slice(start, start + MIN_DUPLICATE_BLOCK_LINES).join("\n");
    if (candidate.length < MIN_DUPLICATE_BLOCK_CHARS) continue;
    if (countOccurrences(normalizedFile, candidate) < 2) continue;

    return {
      category: "style-maintainability",
      severity: "SHOULD-FIX",
      title: "Added block duplicates existing code in the same file",
      file: file.path,
      line: lineRangeLabel(hunk.startLine, hunk.endLine),
      explanation:
        `At least ${MIN_DUPLICATE_BLOCK_LINES} consecutive added lines already appear elsewhere in ${file.path} (matched, modulo ` +
        "whitespace). Duplicated logic drifts out of sync the next time either copy is changed.",
      evidence: candidate.split("\n").slice(0, 3).join(" / ") + (candidate.split("\n").length > 3 ? " / …" : ""),
      suggested_fix: "Extract the shared logic into a single named function and call it from both places.",
      confidence: "medium",
    };
  }
  return null;
}

export function reviewStyle(
  input: StyleReviewInput,
  readFile: (path: string) => string | null = () => null,
): Finding[] {
  const findings: Finding[] = [];
  for (const file of input.files) {
    if (file.changeKind === "deleted") continue;
    for (const hunk of file.hunks) {
      const complexityFinding = detectComplexityGrowth(file, hunk);
      if (complexityFinding) {
        findings.push(complexityFinding);
        continue; // one style finding per hunk keeps output focused, not a pile-on
      }
      const duplicationFinding = detectWithinFileDuplication(file, hunk, readFile);
      if (duplicationFinding) findings.push(duplicationFinding);
    }
  }
  return findings;
}

import {
  getChangedFileStatuses,
  getDiffStat,
  getUnifiedDiff,
  listAllFiles,
  readFileAtRef,
  resolveMergeBase,
} from "./git";
import { parseUnifiedDiff } from "./diff-parser";
import { extractTopLevelSymbols, symbolsForLineRange } from "./symbols";
import { findCallers } from "./callers";
import { findRelevantTests } from "./tests";
import { computeRiskFlags } from "./risk";
import { derivePurpose } from "./summarize";
import type { ChangeHunkSummary, ChangedFileSummary, ChangedSymbol, ExploreContextPackage, ExploreInput } from "./types";

const DEFAULT_MAX_HUNK_EXCERPT_LINES = 12;
const DEFAULT_MAX_CALLERS = 8;

/**
 * Paths Explore never reads or searches, regardless of what the diff or a
 * grep would otherwise surface — defense-in-depth on top of the structural
 * guarantee (the file simply isn't present in a PR branch's history) from
 * docs/assignment/benchmark-ground-truth.md. Directory entries match any
 * path under them.
 */
const DEFAULT_DENYLIST = [
  "docs/assignment/benchmark-ground-truth.md",
  "node_modules",
  "dist",
  ".next",
  "packages/db/generated",
];

function isDenylisted(path: string, denylist: string[]): boolean {
  return denylist.some((entry) => path === entry || path.startsWith(`${entry}/`));
}

export function runExplore(input: ExploreInput): ExploreContextPackage {
  const headRef = input.headRef ?? "HEAD";
  const maxHunkExcerptLines = input.maxHunkExcerptLines ?? DEFAULT_MAX_HUNK_EXCERPT_LINES;
  const maxCallers = input.maxCallers ?? DEFAULT_MAX_CALLERS;
  const denylist = [...DEFAULT_DENYLIST, ...(input.denylistPaths ?? [])];
  const denylistSet = new Set(denylist);

  const mergeBase = resolveMergeBase(input.repoPath, input.baseRef, headRef);
  const statuses = getChangedFileStatuses(input.repoPath, mergeBase, headRef).filter(
    (s) => s.path.length > 0 && !isDenylisted(s.path, denylist),
  );

  const changedPaths = new Set(statuses.map((s) => s.path));
  const allFiles = listAllFiles(input.repoPath, headRef).filter((p) => !isDenylisted(p, denylist));

  const globalMissingContext: string[] = [
    "Symbol extraction only indexes top-level exported function/class/interface/const declarations — nested, non-exported, or re-exported symbols are not tracked.",
    "Caller and test relevance are found via literal name search (git grep), not a true call graph or import resolver — indirect usage (dynamic dispatch, string-built imports) can be missed, and common short names can be noisy (names under 3 characters are skipped for this reason).",
    "Hardcoded-secret detection is shape-based pattern matching, not a real entropy/credential scan — it is a pointer for reviewers, not a verdict.",
  ];

  const changedFiles: ChangedFileSummary[] = statuses.map((status) => {
    const missingContext: string[] = [];
    const { linesAdded, linesRemoved } = getDiffStat(input.repoPath, mergeBase, headRef, status.path);

    let changeKind: ChangedFileSummary["changeKind"];
    if (status.status === "A") changeKind = "added";
    else if (status.status === "D") changeKind = "deleted";
    else if (status.status === "R") changeKind = "renamed";
    else changeKind = "modified";

    const headContent = changeKind === "deleted" ? null : readFileAtRef(input.repoPath, headRef, status.path);
    const diffText = getUnifiedDiff(input.repoPath, mergeBase, headRef, status.path);
    const isBinary = diffText.includes("Binary files ") && !diffText.includes("@@");

    let hunks: ChangeHunkSummary[] = [];
    let changedSymbols: ChangedSymbol[] = [];

    if (isBinary) {
      missingContext.push("Binary file — diff content was not summarized.");
    } else {
      const parsed = parseUnifiedDiff(diffText);
      hunks = parsed.map((h) => {
        const truncated = h.changedLines.length > maxHunkExcerptLines;
        const kept = h.changedLines.slice(0, maxHunkExcerptLines);
        const omittedNotice = truncated ? `\n… (${h.changedLines.length - kept.length} more line(s) omitted)` : "";
        return {
          header: h.header,
          startLine: h.newStart,
          endLine: h.newStart + Math.max(h.newLines, 1) - 1,
          excerpt: kept.map((l) => l.text).join("\n") + omittedNotice,
          truncated,
          addedLineNumbers: kept.filter((l) => l.newLine !== null).map((l) => l.newLine as number),
        };
      });

      if (headContent !== null) {
        const symbolIndex = extractTopLevelSymbols(headContent);
        const owning = new Map<string, ChangedSymbol>();
        for (const hunk of hunks) {
          for (const sym of symbolsForLineRange(symbolIndex, hunk.startLine, hunk.endLine)) {
            owning.set(`${sym.kind}:${sym.name}:${sym.line}`, sym);
          }
        }
        changedSymbols = [...owning.values()].sort((a, b) => a.line - b.line);
      }
    }

    const symbolNames = changedSymbols.map((s) => s.name);
    const callers =
      changeKind === "deleted"
        ? []
        : findCallers(input.repoPath, headRef, symbolNames, status.path, maxCallers, denylistSet);
    if (changeKind === "deleted") {
      missingContext.push("File deleted — caller search against its (no-longer-present) exports was skipped.");
    }

    const relevantTests = findRelevantTests(
      input.repoPath,
      headRef,
      status.path,
      allFiles,
      changedPaths,
      denylistSet,
    );

    const riskFlags = computeRiskFlags({
      path: status.path,
      linesAdded,
      linesRemoved,
      hunks,
      callers,
      relevantTests,
      hasChangedSymbols: changedSymbols.length > 0,
    });

    const potentiallyAffectedBehavior = describeAffectedBehavior({
      changeKind,
      callers,
      symbolNames,
    });

    return {
      path: status.path,
      changeKind,
      renamedFrom: status.renamedFrom,
      linesAdded,
      linesRemoved,
      purpose: derivePurpose({
        changeKind,
        renamedFrom: status.renamedFrom,
        symbols: changedSymbols,
        hunkCount: hunks.length,
        linesAdded,
        linesRemoved,
      }),
      changedSymbols,
      hunks,
      callers,
      relevantTests,
      potentiallyAffectedBehavior,
      riskFlags,
      missingContext,
    };
  });

  const totalAdded = changedFiles.reduce((sum, f) => sum + f.linesAdded, 0);
  const totalRemoved = changedFiles.reduce((sum, f) => sum + f.linesRemoved, 0);
  const summary = `${changedFiles.length} file(s) changed (+${totalAdded}/-${totalRemoved} lines) between ${mergeBase.slice(0, 7)} (merge-base of ${input.baseRef}) and ${headRef}.`;

  return {
    baseRef: input.baseRef,
    headRef,
    mergeBase,
    generatedAt: new Date().toISOString(),
    changedFiles,
    globalMissingContext,
    summary,
  };
}

function describeAffectedBehavior(params: { changeKind: ChangedFileSummary["changeKind"]; callers: string[]; symbolNames: string[] }): string[] {
  const { changeKind, callers, symbolNames } = params;

  if (changeKind === "deleted") {
    return ["Removing this file can break any in-repo code that imports it; caller search was skipped (see missingContext) — verify manually."];
  }
  if (symbolNames.length === 0) {
    return [];
  }
  if (callers.length === 0) {
    return [
      `No in-repo file references ${symbolNames.join(", ")} by name via text search — impact looks localized to this file, though indirect usage (dynamic dispatch, external/API consumers) isn't ruled out.`,
    ];
  }
  const shown = callers.slice(0, 3);
  const more = callers.length - shown.length;
  return [
    `Behavior in ${shown.join(", ")}${more > 0 ? `, and ${more} more file(s)` : ""} may be affected, since ${callers.length === 1 ? "it references" : "they reference"} ${symbolNames.join(", ")}.`,
  ];
}

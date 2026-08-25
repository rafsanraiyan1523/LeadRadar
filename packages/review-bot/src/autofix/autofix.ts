import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as prettier from "prettier";

export interface FileFixResult {
  path: string;
  changed: boolean;
}

export interface AutofixResult {
  files: FileFixResult[];
  filesChanged: string[];
  applied: boolean;
}

/**
 * The one class of change this bot auto-applies: formatting, via
 * Prettier's own JS API (not a shell-out — works identically whether
 * repoPath is a real pnpm workspace or a bare temp directory, and needs no
 * project setup beyond an optional .prettierrc Prettier itself resolves).
 *
 * This is "safe" by construction, not by review: Prettier's entire
 * contract is that it only ever changes whitespace/formatting, never
 * semantics — the same guarantee this bot leans on for every other
 * safety claim it makes (see docs/assignment/autofix-and-triage.md). It
 * is deliberately scoped to *only* the files passed in (a PR's own
 * changed files), never a repo-wide reformat — this bot changes exactly
 * what the PR touched, nothing else, matching the "no review of
 * unrelated unchanged code" principle already applied to reviewing.
 *
 * ESLint --fix is a deliberately separate, NOT-implemented capability
 * here — see docs/assignment/autofix-and-triage.md for why (rule-specific
 * safety is harder to make a single blanket guarantee about than
 * Prettier's formatting-only contract).
 */
export async function runSafeAutofix(
  repoPath: string,
  relativeFilePaths: string[],
  options: { dryRun?: boolean } = {},
): Promise<AutofixResult> {
  const dryRun = options.dryRun ?? false;
  const files: FileFixResult[] = [];

  for (const relPath of relativeFilePaths) {
    const fullPath = join(repoPath, relPath);
    let before: string;
    try {
      before = readFileSync(fullPath, "utf8");
    } catch {
      // File doesn't exist locally (e.g. deleted in this diff) — nothing to format.
      continue;
    }

    let after: string;
    try {
      const config = (await prettier.resolveConfig(fullPath)) ?? {};
      after = await prettier.format(before, { ...config, filepath: fullPath });
    } catch {
      // Prettier has no parser for this file type, or the file has a
      // syntax error it can't format — skip it rather than guess.
      continue;
    }

    const changed = after !== before;
    if (changed && !dryRun) {
      writeFileSync(fullPath, after, "utf8");
    }
    files.push({ path: relPath, changed });
  }

  const filesChanged = files.filter((f) => f.changed).map((f) => f.path);
  return { files, filesChanged, applied: !dryRun && filesChanged.length > 0 };
}

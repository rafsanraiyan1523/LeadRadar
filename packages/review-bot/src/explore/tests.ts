import type { RelevantTestFile } from "./types";
import { grepRef } from "./git";

const TEST_FILE_RE = /\.(spec|test)\.tsx?$/;
const E2E_FILE_RE = /(^|\/)(e2e|test)\//i;

function basenameWithoutExt(path: string): string {
  const file = path.split("/").pop() ?? path;
  return file.replace(/\.(ts|tsx|js|jsx)$/, "");
}

/**
 * Finds test files relevant to a changed file:
 *  - co-located spec: same basename, `.spec.ts`/`.test.ts` alongside it
 *  - otherwise, any test-like file elsewhere in the repo that textually
 *    references the changed file's basename (import-reference), further
 *    labeled e2e-suite-reference when the test file itself lives under an
 *    e2e/ or test/ directory (this repo's convention for integration
 *    suites — see apps/api/test/*.e2e-spec.ts, apps/web/e2e/*.spec.ts).
 */
export function findRelevantTests(
  repoPath: string,
  headRef: string,
  changedFilePath: string,
  allFiles: string[],
  changedFilesSet: Set<string>,
  denylist: Set<string>,
): RelevantTestFile[] {
  const results = new Map<string, RelevantTestFile>();
  const dir = changedFilePath.includes("/") ? changedFilePath.slice(0, changedFilePath.lastIndexOf("/")) : "";
  const base = basenameWithoutExt(changedFilePath);

  // 1. Co-located spec/test file.
  for (const candidateSuffix of [".spec.ts", ".spec.tsx", ".test.ts", ".test.tsx"]) {
    const candidate = dir ? `${dir}/${base}${candidateSuffix}` : `${base}${candidateSuffix}`;
    if (candidate === changedFilePath) continue;
    if (denylist.has(candidate)) continue;
    if (allFiles.includes(candidate)) {
      results.set(candidate, { path: candidate, changedInDiff: changedFilesSet.has(candidate), matchedBy: "co-located-spec" });
    }
  }

  // Already-tested files that are themselves spec files don't need an
  // import-reference search against their own basename (nothing "imports"
  // a boundary test by name the way source imports a module).
  if (TEST_FILE_RE.test(changedFilePath)) return [...results.values()];

  // 2. Any test-like file elsewhere that references this file's basename.
  if (base.length >= 3) {
    const matches = grepRef(repoPath, headRef, base);
    for (const match of matches) {
      if (results.has(match.path)) continue;
      if (match.path === changedFilePath) continue;
      if (denylist.has(match.path)) continue;
      if (!TEST_FILE_RE.test(match.path)) continue;
      results.set(match.path, {
        path: match.path,
        changedInDiff: changedFilesSet.has(match.path),
        matchedBy: E2E_FILE_RE.test(match.path) ? "e2e-suite-reference" : "import-reference",
      });
    }
  }

  return [...results.values()];
}

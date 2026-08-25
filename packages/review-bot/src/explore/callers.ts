import { grepRef } from "./git";

/**
 * Finds repo-relative paths of files (other than the changed file itself)
 * that reference at least one of the given symbol names. Uses `git grep`
 * directly against the head ref's tree — no working-tree read, no per-file
 * content pulled into memory here.
 */
export function findCallers(
  repoPath: string,
  headRef: string,
  symbolNames: string[],
  changedFilePath: string,
  maxCallers: number,
  denylist: Set<string>,
): string[] {
  const found = new Set<string>();

  for (const name of symbolNames) {
    if (found.size >= maxCallers) break;
    // Symbol names under a handful of characters (e.g. re-exported single
    // letters) produce too many false-positive substring matches to be a
    // useful caller signal.
    if (name.length < 3) continue;

    const matches = grepRef(repoPath, headRef, name);
    for (const match of matches) {
      if (match.path === changedFilePath) continue;
      if (denylist.has(match.path)) continue;
      found.add(match.path);
      if (found.size >= maxCallers) break;
    }
  }

  return [...found];
}

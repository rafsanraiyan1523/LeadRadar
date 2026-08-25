import { execFileSync } from "node:child_process";

/**
 * Thin git CLI wrapper. Uses execFileSync (argv array, no shell) throughout
 * so nothing here is vulnerable to shell injection via ref names or paths —
 * both can come from PR metadata in the real bot, which is untrusted input.
 */
function git(repoPath: string, args: string[]): string {
  try {
    return execFileSync("git", args, {
      cwd: repoPath,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    const stderr = error instanceof Error && "stderr" in error ? String((error as { stderr?: unknown }).stderr) : "";
    throw new Error(`git ${args.join(" ")} failed in ${repoPath}: ${stderr || (error as Error).message}`);
  }
}

export function resolveMergeBase(repoPath: string, baseRef: string, headRef: string): string {
  return git(repoPath, ["merge-base", baseRef, headRef]).trim();
}

export interface ChangedFileStatus {
  path: string;
  renamedFrom?: string;
  status: "A" | "M" | "D" | "R";
}

/**
 * Files changed by headRef since it diverged from baseRef — a three-dot-
 * equivalent diff (base is merge-base, not baseRef's current tip). See
 * docs/assignment/benchmark-ground-truth.md for why this distinction
 * matters: a two-dot diff against a baseRef that has since moved on would
 * pick up unrelated changes.
 */
export function getChangedFileStatuses(repoPath: string, mergeBase: string, headRef: string): ChangedFileStatus[] {
  const output = git(repoPath, ["diff", "--name-status", "--find-renames", `${mergeBase}..${headRef}`]);
  const lines = output.split("\n").filter((l) => l.trim().length > 0);
  return lines.map((line) => {
    const parts = line.split("\t");
    const rawStatus = parts[0] ?? "M";
    const statusChar = rawStatus[0] as ChangedFileStatus["status"];
    if (statusChar === "R") {
      return { status: "R", renamedFrom: parts[1], path: parts[2] ?? parts[1] ?? "" };
    }
    return { status: statusChar, path: parts[1] ?? "" };
  });
}

export function getUnifiedDiff(repoPath: string, mergeBase: string, headRef: string, path: string): string {
  return git(repoPath, ["diff", "--unified=3", "--find-renames", `${mergeBase}..${headRef}`, "--", path]);
}

export interface DiffStat {
  linesAdded: number;
  linesRemoved: number;
}

export function getDiffStat(repoPath: string, mergeBase: string, headRef: string, path: string): DiffStat {
  const output = git(repoPath, ["diff", "--numstat", "--find-renames", `${mergeBase}..${headRef}`, "--", path]);
  const line = output.split("\n").find((l) => l.trim().length > 0);
  if (!line) return { linesAdded: 0, linesRemoved: 0 };
  const [added, removed] = line.split("\t");
  return {
    linesAdded: added === "-" ? 0 : Number(added), // "-" numstat means binary file
    linesRemoved: removed === "-" ? 0 : Number(removed),
  };
}

/** Full file content at a given ref, or null if the file doesn't exist there (e.g. deleted, or added-only). */
export function readFileAtRef(repoPath: string, ref: string, path: string): string | null {
  try {
    return git(repoPath, ["show", `${ref}:${path}`]);
  } catch {
    return null;
  }
}

/** All tracked file paths at a ref — the search universe for callers/tests, naturally excluding gitignored build output. */
export function listAllFiles(repoPath: string, ref: string): string[] {
  return git(repoPath, ["ls-tree", "-r", "--name-only", ref])
    .split("\n")
    .filter((l) => l.trim().length > 0);
}

export interface GrepMatch {
  path: string;
  line: number;
}

/**
 * git grep against a ref's tree (no working-tree checkout needed). Used to
 * find candidate callers/test references quickly and without reading every
 * file into memory ourselves.
 */
export function grepRef(repoPath: string, ref: string, needle: string, pathspecs: string[] = []): GrepMatch[] {
  if (needle.trim().length === 0) return [];
  try {
    const output = git(repoPath, ["grep", "-n", "-F", "-e", needle, ref, "--", ...(pathspecs.length ? pathspecs : ["."])]);
    return output
      .split("\n")
      .filter((l) => l.trim().length > 0)
      .map((line) => {
        // format: "<ref>:<path>:<lineno>:<matched text>"
        const withoutRef = line.slice(ref.length + 1);
        const firstColon = withoutRef.indexOf(":");
        const path = withoutRef.slice(0, firstColon);
        const rest = withoutRef.slice(firstColon + 1);
        const secondColon = rest.indexOf(":");
        const lineNoStr = rest.slice(0, secondColon);
        return { path, line: Number(lineNoStr) };
      });
  } catch {
    // git grep exits 1 (not an error for us) when there are no matches.
    return [];
  }
}

import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

/**
 * A throwaway, hermetic git repo for exercising Explore's git-plumbing
 * against real `git diff`/`git grep`/`git show` output — not a mock of git,
 * the real CLI, run in an isolated temp directory so tests never touch
 * this repository and never depend on its current file layout. Mirrors the
 * "shared test fixture" pattern already used in
 * packages/providers/src/audit/test-utils.ts, adapted for a repo fixture.
 */
export class TempRepo {
  readonly path: string;

  private constructor(path: string) {
    this.path = path;
  }

  static create(): TempRepo {
    const path = mkdtempSync(join(tmpdir(), "review-bot-explore-"));
    const repo = new TempRepo(path);
    repo.git(["init", "--initial-branch=main"]);
    repo.git(["config", "user.name", "Test User"]);
    repo.git(["config", "user.email", "test@example.invalid"]);
    return repo;
  }

  git(args: string[]): string {
    return execFileSync("git", args, { cwd: this.path, encoding: "utf8" });
  }

  writeFile(relPath: string, content: string): void {
    const fullPath = join(this.path, relPath);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content, "utf8");
  }

  commitAll(message: string): string {
    this.git(["add", "-A"]);
    this.git(["commit", "-m", message]);
    return this.git(["rev-parse", "HEAD"]).trim();
  }

  checkoutNewBranch(name: string): void {
    this.git(["checkout", "-b", name]);
  }

  checkout(ref: string): void {
    this.git(["checkout", ref]);
  }

  cleanup(): void {
    rmSync(this.path, { recursive: true, force: true });
  }
}

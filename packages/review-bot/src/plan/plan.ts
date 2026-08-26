import type { ChangedFileSummary, ExploreContextPackage } from "../explore/types";
import type { ReviewerName } from "../pipeline/types";
import { CREDENTIAL_KEYWORD, CREDENTIAL_SHAPES } from "../reviewers/security/security-reviewer";
import { joinedAddedText } from "../reviewers/shared/hunk-text";
import type { IgnoredFile, Plan, PlanArea, PlanPriority } from "./types";

/**
 * Plan subagent (docs/assignment/subagent-architecture.md §2, implemented
 * Step 13). Sits between Explore and the four specialized reviewers:
 * decides, per changed file, which reviewer categories are worth pointing
 * at it, why, and how urgent it looks — never performs a review itself
 * (no Finding is ever constructed here).
 *
 * Deterministic, same rationale as Explore and the reviewers (Step 5/6's
 * "agents only where judgment is required" principle): every rule below
 * is a mechanical check against Explore's already-computed, general-
 * purpose signals (file extension, changed-symbol kinds, Explore's own
 * riskFlags, the Security reviewer's own published credential-shape
 * patterns) — none of it is tuned to, or aware of, any specific seeded
 * defect. See plan.spec.ts's "does not contain hidden benchmark
 * knowledge" tests for the explicit check.
 */

const NON_CODE_FILE = /\.(md|json|ya?ml|lock|txt|svg|png|jpe?g|gif|ico)$/i;
const TEST_FILE = /\.(spec|test)\.(ts|tsx|js|jsx)$/;
const SOURCE_FILE = /\.(ts|tsx|js|jsx)$/;
const CONTROLLER_FILE = /\.controller\.ts$/;

/** Which ExploreContextPackage/ChangedFileSummary fields each reviewer's narrowed input actually reads — mirrors reviewers/shared/types.ts's Pick<> narrowing, stated explicitly here as Plan's own context-requirements output. */
const CONTEXT_FIELDS: Record<ReviewerName, string[]> = {
  logic: ["path", "changeKind", "linesAdded", "linesRemoved", "hunks", "changedSymbols"],
  "test-coverage": ["path", "changeKind", "linesAdded", "linesRemoved", "hunks", "changedSymbols", "relevantTests"],
  security: ["path", "changeKind", "linesAdded", "linesRemoved", "hunks", "changedSymbols"],
  "style-maintainability": ["path", "changeKind", "linesAdded", "linesRemoved", "hunks", "changedSymbols"],
};

type FileKind = "non-code" | "test" | "source" | "other";

function classifyFileKind(path: string): FileKind {
  if (NON_CODE_FILE.test(path)) return "non-code";
  if (TEST_FILE.test(path)) return "test";
  if (SOURCE_FILE.test(path)) return "source";
  return "other";
}

/** True when Explore's own general-purpose risk flags — or the credential-shape patterns the Security reviewer itself publishes — already point at this file. Never references a specific file path or defect. */
function hasSecuritySignal(file: ChangedFileSummary): boolean {
  const flagged = file.riskFlags.some((f) => f.kind === "security-sensitive-path" || f.kind === "possible-hardcoded-secret");
  if (flagged) return true;
  if (CONTROLLER_FILE.test(file.path)) return true;

  // Belt-and-suspenders: Explore's own risk-flag shape list (Step 5) is a
  // strict subset of the Security reviewer's own credential-shape list
  // (Step 6 added AWS keys) — checking the reviewer's own patterns
  // directly here means Plan can never route a file to Security *less*
  // completely than the reviewer would have flagged it on its own if
  // handed the whole PR, which is what "preserve existing behavior"
  // (Step 13) requires.
  const addedText = joinedAddedText(file.hunks);
  if (!CREDENTIAL_KEYWORD.test(addedText)) return false;
  return CREDENTIAL_SHAPES.some((re) => re.test(addedText));
}

function hasAnyChangedSymbol(file: ChangedFileSummary): boolean {
  return file.changedSymbols.length > 0;
}

function buildArea(file: ChangedFileSummary): PlanArea | null {
  const selectedReviewers: ReviewerName[] = [];
  const rationaleParts: string[] = [];

  if (file.hunks.length > 0) {
    selectedReviewers.push("logic", "style-maintainability");
    rationaleParts.push("Contains code changes that could alter runtime behavior or maintainability.");
  }
  if (hasAnyChangedSymbol(file)) {
    selectedReviewers.push("test-coverage");
    rationaleParts.push("Changes a named symbol (function/class/const) — eligible for test-coverage review.");
  }
  if (hasSecuritySignal(file)) {
    selectedReviewers.push("security");
    rationaleParts.push("Explore flagged a security-sensitive path or credential-shaped content, or this is a controller (route) file.");
  }

  if (selectedReviewers.length === 0) return null;

  const uniqueReviewers = [...new Set(selectedReviewers)];
  const priority: PlanPriority = hasSecuritySignal(file) ? "high" : hasAnyChangedSymbol(file) ? "medium" : "low";

  return {
    file: file.path,
    relevantSymbols: file.changedSymbols.map((s) => s.name),
    selectedReviewers: uniqueReviewers,
    rationale: rationaleParts.join(" "),
    contextRequirements: [...new Set(uniqueReviewers.flatMap((r) => CONTEXT_FIELDS[r]))],
    priority,
  };
}

export function createPlan(pkg: ExploreContextPackage): Plan {
  const areas: PlanArea[] = [];
  const ignoredFiles: IgnoredFile[] = [];

  for (const file of pkg.changedFiles) {
    const kind = classifyFileKind(file.path);

    if (kind === "non-code" || kind === "other") {
      ignoredFiles.push({
        file: file.path,
        reason: kind === "non-code" ? "Non-code/config file — outside the review rubric's scope." : "Unrecognized file type — outside the review rubric's scope.",
      });
      continue;
    }
    if (file.changeKind === "deleted") {
      ignoredFiles.push({ file: file.path, reason: "File deleted — nothing left to review." });
      continue;
    }
    if (kind === "test") {
      // Test files are eligible for maintainability review (duplication/
      // complexity can affect a test file too), but not for logic/
      // security/missing-test checks, which target production code.
      areas.push({
        file: file.path,
        relevantSymbols: file.changedSymbols.map((s) => s.name),
        selectedReviewers: ["style-maintainability"],
        rationale: "Test file — eligible for maintainability review; logic/security/missing-test checks target production code, not the tests themselves.",
        contextRequirements: CONTEXT_FIELDS["style-maintainability"],
        priority: "low",
      });
      continue;
    }

    const area = buildArea(file);
    if (area) {
      areas.push(area);
    } else {
      ignoredFiles.push({
        file: file.path,
        reason: "Source file with no hunks, no changed named symbols, and no security signal — nothing for the rubric's categories to act on.",
      });
    }
  }

  const relevantFiles = areas.map((a) => a.file);
  const selectedReviewers = [...new Set(areas.flatMap((a) => a.selectedReviewers))];

  return {
    reviewScope: `${relevantFiles.length} of ${pkg.changedFiles.length} changed file(s) require review; ${ignoredFiles.length} safely ignored (non-code, deleted, or no rubric-relevant signal).`,
    selectedReviewers,
    relevantFiles,
    areas,
    ignoredFiles,
  };
}

/**
 * Applies a Plan's routing decision: returns a copy of the context
 * package containing only the files Plan selected for `reviewer`. This is
 * what a reviewer actually receives — everything Plan decided was
 * irrelevant to it is gone before the reviewer's own narrowFor*Review()
 * projection ever runs, not just hidden by convention.
 */
export function selectFilesForReviewer(pkg: ExploreContextPackage, plan: Plan, reviewer: ReviewerName): ExploreContextPackage {
  const allowedPaths = new Set(plan.areas.filter((a) => a.selectedReviewers.includes(reviewer)).map((a) => a.file));
  return { ...pkg, changedFiles: pkg.changedFiles.filter((f) => allowedPaths.has(f.path)) };
}

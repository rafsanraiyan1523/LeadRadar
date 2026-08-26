import type { Finding } from "../../rubric/types";
import type { SecurityReviewFile, SecurityReviewInput } from "../shared/types";
import { joinedAddedText, lineRangeLabel } from "../shared/hunk-text";
import type { ChangeHunkSummary } from "../../explore/types";

/**
 * Security reviewer — rubric Category 3. Both detectors below only ever
 * fire on text that is literally present in an *added* line of the diff —
 * this reviewer never re-flags pre-existing code the PR didn't touch.
 */

const TEST_FILE = /\.(spec|test)\.tsx?$/;
const UNDER_TEST_DIR = /(^|\/)(e2e|test)\//i;

// Loosely shaped, deliberately over-inclusive credential formats — see
// Step 5's Explore risk.ts, extended slightly (AWS key shape added) and
// re-implemented here independently since the Security reviewer's
// threshold for "worth a full Finding" is different from Explore's
// lightweight flag. Exported (Step 13) so the Plan subagent's routing can
// reuse this exact, single-source-of-truth definition of "credential-
// shaped" rather than re-deriving or duplicating it — Plan needs to know
// whether a file is *worth sending to Security* using the same notion of
// "looks like a secret" this reviewer itself uses, not a narrower guess.
export const CREDENTIAL_SHAPES = [
  /AIza[0-9A-Za-z_-]{10,}/, // Google API key shape
  /sk-[A-Za-z0-9_-]{16,}/, // OpenAI/Anthropic-style secret key shape
  /AKIA[0-9A-Z]{16}/, // AWS access key ID shape
  /["'][A-Za-z0-9/+]{32,}={0,2}["']/, // long base64-ish quoted literal
];
// Deliberately no \b word-boundary requirement: real identifiers are often
// camelCase compounds (e.g. googlePlacesApiKey), where "apiKey" has no word
// boundary on its left (the transition from "s" to "A" is \w-to-\w, not a
// boundary) — a \b-anchored version would silently miss exactly this shape.
export const CREDENTIAL_KEYWORD = /apiKey|api_key|secret|token|password|credential|privateKey|private_key/i;

/**
 * Detector 1 — a credential-shaped literal introduced alongside a
 * credential-named identifier in the same hunk. Deliberately requires
 * BOTH the shape and a nearby credential keyword: per Step 6 instructions
 * ("do not report fake or obviously harmless values unless they are
 * clearly representative of a secret exposure problem"), a fake-looking
 * string with no credential context isn't reported — what's flagged is the
 * *pattern* (a literal standing in for a credential), which is exactly as
 * real a problem when the literal happens to be a synthetic placeholder as
 * when it's a live key (see docs/assignment/benchmark-ground-truth.md's
 * DEFECT-3 reasoning). Test files are excluded — fixture values there are
 * expected and not a exposure risk in the same sense.
 */
function detectHardcodedCredential(file: SecurityReviewFile, hunk: ChangeHunkSummary): Finding | null {
  if (TEST_FILE.test(file.path) || UNDER_TEST_DIR.test(file.path)) return null;

  const block = joinedAddedText([hunk]);
  if (!CREDENTIAL_KEYWORD.test(block)) return null;
  const shapeMatch = CREDENTIAL_SHAPES.map((re) => re.exec(block)).find((m) => m !== null);
  if (!shapeMatch) return null;

  return {
    category: "security",
    severity: "MUST-FIX",
    title: "Credential-shaped literal introduced alongside a credential-named field",
    file: file.path,
    line: lineRangeLabel(hunk.startLine, hunk.endLine),
    explanation:
      "This hunk introduces a string literal shaped like an API key/token/secret, on the same block as a credential-named " +
      "identifier. Hardcoding a credential-shaped value in source — as a default, fallback, or otherwise — is a secret-exposure " +
      "pattern regardless of whether the specific value is a live credential or a placeholder: it normalizes committing secret-shaped " +
      "literals to the repo, and the pattern is unsafe the moment a real value is substituted in.",
    evidence: shapeMatch[0],
    suggested_fix:
      "Remove the hardcoded literal. If a value is genuinely required and missing configuration should be tolerated, fail loudly " +
      "(throw, as this codebase's other credential-requiring constructors do) rather than silently defaulting to a literal.",
    confidence: "high",
  };
}

const ROUTE_DECORATOR = /@(Get|Post|Put|Delete|Patch)\s*\(/;
const USE_GUARDS = /@UseGuards\s*\(/;
const CONTROLLER_FILE = /\.controller\.ts$/;
const CLASS_DECLARATION = /export\s+class\s+\w+/;
// Decorators (e.g. @Controller(...), @UseGuards(...)) sit directly above a
// class declaration — scanning a fixed small window avoids needing a real
// TS parser just to find them.
const DECORATOR_WINDOW_LINES = 5;

/**
 * True when this hunk's added text both introduces a route method and
 * carries no @UseGuards of its own.
 *
 * KNOWN LIMITATION, preserved intentionally (see
 * docs/assignment/refactoring-notes.md): this checks the *whole hunk's*
 * added text, not one specific method. If a single hunk introduces
 * several new route methods and only some of them are missing a guard,
 * this returns `false` (no finding) as soon as *any* of them has one —
 * see security-reviewer.spec.ts's "[characterization]" test for the exact
 * shape this affects. Refactored for clarity in Step 10; this behavior
 * was NOT changed, since fixing it is a behavior change, not a refactor.
 */
function hunkAddsRouteWithoutOwnGuard(addedText: string): boolean {
  return ROUTE_DECORATOR.test(addedText) && !USE_GUARDS.test(addedText);
}

/** Index of `export class ...` in fileContent, or null if none is found. */
function classDeclarationIndex(fileContent: string): number | null {
  const match = CLASS_DECLARATION.exec(fileContent);
  return match ? match.index : null;
}

/** True when a @UseGuards decorator sits directly above the class declaration. */
function hasClassLevelGuard(fileContent: string, classIndex: number): boolean {
  const beforeClass = fileContent.slice(0, classIndex);
  const decoratorWindow = beforeClass.split("\n").slice(-DECORATOR_WINDOW_LINES).join("\n");
  return USE_GUARDS.test(decoratorWindow);
}

/**
 * True when some OTHER part of the file already carries @UseGuards —
 * evidence of an established per-method guard convention this new,
 * unguarded method deviates from. Excludes the degenerate case where
 * `fileContent` is (near-)identical to `addedText` (a brand-new file
 * added in one hunk): there, any guard found is part of this same new
 * code, not an existing sibling convention to compare against.
 */
function hasGuardedSiblingMethod(fileContent: string, addedText: string): boolean {
  return USE_GUARDS.test(fileContent) && !addedText.includes(fileContent);
}

/**
 * Detector 2 — a new route-decorated controller method added without
 * @UseGuards, in a controller where (a) the class itself has no
 * class-level @UseGuards and (b) at least one other method in the file
 * does have one — i.e. this specific method appears to deviate from an
 * established, guarded convention, rather than the whole controller simply
 * being intentionally public. Requires reading the full file (a narrow,
 * on-demand capability, not open-ended repo access — see
 * docs/assignment/review-subagents.md) to check both conditions, since
 * neither is decidable from the hunk alone.
 */
function detectMissingGuardOnNewEndpoint(
  file: SecurityReviewFile,
  hunk: ChangeHunkSummary,
  readFile: (path: string) => string | null,
): Finding | null {
  if (!CONTROLLER_FILE.test(file.path)) return null;

  const addedText = joinedAddedText([hunk]);
  if (!hunkAddsRouteWithoutOwnGuard(addedText)) return null;

  const content = readFile(file.path);
  if (content === null) return null;

  const classIndex = classDeclarationIndex(content);
  if (classIndex === null) return null;
  if (hasClassLevelGuard(content, classIndex)) return null; // false-positive avoidance per the rubric's explicit rule
  if (!hasGuardedSiblingMethod(content, addedText)) return null; // whole controller may be intentionally public — too uncertain to flag

  const method = ROUTE_DECORATOR.exec(addedText)?.[0] ?? "this endpoint";
  return {
    category: "security",
    severity: "MUST-FIX",
    title: "New endpoint appears to be missing @UseGuards, unlike sibling methods in this controller",
    file: file.path,
    line: lineRangeLabel(hunk.startLine, hunk.endLine),
    explanation:
      `A new ${method} method was added to ${file.path} with no @UseGuards decorator, and no class-level @UseGuards is present ` +
      "either. At least one other method in this same file does have @UseGuards, suggesting this controller follows a per-method " +
      "guard convention that this new method doesn't follow — meaning it may be reachable without authentication/authorization.",
    evidence: addedText.trim().split("\n").find((l) => ROUTE_DECORATOR.test(l))?.trim() ?? addedText.trim(),
    suggested_fix: "Add the same @UseGuards(...) decorator used by this controller's other guarded methods, unless this endpoint is deliberately public (in which case, consider a comment explaining why).",
    confidence: "medium",
  };
}

export function reviewSecurity(
  input: SecurityReviewInput,
  readFile: (path: string) => string | null = () => null,
): Finding[] {
  const findings: Finding[] = [];
  for (const file of input.files) {
    if (file.changeKind === "deleted") continue;
    for (const hunk of file.hunks) {
      const credentialFinding = detectHardcodedCredential(file, hunk);
      if (credentialFinding) findings.push(credentialFinding);

      const guardFinding = detectMissingGuardOnNewEndpoint(file, hunk, readFile);
      if (guardFinding) findings.push(guardFinding);
    }
  }
  return findings;
}

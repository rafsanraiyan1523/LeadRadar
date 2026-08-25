import type { ChangeHunkSummary, RelevantTestFile, RiskFlag } from "./types";

/**
 * Purely mechanical pattern-matching — every flag here states an observed
 * fact ("path matches X", "no test found") for a reviewer to weigh, never a
 * verdict ("this is a vulnerability"). Severity/judgment is explicitly the
 * specialized reviewers' job (see docs/assignment/subagent-architecture.md),
 * not Explore's — this module exists to point reviewers at the same small
 * set of places a human would double-check first, not to replace them.
 */

const SECURITY_PATH_KEYWORDS = /(^|\/)(auth|guard|security|secret|token|credential|crypto|url-safety|password)/i;

// Loose, deliberately over-inclusive shapes of common credential formats —
// false positives here just mean "a reviewer double-checks a config
// literal," which is a low-cost mistake for a risk *flag* to make.
const SECRET_SHAPED_LITERAL = [
  /AIza[0-9A-Za-z_-]{10,}/, // Google API key shape
  /sk-[A-Za-z0-9_-]{16,}/, // OpenAI/Anthropic-style secret key shape
  /["'][A-Za-z0-9/+]{32,}={0,2}["']/, // long base64-ish quoted literal
];

const LARGE_DIFF_LINE_THRESHOLD = 150;
const WIDELY_IMPORTED_THRESHOLD = 5;

export function computeRiskFlags(params: {
  path: string;
  linesAdded: number;
  linesRemoved: number;
  hunks: ChangeHunkSummary[];
  callers: string[];
  relevantTests: RelevantTestFile[];
  hasChangedSymbols: boolean;
}): RiskFlag[] {
  const flags: RiskFlag[] = [];

  if (SECURITY_PATH_KEYWORDS.test(params.path)) {
    flags.push({
      kind: "security-sensitive-path",
      description: `Path matches a security-sensitive naming pattern (auth/guard/secret/credential/etc.): ${params.path}`,
    });
  }

  for (const hunk of params.hunks) {
    for (const pattern of SECRET_SHAPED_LITERAL) {
      if (pattern.test(hunk.excerpt)) {
        flags.push({
          kind: "possible-hardcoded-secret",
          description: `A hunk near line ${hunk.startLine} contains a string literal shaped like a credential/API key.`,
        });
        break;
      }
    }
  }

  if (params.hasChangedSymbols) {
    if (params.relevantTests.length === 0) {
      flags.push({
        kind: "no-relevant-test-found",
        description: "No co-located spec, e2e reference, or import-reference test file was found for this change.",
      });
    } else if (!params.relevantTests.some((t) => t.changedInDiff)) {
      flags.push({
        kind: "relevant-tests-exist-but-unchanged",
        description: `${params.relevantTests.length} relevant test file(s) were found, but none of them changed in this diff.`,
      });
    }
  }

  if (params.linesAdded + params.linesRemoved > LARGE_DIFF_LINE_THRESHOLD) {
    flags.push({
      kind: "large-diff",
      description: `+${params.linesAdded}/-${params.linesRemoved} lines in one file — large changes are harder to review thoroughly in one pass.`,
    });
  }

  if (params.callers.length > WIDELY_IMPORTED_THRESHOLD) {
    flags.push({
      kind: "widely-imported-file",
      description: `Referenced from ${params.callers.length}+ other files — changes here have a wide blast radius.`,
    });
  }

  return flags;
}

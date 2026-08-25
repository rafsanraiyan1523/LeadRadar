import type { FindingConfidence, FindingSeverity } from "../rubric/types";
import type { NormalizedFinding, RawFinding } from "./types";

/**
 * Finding Normalization (docs/assignment/subagent-architecture.md's
 * "Finding Normalization" stage) — deterministic bookkeeping, not
 * judgment: assigns a stable id and records provenance. Every reviewer
 * already emits schema-conformant Finding objects (Step 6), so there is no
 * repair/validation loop needed here today — this stage's only job is the
 * id/source stamp.
 */
export function normalizeFindings(raw: RawFinding[]): NormalizedFinding[] {
  return raw.map((r, index) => ({ ...r.finding, id: `F${index + 1}`, source: r.source }));
}

function parseLineRange(line: string): [number, number] {
  const parts = line.split("-").map(Number);
  const start = parts[0] ?? 0;
  const end = parts[1] ?? start;
  return [start, end];
}

function rangesOverlap(a: [number, number], b: [number, number]): boolean {
  return a[0] <= b[1] && b[0] <= a[1];
}

const SEVERITY_RANK: Record<FindingSeverity, number> = { "MUST-FIX": 2, "SHOULD-FIX": 1, IGNORE: 0 };
const CONFIDENCE_RANK: Record<FindingConfidence, number> = { high: 2, medium: 1, low: 0 };

/**
 * Deduplication (architecture doc's "Deduplication" stage). Groups
 * findings — regardless of which reviewer/category produced them — by
 * (file, overlapping line range), per the rubric's rule that the same root
 * cause flagged by two categories should be presented once, under the
 * higher-severity category. Within a group, keeps the highest-severity
 * finding, breaking ties by confidence, then by first-seen order — never
 * an arbitrary/random choice.
 *
 * This is the *exact-location* half of deduplication only. Semantic
 * duplicates worded differently at different locations are Final Review's
 * job (not yet built) — see docs/assignment/review-subagents.md's
 * limitations section, which already documents this boundary.
 */
export function deduplicateFindings(findings: NormalizedFinding[]): NormalizedFinding[] {
  const groups: NormalizedFinding[][] = [];

  for (const finding of findings) {
    const range = parseLineRange(finding.line);
    const group = groups.find((g) =>
      g.some((existing) => existing.file === finding.file && rangesOverlap(parseLineRange(existing.line), range)),
    );
    if (group) group.push(finding);
    else groups.push([finding]);
  }

  return groups.map((group) => {
    const winner = group
      .slice()
      .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || CONFIDENCE_RANK[b.confidence] - CONFIDENCE_RANK[a.confidence])[0];
    return winner!;
  });
}

/**
 * Severity/Confidence Filtering (architecture doc's final deterministic
 * stage before Final Review). Drops:
 *  - any IGNORE-severity finding — a backstop; reviewers already apply the
 *    rubric's evidence gate themselves and never construct one, but this
 *    stage doesn't trust that invariant blindly.
 *  - any low-confidence finding — per the rubric's tie-break rule
 *    ("uncertain between SHOULD-FIX and IGNORE ⇒ do not report it"), a
 *    reviewer marking its own finding low-confidence is exactly that
 *    situation, so it's filtered here rather than surfaced as noise.
 */
export function filterFindings(findings: NormalizedFinding[]): NormalizedFinding[] {
  return findings.filter((f) => f.severity !== "IGNORE" && f.confidence !== "low");
}

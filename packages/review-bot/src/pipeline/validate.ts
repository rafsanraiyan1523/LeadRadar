import type { NormalizedFinding } from "./types";

const REQUIRED_STRING_FIELDS = [
  "id",
  "source",
  "category",
  "severity",
  "title",
  "file",
  "line",
  "explanation",
  "evidence",
  "suggested_fix",
  "confidence",
] as const;

const VALID_CATEGORY = new Set(["logic-error", "missing-tests", "security", "style-maintainability"]);
const VALID_SEVERITY = new Set(["MUST-FIX", "SHOULD-FIX"]); // IGNORE is filtered out well before this point — see pipeline.ts
const VALID_CONFIDENCE = new Set(["high", "medium"]); // "low" is filtered out well before this point — see pipeline.ts
const VALID_SOURCE = new Set(["logic", "test-coverage", "security", "style-maintainability"]);

export class FindingsValidationError extends Error {}

/**
 * The last line of defense before a CI step trusts the bot's own output
 * enough to post it somewhere public. Never assume a reviewer produced
 * well-formed data just because its return type says `Finding[]` —
 * `JSON.parse`d data crossing a process boundary (this runs after
 * `review.cjs` reads the bot's stdout) has no such guarantee. Throws with
 * a specific, actionable reason on the first violation found.
 */
export function validateFindings(value: unknown): asserts value is NormalizedFinding[] {
  if (!Array.isArray(value)) {
    throw new FindingsValidationError(`Expected an array of findings, got ${typeof value}`);
  }

  value.forEach((finding, index) => {
    if (typeof finding !== "object" || finding === null) {
      throw new FindingsValidationError(`Finding[${index}] is not an object`);
    }
    const record = finding as Record<string, unknown>;

    for (const field of REQUIRED_STRING_FIELDS) {
      if (typeof record[field] !== "string" || (record[field] as string).length === 0) {
        throw new FindingsValidationError(`Finding[${index}] is missing required non-empty string field "${field}"`);
      }
    }
    if (!VALID_CATEGORY.has(record.category as string)) throw new FindingsValidationError(`Finding[${index}] has invalid category "${String(record.category)}"`);
    if (!VALID_SEVERITY.has(record.severity as string)) throw new FindingsValidationError(`Finding[${index}] has invalid severity "${String(record.severity)}"`);
    if (!VALID_CONFIDENCE.has(record.confidence as string)) throw new FindingsValidationError(`Finding[${index}] has invalid confidence "${String(record.confidence)}"`);
    if (!VALID_SOURCE.has(record.source as string)) throw new FindingsValidationError(`Finding[${index}] has invalid source "${String(record.source)}"`);
  });
}

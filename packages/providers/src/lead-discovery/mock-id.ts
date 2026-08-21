export interface MockBusinessRef {
  query: string;
  location: string;
  index: number;
}

const PREFIX = "mock:";

/**
 * The mock provider has no backing store, so each business's identity is
 * encoded directly in its id — enough to regenerate the exact same
 * business deterministically in getBusinessDetails().
 */
export function encodeMockId(ref: MockBusinessRef): string {
  const payload = Buffer.from(JSON.stringify(ref), "utf8").toString("base64url");
  return `${PREFIX}${payload}`;
}

export function decodeMockId(id: string): MockBusinessRef | null {
  if (!id.startsWith(PREFIX)) {
    return null;
  }
  try {
    const json = Buffer.from(id.slice(PREFIX.length), "base64url").toString("utf8");
    const parsed = JSON.parse(json) as MockBusinessRef;
    if (
      typeof parsed.query === "string" &&
      typeof parsed.location === "string" &&
      typeof parsed.index === "number"
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

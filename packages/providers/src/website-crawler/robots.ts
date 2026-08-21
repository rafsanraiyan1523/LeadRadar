export interface RobotsRules {
  disallow: string[];
  sitemap: string | null;
}

/**
 * Minimal robots.txt parser: reads the `User-agent: *` group's `Disallow`
 * prefixes and any `Sitemap:` directives. Deliberately simple — full
 * wildcard/`Allow`-precedence semantics aren't needed for a bounded,
 * same-site crawl of a handful of pages.
 */
export function parseRobotsTxt(text: string): RobotsRules {
  const disallow: string[] = [];
  let sitemap: string | null = null;
  let inWildcardGroup = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.split("#")[0]?.trim() ?? "";
    if (!line) continue;

    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) continue;
    const key = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();

    if (key === "user-agent") {
      inWildcardGroup = value === "*";
    } else if (key === "disallow" && inWildcardGroup && value) {
      disallow.push(value);
    } else if (key === "sitemap" && value) {
      sitemap = value;
    }
  }

  return { disallow, sitemap };
}

export function isPathAllowed(pathname: string, disallow: string[]): boolean {
  return !disallow.some((rule) => rule === "/" || pathname.startsWith(rule));
}

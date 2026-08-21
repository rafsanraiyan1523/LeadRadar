interface Fingerprint {
  name: string;
  pattern: RegExp;
}

// Real, checkable string signatures in the raw HTML/script sources — not a
// guess. Deliberately small and conservative rather than an exhaustive
// Wappalyzer-style database.
const FINGERPRINTS: Fingerprint[] = [
  { name: "WordPress", pattern: /wp-content|wp-includes|\/wp-json\// },
  { name: "Shopify", pattern: /cdn\.shopify\.com|Shopify\.theme/ },
  { name: "Wix", pattern: /static\.wixstatic\.com|wix\.com\/website/ },
  { name: "Squarespace", pattern: /squarespace\.com|static1\.squarespace/ },
  { name: "Webflow", pattern: /webflow\.com|\.webflow\.io/ },
  { name: "Google Analytics", pattern: /googletagmanager\.com|google-analytics\.com/ },
  { name: "Google Maps Embed", pattern: /maps\.googleapis\.com|maps\.google\.com\/maps\/embed/ },
];

export function detectTechnologies(html: string): string[] {
  const found = new Set<string>();
  for (const { name, pattern } of FINGERPRINTS) {
    if (pattern.test(html)) found.add(name);
  }
  return Array.from(found);
}

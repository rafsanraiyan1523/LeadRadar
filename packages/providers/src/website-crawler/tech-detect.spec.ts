import { describe, expect, it } from "vitest";
import { detectTechnologies } from "./tech-detect";

describe("detectTechnologies", () => {
  it("detects WordPress from wp-content references", () => {
    const html = `<html><body><img src="/wp-content/uploads/logo.png" /></body></html>`;
    expect(detectTechnologies(html)).toContain("WordPress");
  });

  it("detects Shopify from its CDN reference", () => {
    const html = `<html><head><script src="https://cdn.shopify.com/s/files/theme.js"></script></head></html>`;
    expect(detectTechnologies(html)).toContain("Shopify");
  });

  it("returns an empty list rather than guessing when nothing matches", () => {
    const html = `<html><body><h1>Plain static page</h1></body></html>`;
    expect(detectTechnologies(html)).toEqual([]);
  });

  it("can detect multiple technologies on the same page", () => {
    const html = `<html><head>
      <script src="https://www.googletagmanager.com/gtag.js"></script>
    </head><body><img src="/wp-content/uploads/photo.jpg" /></body></html>`;
    const detected = detectTechnologies(html);
    expect(detected).toContain("WordPress");
    expect(detected).toContain("Google Analytics");
  });
});

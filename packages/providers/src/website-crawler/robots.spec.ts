import { describe, expect, it } from "vitest";
import { isPathAllowed, parseRobotsTxt } from "./robots";

describe("parseRobotsTxt", () => {
  it("reads Disallow rules from the User-agent: * group", () => {
    const text = ["User-agent: *", "Disallow: /admin", "Disallow: /private", "", "Sitemap: https://example.test/sitemap.xml"].join(
      "\n",
    );
    const rules = parseRobotsTxt(text);
    expect(rules.disallow).toEqual(["/admin", "/private"]);
    expect(rules.sitemap).toBe("https://example.test/sitemap.xml");
  });

  it("ignores rules scoped to a different user-agent", () => {
    const text = ["User-agent: SomeOtherBot", "Disallow: /", "", "User-agent: *", "Disallow: /checkout"].join("\n");
    const rules = parseRobotsTxt(text);
    expect(rules.disallow).toEqual(["/checkout"]);
  });

  it("returns no rules for an empty or garbage file", () => {
    expect(parseRobotsTxt("").disallow).toEqual([]);
    expect(parseRobotsTxt("not a valid robots file at all").disallow).toEqual([]);
  });

  it("ignores comments", () => {
    const text = ["# this is a comment", "User-agent: *", "Disallow: /secret # inline comment"].join("\n");
    const rules = parseRobotsTxt(text);
    expect(rules.disallow).toEqual(["/secret"]);
  });
});

describe("isPathAllowed", () => {
  it("allows any path when there are no disallow rules", () => {
    expect(isPathAllowed("/anything", [])).toBe(true);
  });

  it("disallows an exact prefix match", () => {
    expect(isPathAllowed("/admin/dashboard", ["/admin"])).toBe(false);
  });

  it("allows a path that doesn't match any disallow prefix", () => {
    expect(isPathAllowed("/contact", ["/admin"])).toBe(true);
  });

  it("treats a bare 'Disallow: /' as disallowing everything", () => {
    expect(isPathAllowed("/contact", ["/"])).toBe(false);
  });
});

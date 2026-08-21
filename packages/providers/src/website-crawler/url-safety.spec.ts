import { describe, expect, it } from "vitest";
import {
  createSafeLookup,
  isBlockedHostnameString,
  isPrivateOrReservedIPv4,
  isPrivateOrReservedIPv6,
} from "./url-safety";

describe("isBlockedHostnameString", () => {
  it.each(["localhost", "LOCALHOST", "printer.local", "db.internal", "host.localhost"])(
    "blocks %s",
    (hostname) => {
      expect(isBlockedHostnameString(hostname)).toBe(true);
    },
  );

  it.each(["example.com", "leadradar.example", "sub.example.com"])("allows %s", (hostname) => {
    expect(isBlockedHostnameString(hostname)).toBe(false);
  });
});

describe("isPrivateOrReservedIPv4", () => {
  it.each([
    ["127.0.0.1", "loopback"],
    ["10.0.0.1", "RFC1918 10/8"],
    ["172.16.0.1", "RFC1918 172.16/12"],
    ["172.31.255.255", "RFC1918 172.16/12 upper bound"],
    ["192.168.1.1", "RFC1918 192.168/16"],
    ["169.254.169.254", "cloud metadata endpoint"],
    ["169.254.0.1", "link-local"],
    ["100.64.0.1", "CGNAT"],
    ["0.0.0.0", "this network"],
    ["224.0.0.1", "multicast"],
    ["255.255.255.255", "broadcast"],
  ])("blocks %s (%s)", (ip) => {
    expect(isPrivateOrReservedIPv4(ip)).toBe(true);
  });

  it.each([
    ["8.8.8.8", "public DNS"],
    ["1.1.1.1", "public DNS"],
    ["93.184.216.34", "example.com's real address"],
    ["172.15.255.255", "just below the RFC1918 172.16/12 range"],
    ["172.32.0.0", "just above the RFC1918 172.16/12 range"],
  ])("allows %s (%s)", (ip) => {
    expect(isPrivateOrReservedIPv4(ip)).toBe(false);
  });
});

describe("isPrivateOrReservedIPv6", () => {
  it.each([
    ["::1", "loopback"],
    ["::", "unspecified"],
    ["fc00::1", "unique local (ULA)"],
    ["fd12:3456::1", "unique local (ULA)"],
    ["fe80::1", "link-local"],
    ["::ffff:127.0.0.1", "IPv4-mapped loopback"],
    ["::ffff:10.0.0.1", "IPv4-mapped RFC1918"],
  ])("blocks %s (%s)", (ip) => {
    expect(isPrivateOrReservedIPv6(ip)).toBe(true);
  });

  it.each([
    ["2001:4860:4860::8888", "public (Google DNS)"],
    ["::ffff:8.8.8.8", "IPv4-mapped public"],
  ])("allows %s (%s)", (ip) => {
    expect(isPrivateOrReservedIPv6(ip)).toBe(false);
  });
});

describe("createSafeLookup", () => {
  it("rejects a private address", async () => {
    const lookup = createSafeLookup({ maxConnections: 4 });
    const err = await new Promise<Error | null>((resolve) => {
      lookup("127.0.0.1", {}, (e) => resolve(e as Error | null));
    });
    expect(err).toBeInstanceOf(Error);
    expect(err?.message).toMatch(/blocked/i);
  });

  it("rejects a blocked hostname string before any DNS work", async () => {
    const lookup = createSafeLookup({ maxConnections: 4 });
    const err = await new Promise<Error | null>((resolve) => {
      lookup("localhost", {}, (e) => resolve(e as Error | null));
    });
    expect(err).toBeInstanceOf(Error);
    expect(err?.message).toMatch(/blocked/i);
  });

  it("resolves a public IP literal without a real DNS query", async () => {
    const lookup = createSafeLookup({ maxConnections: 4 });
    const [err, address] = await new Promise<[Error | null, unknown]>((resolve) => {
      lookup("8.8.8.8", {}, (e, a) => resolve([e, a]));
    });
    expect(err).toBeNull();
    expect(address).toBe("8.8.8.8");
  });

  it("caps the number of connections it will validate (redirect limit)", async () => {
    const lookup = createSafeLookup({ maxConnections: 2 });
    const attempt = () =>
      new Promise<Error | null>((resolve) => {
        lookup("8.8.8.8", {}, (e) => resolve(e as Error | null));
      });

    expect(await attempt()).toBeNull();
    expect(await attempt()).toBeNull();
    const third = await attempt();
    expect(third).toBeInstanceOf(Error);
    expect(third?.message).toMatch(/too many connections/i);
  });
});

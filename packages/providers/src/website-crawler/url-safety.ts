import { lookup as dnsLookup } from "node:dns";
import type { LookupAddress, LookupAllOptions, LookupOneOptions } from "node:dns";
import { isIP } from "node:net";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "ip6-localhost",
  "ip6-loopback",
]);
const BLOCKED_HOSTNAME_SUFFIXES = [".local", ".internal", ".localhost"];

/** String-only pre-check — cheap, and gives a clear reason before any DNS/socket work happens. */
export function isBlockedHostnameString(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(lower)) return true;
  return BLOCKED_HOSTNAME_SUFFIXES.some((suffix) => lower.endsWith(suffix));
}

export function isPrivateOrReservedIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) {
    return true; // malformed — fail closed
  }
  const a = parts[0]!;
  const b = parts[1]!;
  const c = parts[2]!;
  if (a === 0) return true; // "this" network
  if (a === 10) return true; // RFC1918
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata 169.254.169.254
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
  if (a === 192 && b === 168) return true; // RFC1918
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true; // IETF protocol assignments / TEST-NET-1
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a === 198 && b === 51 && c === 100) return true; // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true; // TEST-NET-3
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT (RFC6598)
  if (a >= 224) return true; // multicast (224+) + reserved (240+) + broadcast
  return false;
}

export function isPrivateOrReservedIPv6(ip: string): boolean {
  const norm = ip.toLowerCase().replace(/^\[|\]$/g, "").replace(/%.*$/, "");
  if (norm === "::1" || norm === "::") return true; // loopback / unspecified
  if (norm.startsWith("::ffff:")) {
    const embedded = norm.slice("::ffff:".length);
    if (/^\d+\.\d+\.\d+\.\d+$/.test(embedded)) return isPrivateOrReservedIPv4(embedded);
  }
  const firstHextet = norm.split(":")[0] ?? "";
  if (/^f[cd][0-9a-f]{0,2}$/.test(firstHextet)) return true; // fc00::/7 (ULA)
  if (/^fe[89ab][0-9a-f]?$/.test(firstHextet)) return true; // fe80::/10 (link-local)
  return false;
}

export function isPrivateOrReservedAddress(address: string, family: 4 | 6): boolean {
  return family === 6 ? isPrivateOrReservedIPv6(address) : isPrivateOrReservedIPv4(address);
}

/**
 * Combined synchronous pre-check: blocked hostname strings AND IP-literal
 * hosts (`http://127.0.0.1/`, `http://169.254.169.254/`, ...). This must run
 * *before* a connection is attempted, not just rely on `createSafeLookup` —
 * Node's connector skips calling a custom `dns.lookup` entirely when the
 * host is already a numeric IP address (there's nothing to resolve), so an
 * IP-literal URL would otherwise sail straight past the lookup-based guard
 * and connect for real. Hostnames that aren't literals and aren't on the
 * blocklist fall through to `createSafeLookup`'s DNS-time check.
 */
export function isBlockedHostname(hostname: string): boolean {
  if (isBlockedHostnameString(hostname)) return true;
  const family = isIP(hostname);
  if (family === 4) return isPrivateOrReservedIPv4(hostname);
  if (family === 6) return isPrivateOrReservedIPv6(hostname);
  return false;
}

type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address: string | LookupAddress[],
  family?: number,
) => void;

export interface SafeLookupOptions {
  /**
   * Caps the number of distinct connections (the initial request plus any
   * cross-origin redirects — same-origin redirects reuse the pooled
   * connection and don't call `lookup` again) this lookup instance will
   * permit before refusing further ones. This is what enforces "limit
   * redirects" for the crawler: a redirect chain that keeps changing origin
   * needs a fresh connection — and therefore a fresh `lookup` call — every
   * hop.
   */
  maxConnections: number;
}

/**
 * Builds a `dns.lookup`-compatible function for undici's `Agent({ connect:
 * { lookup } })`. Validating the address here — right before the socket
 * actually connects to it — is what makes this effective against both a
 * private-IP-literal URL (`http://169.254.169.254/`) and DNS rebinding (a
 * hostname that resolves to a public address on an earlier lookup but a
 * private one at connect time): there is no earlier, separately-timed
 * lookup for an attacker to race, because this *is* the lookup the
 * connection is made from.
 */
export function createSafeLookup(options: SafeLookupOptions) {
  let connections = 0;

  return function safeLookup(
    hostname: string,
    optionsOrCallback: LookupOneOptions | LookupAllOptions | LookupCallback,
    maybeCallback?: LookupCallback,
  ): void {
    const callback = (typeof optionsOrCallback === "function" ? optionsOrCallback : maybeCallback)!;
    const lookupOptions: LookupOneOptions | LookupAllOptions =
      typeof optionsOrCallback === "function" ? {} : optionsOrCallback;

    connections += 1;
    if (connections > options.maxConnections) {
      callback(new Error(`Blocked: too many connections/redirects (max ${options.maxConnections})`), "");
      return;
    }
    if (isBlockedHostnameString(hostname)) {
      callback(new Error(`Blocked host: ${hostname}`), "");
      return;
    }

    dnsLookup(hostname, { all: true }, (err, addresses) => {
      if (err) {
        callback(err, "");
        return;
      }
      if (addresses.length === 0) {
        callback(new Error(`Blocked: no addresses resolved for host: ${hostname}`), "");
        return;
      }
      const blocked = addresses.find((a) => isPrivateOrReservedAddress(a.address, a.family === 6 ? 6 : 4));
      if (blocked) {
        callback(
          new Error(`Blocked host: ${hostname} resolves to a private/internal address (${blocked.address})`),
          "",
        );
        return;
      }
      const first = addresses[0]!;
      if ("all" in lookupOptions && lookupOptions.all) {
        callback(null, addresses);
      } else {
        callback(null, first.address, first.family);
      }
    });
  };
}

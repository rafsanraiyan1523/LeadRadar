import { Agent, fetch as undiciFetch } from "undici";
import type { Response as UndiciResponse } from "undici";
import { createSafeLookup, isBlockedHostname } from "./url-safety";

export interface FetchLimitsConfig {
  timeoutMs: number;
  maxResponseBytes: number;
  userAgent?: string;
  /** Caps the number of distinct connections a single call may make (initial + cross-origin redirects). Default 4 (1 initial + up to 3 redirects). */
  maxRedirects?: number;
}

export interface FetchTextResult {
  ok: boolean;
  status: number;
  finalUrl: string;
  contentType: string;
  text: string;
  error?: string;
  /** Wall-clock time for the request, from dispatch to fully-read body (or failure). A LeadRadar check, not a Lighthouse metric. */
  durationMs: number;
  /** Bytes actually read (bounded by maxResponseBytes) — 0 whenever the request failed before any body was read. */
  bytes: number;
}

const DEFAULT_USER_AGENT = "LeadRadarBot/1.0 (+https://leadradar.example/bot)";
const DEFAULT_MAX_REDIRECTS = 3;

function failResult(finalUrl: string, error: string, startedAt: number, status = 0): FetchTextResult {
  return { ok: false, status, finalUrl, contentType: "", text: "", error, durationMs: Date.now() - startedAt, bytes: 0 };
}

/**
 * A single controlled fetch: enforces a request timeout, a maximum response
 * size (aborting the stream early rather than buffering an unbounded body),
 * and — this is the SSRF boundary for the whole website-crawler feature —
 * blocks connections to localhost/private/link-local/reserved addresses.
 * That check runs via a custom `dns.lookup` wired into a per-call undici
 * `Agent`, so it applies at the moment each socket actually connects: the
 * initial request AND every redirect hop (each new origin needs a new
 * connection, hence a new `lookup` call), which is what closes both the
 * IP-literal case and DNS-rebinding (see url-safety.ts). Must use undici's
 * own `fetch`/`Agent` here, not the global `fetch` — Node's global fetch is
 * bound to its own internally-bundled undici build and silently ignores (or
 * errors on) a `dispatcher` constructed from a separately-installed undici
 * package version.
 */
export async function fetchWithLimits(url: string, config: FetchLimitsConfig): Promise<FetchTextResult> {
  const startedAt = Date.now();
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return failResult(url, "Invalid URL", startedAt);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return failResult(url, `Unsupported protocol: ${parsed.protocol}`, startedAt);
  }
  if (isBlockedHostname(parsed.hostname)) {
    return failResult(url, `Blocked host: ${parsed.hostname}`, startedAt);
  }

  const maxConnections = (config.maxRedirects ?? DEFAULT_MAX_REDIRECTS) + 1;
  const agent = new Agent({ connect: { lookup: createSafeLookup({ maxConnections }) } });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await undiciFetch(parsed.toString(), {
      signal: controller.signal,
      redirect: "follow",
      dispatcher: agent,
      headers: { "User-Agent": config.userAgent ?? DEFAULT_USER_AGENT },
    });

    const contentType = response.headers.get("content-type") ?? "";

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        finalUrl: response.url || parsed.toString(),
        contentType,
        text: "",
        error: `HTTP ${response.status}`,
        durationMs: Date.now() - startedAt,
        bytes: 0,
      };
    }

    const { text, bytes } = await readBounded(response, config.maxResponseBytes);

    return {
      ok: true,
      status: response.status,
      finalUrl: response.url || parsed.toString(),
      contentType,
      text,
      durationMs: Date.now() - startedAt,
      bytes,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return failResult(parsed.toString(), `Request timed out after ${config.timeoutMs}ms`, startedAt);
    }
    // undici wraps connector/lookup errors (incl. our SSRF block) in a
    // generic "fetch failed" with the real reason on `.cause` — surface the
    // useful message rather than the wrapper.
    const cause = error instanceof Error && "cause" in error ? (error.cause as unknown) : undefined;
    const message =
      cause instanceof Error ? cause.message : error instanceof Error ? error.message : "Unknown fetch error";
    return failResult(parsed.toString(), message, startedAt);
  } finally {
    clearTimeout(timeout);
    void agent.close().catch(() => undefined);
  }
}

async function readBounded(response: UndiciResponse, maxBytes: number): Promise<{ text: string; bytes: number }> {
  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    const bytes = new TextEncoder().encode(text).byteLength;
    return text.length > maxBytes ? { text: text.slice(0, maxBytes), bytes } : { text, bytes };
  }

  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let bytesRead = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytesRead += value.byteLength;
    chunks.push(decoder.decode(value, { stream: true }));
    if (bytesRead >= maxBytes) {
      await reader.cancel().catch(() => undefined);
      break;
    }
  }
  chunks.push(decoder.decode());
  return { text: chunks.join(""), bytes: bytesRead };
}

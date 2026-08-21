"use client";

import { ApiError, type StructuredApiError } from "./api-error";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** For the rare case a request must be a plain browser navigation (e.g. a CSV download, so Content-Disposition triggers a native download) rather than a fetch(). */
export const API_BASE_URL = API_URL;

export interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

/**
 * Client-side fetch against the API. The browser attaches the httpOnly
 * session cookies automatically (credentials: "include") — no token is
 * ever read or stored in JS. See docs/architecture.md for the cookie
 * cross-origin/cross-subdomain reasoning.
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const contentType = res.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json") ? await res.json() : undefined;

  if (!res.ok) {
    throw new ApiError(res.status, payload as StructuredApiError | undefined);
  }

  return payload as T;
}

import { cookies } from "next/headers";
import { ApiError, type StructuredApiError } from "./api-error";

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Server-side fetch against the API for use in Server Components / route
 * handlers. Server-side `fetch` has no browser attached, so the incoming
 * request's cookies must be forwarded explicitly on the `Cookie` header.
 */
export async function serverApiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      ...init.headers,
      Cookie: cookieHeader,
    },
  });

  const contentType = res.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json") ? await res.json() : undefined;

  if (!res.ok) {
    throw new ApiError(res.status, payload as StructuredApiError | undefined);
  }

  return payload as T;
}

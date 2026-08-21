"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { PaginatedAuditLog } from "@/lib/audit-log-types";

export function useOrgAuditLog(page: number, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["audit-logs", "org", page],
    queryFn: () => apiFetch<PaginatedAuditLog>(`/audit-logs?page=${page}&pageSize=20`),
    enabled: options.enabled ?? true,
  });
}

export function useMyAuditLog(page: number) {
  return useQuery({
    queryKey: ["audit-logs", "me", page],
    queryFn: () => apiFetch<PaginatedAuditLog>(`/auth/audit-log?page=${page}&pageSize=20`),
  });
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { AnalyticsFilters, AnalyticsResponse, DashboardResponse } from "@/lib/analytics-types";

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiFetch<DashboardResponse>("/dashboard"),
  });
}

function toQueryString(filters: AnalyticsFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function useAnalytics(filters: AnalyticsFilters) {
  return useQuery({
    queryKey: ["analytics", filters],
    queryFn: () => apiFetch<AnalyticsResponse>(`/analytics${toQueryString(filters)}`),
  });
}

export { toQueryString as analyticsQueryString };

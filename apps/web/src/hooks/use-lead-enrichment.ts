"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { EnrichLeadResponse, LeadEnrichment } from "@/lib/lead-enrichment-types";

const enrichmentKey = (leadId: string) => ["leads", leadId, "enrichment"] as const;

const ACTIVE_STATUSES = new Set(["PENDING", "RUNNING"]);

export function useLeadEnrichment(leadId: string | null) {
  return useQuery({
    queryKey: leadId ? enrichmentKey(leadId) : ["leads", "none", "enrichment"],
    queryFn: () => apiFetch<LeadEnrichment>(`/leads/${leadId}/enrichment`),
    enabled: !!leadId,
    refetchInterval: (query) => {
      const status = query.state.data?.enrichment.status;
      return status && ACTIVE_STATUSES.has(status) ? 1500 : false;
    },
  });
}

export function useEnrichLead(leadId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<EnrichLeadResponse>(`/leads/${leadId}/enrich`, { method: "POST" }),
    onSuccess: () => {
      if (leadId) void queryClient.invalidateQueries({ queryKey: enrichmentKey(leadId) });
    },
  });
}

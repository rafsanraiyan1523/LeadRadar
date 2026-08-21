"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { LeadAuditResponse } from "@/lib/digital-intelligence-types";

const auditKey = (leadId: string) => ["leads", leadId, "audit"] as const;

const ACTIVE_STATUSES = new Set(["PENDING", "RUNNING"]);

export function useLeadAudit(leadId: string | null) {
  return useQuery({
    queryKey: leadId ? auditKey(leadId) : ["leads", "none", "audit"],
    queryFn: () => apiFetch<LeadAuditResponse>(`/leads/${leadId}/audit`),
    enabled: !!leadId,
    refetchInterval: (query) => {
      const status = query.state.data?.lead.enrichmentStatus;
      return status && ACTIVE_STATUSES.has(status) ? 1500 : false;
    },
  });
}

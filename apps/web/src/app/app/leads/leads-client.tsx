"use client";

import { useState } from "react";
import { LeadListView } from "@/components/leads/lead-list-view";
import { useLeadsList } from "@/hooks/use-crm";
import type { ListLeadsFilters } from "@/lib/crm-types";

export function LeadsClient() {
  const [filters, setFilters] = useState<ListLeadsFilters>({ page: 1, pageSize: 20 });
  const query = useLeadsList(filters);

  return (
    <LeadListView
      title="Leads"
      description="Every lead in your organization's CRM."
      emptyMessage="No leads match your filters yet — save some from Find to get started."
      query={query}
      filters={filters}
      onFiltersChange={setFilters}
      showExport
    />
  );
}

"use client";

import { useState } from "react";
import { LeadListView } from "@/components/leads/lead-list-view";
import { useSavedLeads } from "@/hooks/use-crm";
import type { ListLeadsFilters } from "@/lib/crm-types";

export function SavedClient() {
  const [filters, setFilters] = useState<ListLeadsFilters>({ page: 1, pageSize: 20 });
  const query = useSavedLeads(filters);

  return (
    <LeadListView
      title="Saved leads"
      description="Leads you've personally bookmarked."
      emptyMessage="You haven't saved any leads yet — bookmark one from the pipeline or leads list."
      query={query}
      filters={filters}
      onFiltersChange={setFilters}
      bookmarked
    />
  );
}

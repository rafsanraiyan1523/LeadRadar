"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useLeadsList } from "@/hooks/use-crm";
import type { ListLeadsFilters } from "@/lib/crm-types";

export function CampaignLeadPicker({
  category,
  location,
  selected,
  onToggle,
}: {
  category?: string;
  location?: string;
  selected: Set<string>;
  onToggle: (leadId: string) => void;
}) {
  const filters: ListLeadsFilters = {
    page: 1,
    pageSize: 50,
    category: category || undefined,
    location: location || undefined,
  };
  const { data, isLoading } = useLeadsList(filters);
  const leads = data?.items ?? [];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label>Select leads</Label>
        <span className="text-xs text-muted-foreground">{selected.size} selected</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Showing leads matching the target category/location above — leave those blank to see
        every lead.
      </p>
      <div className="flex max-h-64 flex-col gap-1 overflow-y-auto rounded-lg border border-border p-2">
        {isLoading ? (
          <p className="p-2 text-sm text-muted-foreground">Loading leads…</p>
        ) : leads.length === 0 ? (
          <p className="p-2 text-sm text-muted-foreground">No leads match yet.</p>
        ) : (
          leads.map((lead) => (
            <label
              key={lead.id}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60"
            >
              <Checkbox
                checked={selected.has(lead.id)}
                onCheckedChange={() => onToggle(lead.id)}
              />
              <span className="min-w-0 flex-1 truncate">{lead.businessName}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {lead.category ?? "—"} · {lead.opportunityScore ?? "—"}
              </span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}

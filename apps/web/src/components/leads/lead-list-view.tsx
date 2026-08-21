"use client";

import { useState } from "react";
import { AlertTriangle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LeadCardContent } from "./lead-card-content";
import { LeadDetailSheet } from "./lead-detail-sheet";
import { LeadsFilterBar } from "./leads-filter-bar";
import { toQueryString } from "@/hooks/use-crm";
import { API_BASE_URL } from "@/lib/api-client";
import type { PaginatedLeadCards, ListLeadsFilters, LeadCardView } from "@/lib/crm-types";
import type { UseQueryResult } from "@tanstack/react-query";

export function LeadListView({
  title,
  description,
  emptyMessage,
  query,
  filters,
  onFiltersChange,
  bookmarked,
  showExport,
}: {
  title: string;
  description: string;
  emptyMessage: string;
  query: UseQueryResult<PaginatedLeadCards>;
  filters: ListLeadsFilters;
  onFiltersChange: (filters: ListLeadsFilters) => void;
  bookmarked?: boolean;
  showExport?: boolean;
}) {
  const [openLead, setOpenLead] = useState<LeadCardView | null>(null);
  const { data, isLoading, isError } = query;
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;

  function patchFilters(patch: Partial<ListLeadsFilters>) {
    onFiltersChange({ ...filters, ...patch, page: 1 });
  }

  function reset() {
    onFiltersChange({ page: 1, pageSize });
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          {showExport && (
            <Button variant="outline" size="sm" asChild>
              <a href={`${API_BASE_URL}/leads/export${toQueryString(filters)}`}>
                <Download className="size-3.5" />
                Export CSV
              </a>
            </Button>
          )}
        </div>
        <LeadsFilterBar filters={filters} onChange={patchFilters} onReset={reset} />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : isError || !data ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <AlertTriangle className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Couldn&apos;t load leads. Try refreshing.</p>
          </div>
        ) : data.items.length === 0 ? (
          <p className="py-24 text-center text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <>
            <p className="pb-3 text-sm text-muted-foreground">{data.total} leads</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {data.items.map((lead) => (
                <button
                  key={lead.id}
                  type="button"
                  onClick={() => setOpenLead(lead)}
                  className="rounded-xl border border-border bg-card p-3 text-left shadow-xs transition-shadow hover:shadow-sm"
                >
                  <LeadCardContent lead={lead} />
                </button>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 pt-6">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => onFiltersChange({ ...filters, page: page - 1 })}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => onFiltersChange({ ...filters, page: page + 1 })}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <LeadDetailSheet
        lead={openLead}
        open={!!openLead}
        onOpenChange={(open) => !open && setOpenLead(null)}
        bookmarked={bookmarked}
      />
    </div>
  );
}

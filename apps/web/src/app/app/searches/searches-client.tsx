"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, MapPin, Search as SearchIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSearchesPage } from "@/hooks/use-lead-discovery";
import type { Search } from "@/lib/lead-discovery-types";

const STATUS_VARIANT: Record<Search["status"], "default" | "secondary" | "destructive" | "outline"> = {
  COMPLETED: "secondary",
  RUNNING: "default",
  PENDING: "outline",
  FAILED: "destructive",
};

function filterSummary(filters: Search["filters"]): string[] {
  if (!filters) return [];
  const chips: string[] = [];
  if (filters.minRating) chips.push(`${filters.minRating}+ rating`);
  if (filters.minReviews) chips.push(`${filters.minReviews}+ reviews`);
  if (filters.website && filters.website !== "ANY") chips.push(filters.website.replace("_", " ").toLowerCase());
  if (filters.googlePresence && filters.googlePresence !== "ANY") chips.push(filters.googlePresence.toLowerCase());
  if (filters.opportunity && filters.opportunity !== "ANY") chips.push(`${filters.opportunity.toLowerCase()} opportunity`);
  for (const extra of filters.additional ?? []) chips.push(extra.replace(/_/g, " ").toLowerCase());
  return chips;
}

export function SearchesClient() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useSearchesPage(page, 20);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-1 border-b border-border px-4 py-4 sm:px-6">
        <h1 className="text-xl font-semibold tracking-tight">Search history</h1>
        <p className="text-sm text-muted-foreground">Every search you&apos;ve run, with its filters and results.</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        {isLoading ? (
          <div className="flex flex-col gap-2.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : isError || !data ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <AlertTriangle className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Couldn&apos;t load your search history.</p>
          </div>
        ) : data.items.length === 0 ? (
          <p className="py-24 text-center text-sm text-muted-foreground">
            No searches yet — run one from Find.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-2.5">
              {data.items.map((search) => (
                <div
                  key={search.id}
                  className="flex flex-col gap-2 rounded-lg border border-border p-3.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex items-center gap-1.5 font-medium">
                        <SearchIcon className="size-3.5 text-muted-foreground" />
                        {search.query}
                      </span>
                      <Badge variant={STATUS_VARIANT[search.status]}>{search.status.toLowerCase()}</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      {search.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="size-3" />
                          {search.location}
                        </span>
                      )}
                      <span>{new Date(search.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}</span>
                      <span>{search.resultCount} result{search.resultCount === 1 ? "" : "s"}</span>
                    </div>
                    {filterSummary(search.filters).length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {filterSummary(search.filters).map((chip) => (
                          <Badge key={chip} variant="outline" className="text-xs">
                            {chip}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1.5 self-start sm:self-center"
                    onClick={() => router.push(`/app/find?searchId=${search.id}`)}
                  >
                    View results
                    <ArrowRight className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 pt-6">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

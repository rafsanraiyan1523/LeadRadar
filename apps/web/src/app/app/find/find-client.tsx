"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { SearchForm } from "@/components/find/search-form";
import { FiltersBar } from "@/components/find/filters-bar";
import { SearchProgress } from "@/components/find/search-progress";
import { SearchHistoryMenu } from "@/components/find/search-history-menu";
import { ResultCard } from "@/components/find/result-card";
import { ResultDetailSheet } from "@/components/find/result-detail-sheet";
import { BulkActionsBar } from "@/components/find/bulk-actions-bar";
import { MapPanel } from "@/components/find/map-panel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCreateSearch,
  useSearch,
  useSearchResultsInfinite,
  useBulkSaveResults,
} from "@/hooks/use-lead-discovery";
import { useFindStore } from "@/stores/find-store";
import { toApiFilters, useFindFiltersStore } from "@/stores/find-filters-store";
import { applyClientFilters } from "@/lib/apply-filters";
import type { SearchResult } from "@/lib/lead-discovery-types";
import { ApiError } from "@/lib/api-error";

export function FindClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchIdFromUrl = searchParams.get("searchId");

  const [activeSearchId, setActiveSearchId] = useState<string | null>(searchIdFromUrl);
  const [sortBy, setSortBy] = useState<"rating" | "reviewCount" | "businessName" | "createdAt">(
    "rating",
  );
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [viewingResult, setViewingResult] = useState<SearchResult | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const { filters } = useFindFiltersStore();
  const {
    selectedResultId,
    hoveredResultId,
    selectedResultIds,
    setSelectedResult,
    setHoveredResult,
    toggleResultChecked,
    clearChecked,
  } = useFindStore();

  const createSearch = useCreateSearch();
  const bulkSave = useBulkSaveResults();
  const { data: search } = useSearch(activeSearchId);

  const isSearchActive = search?.status === "PENDING" || search?.status === "RUNNING";
  const isCompleted = search?.status === "COMPLETED";

  const resultsQuery = useSearchResultsInfinite(
    activeSearchId,
    {
      sortBy,
      order,
      minRating: filters.minRating > 0 ? filters.minRating : undefined,
      hasWebsite:
        filters.website === "ANY"
          ? undefined
          : filters.website === "HAS_WEBSITE"
            ? "true"
            : "false",
    },
    isCompleted,
  );

  const fetchedResults = useMemo(
    () => resultsQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [resultsQuery.data],
  );
  const total = resultsQuery.data?.pages[0]?.total ?? 0;
  const filteredResults = useMemo(
    () => applyClientFilters(fetchedResults, filters),
    [fetchedResults, filters],
  );

  const handleSubmitSearch = async (input: {
    query: string;
    location: string;
    radiusMeters?: number;
  }) => {
    try {
      const created = await createSearch.mutateAsync({ ...input, filters: toApiFilters(filters) });
      setActiveSearchId(created.id);
      setSavedIds(new Set());
      clearChecked();
      router.replace(`/app/find?searchId=${created.id}`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't start the search");
    }
  };

  const handleOpenHistorySearch = (searchId: string) => {
    setActiveSearchId(searchId);
    router.replace(`/app/find?searchId=${searchId}`);
  };

  const handleSaveOne = async (resultId: string) => {
    try {
      await bulkSave.mutateAsync([resultId]);
      setSavedIds((prev) => new Set(prev).add(resultId));
      toast.success("Lead saved");
    } catch {
      toast.error("Couldn't save this lead");
    }
  };

  const handleBulkSave = async () => {
    const ids = Array.from(selectedResultIds);
    try {
      await bulkSave.mutateAsync(ids);
      setSavedIds((prev) => new Set([...prev, ...ids]));
      toast.success(`Saved ${ids.length} lead${ids.length === 1 ? "" : "s"}`);
      clearChecked();
    } catch {
      toast.error("Couldn't save the selected leads");
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:px-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">Find your next client.</h1>
          <SearchHistoryMenu onOpenSearch={handleOpenHistorySearch} />
        </div>
        <SearchForm
          onSubmit={handleSubmitSearch}
          isSubmitting={createSearch.isPending || isSearchActive}
          defaultQuery={search?.query}
          defaultLocation={search?.location ?? undefined}
        />
        {isCompleted && <FiltersBar />}
      </div>

      {!activeSearchId && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-muted-foreground">
          <p>Search a business type and a location to get started.</p>
          <p className="text-sm">Try &ldquo;Dental Clinic&rdquo; in &ldquo;Banani, Dhaka&rdquo;.</p>
        </div>
      )}

      {activeSearchId && isSearchActive && search && <SearchProgress search={search} />}

      {activeSearchId && search?.status === "FAILED" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <p className="font-medium text-destructive">This search failed</p>
          <p className="max-w-sm text-sm text-muted-foreground">{search.errorMessage}</p>
        </div>
      )}

      {isCompleted && (
        <div className="flex flex-1 flex-col gap-3 overflow-hidden px-4 py-4 sm:px-6 md:flex-row">
          <div className="flex min-w-0 flex-1 flex-col gap-3 md:max-w-md">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {filteredResults.length} of {total} results
              </p>
              <Select
                value={`${sortBy}:${order}`}
                onValueChange={(v) => {
                  const [nextSort, nextOrder] = v.split(":") as [typeof sortBy, typeof order];
                  setSortBy(nextSort);
                  setOrder(nextOrder);
                }}
              >
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rating:desc">Highest rated</SelectItem>
                  <SelectItem value="reviewCount:desc">Most reviews</SelectItem>
                  <SelectItem value="businessName:asc">Name (A–Z)</SelectItem>
                  <SelectItem value="createdAt:desc">Newest</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <BulkActionsBar
              count={selectedResultIds.size}
              onClear={clearChecked}
              onSave={handleBulkSave}
              isSaving={bulkSave.isPending}
            />

            <div className="flex-1 space-y-2.5 overflow-y-auto pb-4">
              {resultsQuery.isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-32 w-full rounded-md" />
                ))
              ) : filteredResults.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  No results match your filters yet.
                </p>
              ) : (
                filteredResults.map((result) => (
                  <ResultCard
                    key={result.id}
                    result={result}
                    selected={result.id === selectedResultId}
                    checked={selectedResultIds.has(result.id)}
                    saved={savedIds.has(result.id) || !!result.promotedToLeadId}
                    onSelect={() => setSelectedResult(result.id)}
                    onHover={(hovering) => setHoveredResult(hovering ? result.id : null)}
                    onToggleChecked={() => toggleResultChecked(result.id)}
                    onSave={() => handleSaveOne(result.id)}
                    onView={() => setViewingResult(result)}
                  />
                ))
              )}

              {resultsQuery.hasNextPage && (
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={resultsQuery.isFetchingNextPage}
                  onClick={() => resultsQuery.fetchNextPage()}
                >
                  {resultsQuery.isFetchingNextPage ? "Loading…" : "Load more"}
                </Button>
              )}
            </div>
          </div>

          <div className="hidden min-h-[400px] flex-1 md:block">
            <MapPanel
              results={filteredResults}
              selectedId={selectedResultId}
              hoveredId={hoveredResultId}
              onSelect={setSelectedResult}
              onHover={setHoveredResult}
            />
          </div>
        </div>
      )}

      <ResultDetailSheet
        result={viewingResult}
        open={!!viewingResult}
        onOpenChange={(open) => !open && setViewingResult(null)}
        saved={
          !!viewingResult && (savedIds.has(viewingResult.id) || !!viewingResult.promotedToLeadId)
        }
        onSave={() => viewingResult && handleSaveOne(viewingResult.id)}
      />
    </div>
  );
}

"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type {
  CreateSearchInput,
  Paginated,
  Search,
  SearchResult,
} from "@/lib/lead-discovery-types";

const SEARCH_HISTORY_KEY = ["searches"] as const;
const searchKey = (id: string) => ["searches", id] as const;

export function useCreateSearch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSearchInput) =>
      apiFetch<Search>("/searches", { method: "POST", body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SEARCH_HISTORY_KEY }),
  });
}

export function useSearch(searchId: string | null) {
  return useQuery({
    queryKey: searchId ? searchKey(searchId) : ["searches", "none"],
    queryFn: () => apiFetch<Search>(`/searches/${searchId}`),
    enabled: !!searchId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "PENDING" || status === "RUNNING" ? 1200 : false;
    },
  });
}

export function useSearchHistory() {
  return useQuery({
    queryKey: SEARCH_HISTORY_KEY,
    queryFn: () => apiFetch<Paginated<Search>>("/searches?pageSize=10"),
  });
}

/** Paginated view for /app/searches, distinct from the fixed-size useSearchHistory (used by Find's history menu). */
export function useSearchesPage(page: number, pageSize = 20) {
  return useQuery({
    queryKey: ["searches", "page", page, pageSize],
    queryFn: () => apiFetch<Paginated<Search>>(`/searches?page=${page}&pageSize=${pageSize}`),
  });
}

export interface SearchResultsFilterParams {
  sortBy?: "rating" | "reviewCount" | "businessName" | "createdAt";
  order?: "asc" | "desc";
  minRating?: number;
  hasWebsite?: "true" | "false";
}

const PAGE_SIZE = 20;

/**
 * Paginated via TanStack Query's infinite-query pages rather than manual
 * accumulation state — resetting on a filter/sort change and appending on
 * "Load more" both fall out of the queryKey/getNextPageParam contract for
 * free, with no effect needed to keep local state in sync.
 */
export function useSearchResultsInfinite(
  searchId: string | null,
  params: SearchResultsFilterParams,
  enabled: boolean,
) {
  return useInfiniteQuery({
    queryKey: ["searches", searchId, "results", params],
    queryFn: ({ pageParam }) => {
      const query = new URLSearchParams({ page: String(pageParam), pageSize: String(PAGE_SIZE) });
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) query.set(key, String(value));
      }
      return apiFetch<Paginated<SearchResult>>(`/searches/${searchId}/results?${query.toString()}`);
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page * lastPage.pageSize < lastPage.total ? lastPage.page + 1 : undefined,
    enabled: !!searchId && enabled,
  });
}

export function useBulkSaveResults() {
  return useMutation({
    mutationFn: (searchResultIds: string[]) =>
      apiFetch<{ leadIds: string[] }>("/search-results/bulk-save", {
        method: "POST",
        body: { searchResultIds },
      }),
  });
}

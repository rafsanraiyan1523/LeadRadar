import { create } from "zustand";
import type { SearchFilters } from "@/lib/lead-discovery-types";

export type WebsiteFilter = "ANY" | "HAS_WEBSITE" | "NO_WEBSITE";
export type GooglePresenceFilter = "ANY" | "FOUND" | "NOT_VERIFIED";
export type OpportunityFilter = "ANY" | "HIGH" | "MEDIUM" | "LOW";

export interface FindFilters {
  minRating: number;
  minReviews: number;
  website: WebsiteFilter;
  googlePresence: GooglePresenceFilter;
  opportunity: OpportunityFilter;
  lowReviews: boolean;
  weakDigitalPresence: boolean;
}

export const DEFAULT_FILTERS: FindFilters = {
  minRating: 0,
  minReviews: 0,
  website: "ANY",
  googlePresence: "ANY",
  opportunity: "ANY",
  lowReviews: false,
  weakDigitalPresence: false,
};

/**
 * Maps the store's UI-shaped filters onto the API's SearchFiltersDto shape
 * (which packs "additional" toggles into one array) — sent when creating a
 * search purely for storage/history purposes (see SEARCH HISTORY), not to
 * change what the provider generates.
 */
export function toApiFilters(filters: FindFilters): SearchFilters {
  return {
    minRating: filters.minRating > 0 ? filters.minRating : undefined,
    minReviews: filters.minReviews > 0 ? filters.minReviews : undefined,
    website: filters.website,
    googlePresence: filters.googlePresence,
    opportunity: filters.opportunity,
    additional: [
      ...(filters.lowReviews ? (["LOW_REVIEWS"] as const) : []),
      ...(filters.weakDigitalPresence ? (["WEAK_DIGITAL_PRESENCE"] as const) : []),
    ],
  };
}

interface FindFiltersStore {
  filters: FindFilters;
  setFilter: <K extends keyof FindFilters>(key: K, value: FindFilters[K]) => void;
  reset: () => void;
}

export const useFindFiltersStore = create<FindFiltersStore>((set) => ({
  filters: DEFAULT_FILTERS,
  setFilter: (key, value) => set((state) => ({ filters: { ...state.filters, [key]: value } })),
  reset: () => set({ filters: DEFAULT_FILTERS }),
}));

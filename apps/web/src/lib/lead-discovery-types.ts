export type SearchStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
export type ProviderMode = "MOCK" | "GOOGLE";
export type BusinessStatus = "OPERATIONAL" | "CLOSED_TEMPORARILY" | "CLOSED_PERMANENTLY";

export interface SearchFilters {
  minRating?: number;
  minReviews?: number;
  website?: "ANY" | "HAS_WEBSITE" | "NO_WEBSITE";
  googlePresence?: "ANY" | "FOUND" | "NOT_VERIFIED";
  opportunity?: "ANY" | "HIGH" | "MEDIUM" | "LOW";
  additional?: (
    "NO_BOOKING" | "POOR_WEBSITE" | "WEAK_SEO" | "LOW_REVIEWS" | "WEAK_DIGITAL_PRESENCE"
  )[];
}

export interface Search {
  id: string;
  organizationId: string;
  userId: string;
  query: string;
  location: string | null;
  filters: SearchFilters | null;
  status: SearchStatus;
  progress: number;
  resultCount: number;
  providerMode: ProviderMode;
  errorMessage: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SearchResult {
  id: string;
  searchId: string;
  businessName: string;
  category: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  externalId: string | null;
  rating: number | null;
  reviewCount: number | null;
  businessStatus: BusinessStatus | null;
  websiteUrl: string | null;
  hasWebsite: boolean;
  phone: string | null;
  googleMapsUri: string | null;
  hasGoogleProfile: boolean;
  opportunityScore: number | null;
  promotedToLeadId: string | null;
  createdAt: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateSearchInput {
  query: string;
  location: string;
  radiusMeters?: number;
  maxResults?: number;
  filters?: SearchFilters;
}

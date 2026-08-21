import type { BusinessSummary } from "@lead-radar/types";
import type { Prisma } from "@lead-radar/db";

/**
 * Maps a provider's BusinessSummary onto a SearchResult row. Keeps the
 * normalized, queryable columns (rating, hasWebsite, ...) separate from the
 * full raw payload, mirroring the externally-sourced-vs-app-generated split
 * used throughout the schema.
 */
export function normalizeBusinessSummary(
  searchId: string,
  business: BusinessSummary,
): Prisma.SearchResultCreateManyInput {
  return {
    searchId,
    businessName: business.name,
    category: business.category,
    address: business.address,
    city: business.city,
    country: business.country,
    latitude: business.location.latitude,
    longitude: business.location.longitude,
    externalId: business.externalId,
    rating: business.rating,
    reviewCount: business.reviewCount,
    businessStatus: business.businessStatus,
    websiteUrl: business.websiteUrl,
    hasWebsite: business.websiteUrl !== null,
    phone: business.phone,
    googleMapsUri: business.googleMapsUri,
    hasGoogleProfile: business.hasGoogleProfile,
    rawData: business as unknown as Prisma.InputJsonValue,
  };
}

import type {
  BusinessDetails,
  BusinessStatus,
  BusinessSummary,
  LeadDiscoveryProvider,
  SearchBusinessesParams,
} from "@lead-radar/types";
import { createConcurrencyLimit } from "../lib/concurrency-limit";
import { RateLimiter } from "../lib/rate-limiter";
import { buildGoogleMapsSearchUrl } from "../lib/google-maps-url";

const PLACES_API_BASE = "https://places.googleapis.com/v1";

// Places API (New) caps a single Text Search response at 20 results. We
// deliberately never auto-paginate past this — each extra page is another
// billed request, and MAX_RESULTS_PER_SEARCH defaults to 20 anyway.
const GOOGLE_TEXT_SEARCH_MAX = 20;

const SEARCH_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.businessStatus",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.primaryTypeDisplayName",
  "places.googleMapsUri",
].join(",");

const DETAILS_FIELD_MASK = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "rating",
  "userRatingCount",
  "businessStatus",
  "websiteUri",
  "nationalPhoneNumber",
  "primaryTypeDisplayName",
  "googleMapsUri",
  "types",
  "regularOpeningHours.weekdayDescriptions",
  "photos",
].join(",");

export interface GooglePlacesProviderConfig {
  apiKey: string;
  /** Caps simultaneous outbound requests — cost/abuse control. */
  maxConcurrentRequests?: number;
  /** Caps requests per rolling window — cost/abuse control. */
  rateLimit?: { maxRequests: number; windowMs: number };
  requestTimeoutMs?: number;
}

interface GooglePlaceResult {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  businessStatus?: string;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  primaryTypeDisplayName?: { text?: string };
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  types?: string[];
  googleMapsUri?: string;
  photos?: unknown[];
}

const BUSINESS_STATUS_MAP: Record<string, BusinessStatus> = {
  OPERATIONAL: "OPERATIONAL",
  CLOSED_TEMPORARILY: "CLOSED_TEMPORARILY",
  CLOSED_PERMANENTLY: "CLOSED_PERMANENTLY",
};

/**
 * Wraps the official Google Maps Platform Places API (New). Server-side
 * only — the API key must never reach the browser. Requests a minimal
 * field mask on every call (billing is per-field-tier on this API, so a
 * narrower mask is directly cheaper, not just tidier). Optional: the app
 * is fully functional without this provider — see MockLeadDiscoveryProvider.
 */
export class GooglePlacesProvider implements LeadDiscoveryProvider {
  readonly mode = "GOOGLE" as const;

  private readonly limitConcurrency: <T>(fn: () => Promise<T>) => Promise<T>;
  private readonly rateLimiter: RateLimiter;
  private readonly requestTimeoutMs: number;

  constructor(private readonly config: GooglePlacesProviderConfig) {
    if (!config.apiKey) {
      throw new Error("GooglePlacesProvider requires an apiKey");
    }
    this.limitConcurrency = createConcurrencyLimit(config.maxConcurrentRequests ?? 3);
    this.rateLimiter = new RateLimiter(
      config.rateLimit?.maxRequests ?? 10,
      config.rateLimit?.windowMs ?? 1000,
    );
    this.requestTimeoutMs = config.requestTimeoutMs ?? 8000;
  }

  async searchBusinesses(params: SearchBusinessesParams): Promise<BusinessSummary[]> {
    const maxResultCount = Math.max(
      1,
      Math.min(params.maxResults ?? GOOGLE_TEXT_SEARCH_MAX, GOOGLE_TEXT_SEARCH_MAX),
    );

    const body: Record<string, unknown> = {
      textQuery: `${params.query} in ${params.location}`,
      maxResultCount,
    };
    if (params.radiusMeters) {
      body.locationBias = {
        circle: { center: { latitude: 0, longitude: 0 }, radius: params.radiusMeters },
      };
    }

    const data = await this.request<{ places?: GooglePlaceResult[] }>(
      "/places:searchText",
      "POST",
      SEARCH_FIELD_MASK,
      body,
    );

    return (data.places ?? []).map(toBusinessSummary);
  }

  async getBusinessDetails(externalId: string): Promise<BusinessDetails | null> {
    try {
      const place = await this.request<GooglePlaceResult>(
        `/places/${encodeURIComponent(externalId)}`,
        "GET",
        DETAILS_FIELD_MASK,
      );
      const summary = toBusinessSummary(place);
      return {
        ...summary,
        openingHours: place.regularOpeningHours?.weekdayDescriptions ?? null,
        additionalCategories: place.types ?? [],
        photosAvailable: (place.photos?.length ?? 0) > 0,
      };
    } catch (error) {
      if (error instanceof GooglePlacesNotFoundError) {
        return null;
      }
      throw error;
    }
  }

  private async request<T>(
    path: string,
    method: "GET" | "POST",
    fieldMask: string,
    body?: unknown,
  ): Promise<T> {
    await this.rateLimiter.acquire();
    return this.limitConcurrency(async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);

      try {
        const response = await fetch(`${PLACES_API_BASE}${path}`, {
          method,
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": this.config.apiKey,
            "X-Goog-FieldMask": fieldMask,
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        if (response.status === 404) {
          throw new GooglePlacesNotFoundError(externalIdFromPath(path));
        }
        if (!response.ok) {
          const text = await response.text().catch(() => "");
          throw new Error(`Google Places API error ${response.status}: ${text}`);
        }

        return (await response.json()) as T;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          throw new Error(`Google Places API request timed out after ${this.requestTimeoutMs}ms`);
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    });
  }
}

export class GooglePlacesNotFoundError extends Error {
  constructor(readonly placeId: string) {
    super(`Place not found: ${placeId}`);
  }
}

function externalIdFromPath(path: string): string {
  return path.split("/").pop() ?? path;
}

function toBusinessSummary(place: GooglePlaceResult): BusinessSummary {
  const name = place.displayName?.text ?? "Unknown business";
  const address = place.formattedAddress ?? "";
  const [city, country] = address
    .split(",")
    .slice(-2)
    .map((s) => s.trim());

  return {
    externalId: place.id,
    name,
    category: place.primaryTypeDisplayName?.text ?? "Business",
    address,
    city: city ?? "",
    country: country ?? "",
    location: {
      latitude: place.location?.latitude ?? 0,
      longitude: place.location?.longitude ?? 0,
    },
    rating: place.rating ?? null,
    reviewCount: place.userRatingCount ?? null,
    businessStatus: BUSINESS_STATUS_MAP[place.businessStatus ?? ""] ?? "OPERATIONAL",
    websiteUrl: place.websiteUri ?? null,
    phone: place.nationalPhoneNumber ?? null,
    googleMapsUri: place.googleMapsUri ?? buildGoogleMapsSearchUrl(name, address),
    hasGoogleProfile: true,
  };
}

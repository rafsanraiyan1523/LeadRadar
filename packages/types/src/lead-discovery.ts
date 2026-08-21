export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export type BusinessStatus = "OPERATIONAL" | "CLOSED_TEMPORARILY" | "CLOSED_PERMANENTLY";

export type LeadDiscoveryProviderMode = "MOCK" | "GOOGLE";

/**
 * A normalized business record as returned by a LeadDiscoveryProvider.
 * Every field here is externally sourced (from the provider) — never
 * app-generated analysis, which lives on Lead/OpportunityScore instead.
 */
export interface BusinessSummary {
  /** The provider's own identifier — a real Google Place ID in GOOGLE mode, a synthetic id in MOCK mode. Never treated as a Google Place ID unless it actually is one. */
  externalId: string;
  name: string;
  category: string;
  address: string;
  city: string;
  country: string;
  location: GeoPoint;
  rating: number | null;
  reviewCount: number | null;
  businessStatus: BusinessStatus;
  /** null means "no website found" — never fabricated. */
  websiteUrl: string | null;
  /** null means "no phone found" — never fabricated. */
  phone: string | null;
  /** Always a real, working Google Maps search deep link — see docs/architecture.md#provider-abstractions. */
  googleMapsUri: string;
  hasGoogleProfile: boolean;
}

export interface BusinessDetails extends BusinessSummary {
  openingHours: string[] | null;
  additionalCategories: string[];
  /** Whether the provider reported at least one photo — never fabricated; false in mock mode, which never simulates photos. */
  photosAvailable: boolean;
}

export interface SearchBusinessesParams {
  /** Business type / category query, e.g. "Dental Clinic". */
  query: string;
  /** Free-text location, e.g. "Banani, Dhaka". */
  location: string;
  radiusMeters?: number;
  maxResults?: number;
}

export interface LeadDiscoveryProvider {
  readonly mode: LeadDiscoveryProviderMode;
  searchBusinesses(params: SearchBusinessesParams): Promise<BusinessSummary[]>;
  getBusinessDetails(externalId: string): Promise<BusinessDetails | null>;
}

export const LEAD_DISCOVERY_QUEUE = "lead-discovery";

export interface LeadDiscoveryJobData {
  searchId: string;
  organizationId: string;
  query: string;
  location: string;
  radiusMeters?: number;
  maxResults?: number;
  providerMode: LeadDiscoveryProviderMode;
}

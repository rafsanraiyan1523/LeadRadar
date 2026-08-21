import type {
  BusinessDetails,
  BusinessSummary,
  LeadDiscoveryProvider,
  SearchBusinessesParams,
} from "@lead-radar/types";
import { generateBusiness } from "./generate-business";
import { decodeMockId } from "./mock-id";
import { createSeededRandom, hashStringToSeed, pick } from "../lib/seeded-random";

const DEFAULT_MAX_RESULTS = 20;
const ABSOLUTE_MAX_RESULTS = 60;

const OPENING_HOURS_TEMPLATES = [
  ["Mon–Sat: 10:00 AM – 8:00 PM", "Fri: Closed"],
  ["Daily: 9:00 AM – 10:00 PM"],
  ["Sat–Thu: 11:00 AM – 11:00 PM", "Fri: 3:00 PM – 11:00 PM"],
];

/**
 * Generates realistic, deterministic local businesses without any external
 * dependency — the default provider so the whole product works at zero
 * cost. Same query+location always yields the same result set, which keeps
 * demos and tests reproducible.
 */
export class MockLeadDiscoveryProvider implements LeadDiscoveryProvider {
  readonly mode = "MOCK" as const;

  constructor(private readonly options: { simulateLatency?: boolean } = {}) {}

  async searchBusinesses(params: SearchBusinessesParams): Promise<BusinessSummary[]> {
    const requested = params.maxResults ?? DEFAULT_MAX_RESULTS;
    const count = Math.max(0, Math.min(requested, ABSOLUTE_MAX_RESULTS));

    if (this.options.simulateLatency !== false) {
      await simulateLatency(params.query, params.location);
    }

    return Array.from({ length: count }, (_, index) =>
      generateBusiness(params.query, params.location, index),
    );
  }

  async getBusinessDetails(externalId: string): Promise<BusinessDetails | null> {
    const ref = decodeMockId(externalId);
    if (!ref) {
      return null;
    }

    if (this.options.simulateLatency !== false) {
      await simulateLatency(ref.query, ref.location);
    }

    const summary = generateBusiness(ref.query, ref.location, ref.index);
    const random = createSeededRandom(hashStringToSeed(`details|${externalId}`));

    return {
      ...summary,
      openingHours: summary.hasGoogleProfile ? pick(random, OPENING_HOURS_TEMPLATES) : null,
      additionalCategories: [],
      // Mock mode never simulates photo data — always honestly false, not fabricated.
      photosAvailable: false,
    };
  }
}

/** A short, deterministic delay so the UI's loading/progress states are exercised realistically. */
async function simulateLatency(query: string, location: string): Promise<void> {
  const random = createSeededRandom(hashStringToSeed(`latency|${query}|${location}|${Date.now()}`));
  const ms = 150 + Math.floor(random() * 250);
  await new Promise((resolve) => setTimeout(resolve, ms));
}

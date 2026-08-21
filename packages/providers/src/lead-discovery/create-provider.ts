import type { LeadDiscoveryProvider, LeadDiscoveryProviderMode } from "@lead-radar/types";
import { MockLeadDiscoveryProvider } from "./mock-lead-discovery.provider";
import { GooglePlacesProvider, type GooglePlacesProviderConfig } from "./google-places.provider";

export interface CreateLeadDiscoveryProviderOptions {
  mode: LeadDiscoveryProviderMode;
  google?: GooglePlacesProviderConfig;
}

/**
 * Single place that decides mock vs. real. Defaults to mock whenever GOOGLE
 * mode is requested without a configured API key, rather than throwing —
 * the app must keep working at zero cost even if configuration drifts.
 */
export function createLeadDiscoveryProvider(
  options: CreateLeadDiscoveryProviderOptions,
): LeadDiscoveryProvider {
  if (options.mode === "GOOGLE" && options.google?.apiKey) {
    return new GooglePlacesProvider(options.google);
  }
  return new MockLeadDiscoveryProvider();
}

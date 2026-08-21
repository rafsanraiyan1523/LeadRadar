/**
 * Builds a real, always-resolving Google Maps "search" deep link
 * (Google's documented URL scheme — https://developers.google.com/maps/documentation/urls/get-started#search-action).
 * No API key required. Used for every "Open Maps" action, in both MOCK and
 * GOOGLE provider mode, so that action never points at a fabricated or
 * dead URL — a mock business's synthetic place id would make a
 * place-detail deep link (`.../maps/place/?q=place_id:...`) resolve to
 * nothing, whereas a text search always finds something sensible.
 */
export function buildGoogleMapsSearchUrl(name: string, address: string): string {
  const query = encodeURIComponent(`${name}, ${address}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

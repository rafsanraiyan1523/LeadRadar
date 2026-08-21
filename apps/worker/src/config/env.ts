import "dotenv/config";

function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  redisUrl: requireEnv("REDIS_URL", "redis://localhost:6379"),
  healthPort: Number(process.env.WORKER_HEALTH_PORT ?? 4100),
  // GOOGLE_MAPS_API_KEY is the documented/canonical name going forward;
  // GOOGLE_PLACES_API_KEY (this app's original name) keeps working.
  googlePlacesApiKey: process.env.GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_PLACES_API_KEY,
  maxConcurrentRequests: Number(process.env.MAX_CONCURRENT_REQUESTS ?? 3),
  googleRequestRateLimit: Number(process.env.GOOGLE_REQUEST_RATE_LIMIT ?? 10),
  // Website crawler bounds (lead enrichment) — kept small and controlled on
  // purpose, see docs/architecture.md#lead-enrichment.
  crawlerMaxPages: Number(process.env.MAX_PAGES ?? 5),
  crawlerMaxResponseBytes: Number(process.env.MAX_RESPONSE_SIZE ?? 2_000_000),
  crawlerRequestTimeoutMs: Number(process.env.REQUEST_TIMEOUT ?? 8000),
  crawlerRequestDelayMs: Number(process.env.CRAWLER_REQUEST_DELAY_MS ?? 300),
};

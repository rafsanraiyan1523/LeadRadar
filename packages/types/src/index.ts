export interface HealthCheckResult {
  status: "ok" | "degraded" | "error";
  service: string;
  timestamp: string;
  checks: Record<string, { status: "ok" | "error"; message?: string }>;
  /** Only present on the API's own health/ready response — which of the zero-cost mock providers are active. */
  demoMode?: { mockGoogle: boolean; mockAi: boolean; mockData: boolean };
}

export * from "./lead-discovery";
export * from "./lead-enrichment";
export * from "./digital-intelligence";
export * from "./ai";
export * from "./crm";

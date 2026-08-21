function isTruthyFlag(value: string | undefined): boolean {
  return (
    value !== undefined && ['true', '1', 'yes'].includes(value.toLowerCase())
  );
}

function isFalsyFlag(value: string | undefined): boolean {
  return (
    value !== undefined && ['false', '0', 'no'].includes(value.toLowerCase())
  );
}

export interface AppConfig {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  redisUrl: string;
  webOrigin: string;
  cookieSecret: string;
  jwtSecret: string;
  /** Reserved for future use — refresh tokens are opaque, high-entropy random values (not JWTs), hashed at rest with plain SHA-256. Not currently consumed. */
  jwtRefreshSecret: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlDays: number;
  emailVerificationTtlHours: number;
  passwordResetTtlMinutes: number;
  invitationTtlDays: number;
  leadDiscoveryProviderMode: 'MOCK' | 'GOOGLE';
  googlePlacesApiKey: string | undefined;
  maxResultsPerSearch: number;
  maxConcurrentRequests: number;
  googleRequestRateLimit: number;
  aiMode: 'MOCK' | 'LOCAL' | 'EXTERNAL';
  ollamaBaseUrl: string;
  ollamaModel: string;
  anthropicApiKey: string | undefined;
  anthropicModel: string;
  /** Umbrella zero-cost-demo flags — see docs/deployment.md#demo-mode. Individual providers already default to mock; these are for an explicit, single-glance "is this a paid deployment" read. */
  mockGoogle: boolean;
  mockAi: boolean;
  mockData: boolean;
}

export default (): AppConfig => {
  // GOOGLE_MAPS_API_KEY is the documented/canonical name going forward;
  // GOOGLE_PLACES_API_KEY (this app's original name, still used internally
  // and by apps/worker) keeps working so nothing already deployed breaks.
  const googlePlacesApiKey =
    process.env.GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_PLACES_API_KEY;
  // MOCK_GOOGLE defaults true (the zero-cost demo default). GOOGLE mode
  // requires *both* an explicit opt-in (GOOGLE_MAPS_ENABLED=true or the
  // older LEAD_DISCOVERY_PROVIDER=GOOGLE) and a real API key — see
  // createLeadDiscoveryProvider's own fallback-to-mock behavior, which
  // stays as a second independent safety net if a key is missing.
  const mockGoogle = !isFalsyFlag(process.env.MOCK_GOOGLE);
  const googleMapsEnabled =
    isTruthyFlag(process.env.GOOGLE_MAPS_ENABLED) ||
    process.env.LEAD_DISCOVERY_PROVIDER === 'GOOGLE';
  const leadDiscoveryProviderMode: 'MOCK' | 'GOOGLE' =
    !mockGoogle && googleMapsEnabled && googlePlacesApiKey ? 'GOOGLE' : 'MOCK';

  // AI_API_KEY/AI_MODEL are the documented/canonical names; ANTHROPIC_* keep
  // working the same way GOOGLE_PLACES_API_KEY does above.
  const anthropicApiKey =
    process.env.AI_API_KEY ?? process.env.ANTHROPIC_API_KEY;
  const anthropicModel =
    process.env.AI_MODEL ?? process.env.ANTHROPIC_MODEL ?? 'claude-opus-5';
  const mockAi = !isFalsyFlag(process.env.MOCK_AI);
  const requestedAiMode = (['MOCK', 'LOCAL', 'EXTERNAL'] as const).includes(
    process.env.AI_MODE?.toUpperCase() as 'MOCK' | 'LOCAL' | 'EXTERNAL',
  )
    ? (process.env.AI_MODE!.toUpperCase() as 'MOCK' | 'LOCAL' | 'EXTERNAL')
    : 'MOCK';
  const aiMode = mockAi ? 'MOCK' : requestedAiMode;

  return {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: Number(process.env.API_PORT ?? 4000),
    databaseUrl: process.env.DATABASE_URL ?? '',
    redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
    webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
    cookieSecret: process.env.COOKIE_SECRET ?? 'dev-insecure-cookie-secret',
    jwtSecret: process.env.JWT_SECRET ?? 'dev-insecure-jwt-secret',
    jwtRefreshSecret:
      process.env.JWT_REFRESH_SECRET ?? 'dev-insecure-jwt-refresh-secret',
    accessTokenTtlSeconds: Number(
      process.env.ACCESS_TOKEN_TTL_SECONDS ?? 15 * 60,
    ),
    refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 30),
    emailVerificationTtlHours: Number(
      process.env.EMAIL_VERIFICATION_TTL_HOURS ?? 24,
    ),
    passwordResetTtlMinutes: Number(
      process.env.PASSWORD_RESET_TTL_MINUTES ?? 30,
    ),
    invitationTtlDays: Number(process.env.INVITATION_TTL_DAYS ?? 7),
    leadDiscoveryProviderMode,
    googlePlacesApiKey,
    maxResultsPerSearch: Number(process.env.MAX_RESULTS_PER_SEARCH ?? 20),
    maxConcurrentRequests: Number(process.env.MAX_CONCURRENT_REQUESTS ?? 3),
    googleRequestRateLimit: Number(process.env.GOOGLE_REQUEST_RATE_LIMIT ?? 10),
    aiMode,
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
    ollamaModel: process.env.OLLAMA_MODEL ?? 'llama3.2',
    anthropicApiKey,
    anthropicModel,
    mockGoogle: leadDiscoveryProviderMode === 'MOCK',
    mockAi: aiMode !== 'EXTERNAL',
    mockData: !isFalsyFlag(process.env.MOCK_DATA),
  };
};

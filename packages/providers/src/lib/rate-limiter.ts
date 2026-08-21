/**
 * Simple sliding-window rate limiter: `acquire()` resolves immediately if
 * fewer than `maxRequests` calls happened in the trailing `windowMs`,
 * otherwise it waits until the oldest call in the window ages out. Used to
 * cap outbound requests to Google Places (GOOGLE_REQUEST_RATE_LIMIT).
 */
export class RateLimiter {
  private readonly timestamps: number[] = [];

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number,
  ) {}

  async acquire(): Promise<void> {
    const now = Date.now();
    this.evictExpired(now);

    if (this.timestamps.length < this.maxRequests) {
      this.timestamps.push(now);
      return;
    }

    const oldest = this.timestamps[0];
    const waitMs = oldest !== undefined ? Math.max(0, oldest + this.windowMs - now) : 0;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    return this.acquire();
  }

  private evictExpired(now: number): void {
    while (this.timestamps.length > 0 && this.timestamps[0]! <= now - this.windowMs) {
      this.timestamps.shift();
    }
  }
}

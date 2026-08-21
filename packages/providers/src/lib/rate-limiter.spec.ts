import { describe, expect, it } from "vitest";
import { RateLimiter } from "./rate-limiter";

describe("RateLimiter", () => {
  it("allows requests up to the limit immediately", async () => {
    const limiter = new RateLimiter(3, 1000);
    const start = Date.now();

    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();

    expect(Date.now() - start).toBeLessThan(50);
  });

  it("delays a request that exceeds the limit until the window frees up", async () => {
    const limiter = new RateLimiter(1, 100);
    const start = Date.now();

    await limiter.acquire();
    await limiter.acquire(); // must wait ~100ms for the first slot to expire

    expect(Date.now() - start).toBeGreaterThanOrEqual(90);
  });
});

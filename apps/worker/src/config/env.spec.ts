import { beforeEach, describe, expect, it, vi } from "vitest";

describe("env", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.REDIS_URL;
    delete process.env.WORKER_HEALTH_PORT;
  });

  it("falls back to sane defaults when env vars are unset", async () => {
    const { env } = await import("./env");
    expect(env.redisUrl).toBe("redis://localhost:6379");
    expect(env.healthPort).toBe(4100);
  });

  it("honors explicit overrides", async () => {
    process.env.REDIS_URL = "redis://redis:6380";
    process.env.WORKER_HEALTH_PORT = "5000";
    const { env } = await import("./env");
    expect(env.redisUrl).toBe("redis://redis:6380");
    expect(env.healthPort).toBe(5000);
  });
});

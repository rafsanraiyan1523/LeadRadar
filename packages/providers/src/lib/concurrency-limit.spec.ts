import { describe, expect, it } from "vitest";
import { createConcurrencyLimit } from "./concurrency-limit";

describe("createConcurrencyLimit", () => {
  it("never runs more than the configured number of tasks at once", async () => {
    const limit = createConcurrencyLimit(2);
    let active = 0;
    let maxActive = 0;

    const task = () =>
      limit(async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 20));
        active--;
      });

    await Promise.all(Array.from({ length: 6 }, task));

    expect(maxActive).toBeLessThanOrEqual(2);
  });

  it("propagates a rejection without blocking subsequent tasks", async () => {
    const limit = createConcurrencyLimit(1);

    await expect(limit(() => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    await expect(limit(() => Promise.resolve("ok"))).resolves.toBe("ok");
  });
});

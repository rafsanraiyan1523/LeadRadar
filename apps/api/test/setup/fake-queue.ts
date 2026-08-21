export interface FakeJob<TData> {
  id: string;
  name: string;
  data: TData;
}

/**
 * Stands in for the BullMQ Queue in e2e tests, which run against a fake
 * Redis client (no real Redis server) — a real Queue would fail to
 * construct against it. Records what was enqueued so tests can assert on
 * it, and can simulate an enqueue failure (queue/Redis outage).
 */
export class FakeQueue<TData> {
  readonly jobs: FakeJob<TData>[] = [];
  shouldFailToEnqueue = false;

  add(
    name: string,
    data: TData,
    opts?: { jobId?: string },
  ): Promise<FakeJob<TData>> {
    if (this.shouldFailToEnqueue) {
      return Promise.reject(new Error('Redis connection unavailable'));
    }
    const job: FakeJob<TData> = {
      id: opts?.jobId ?? `${this.jobs.length + 1}`,
      name,
      data,
    };
    this.jobs.push(job);
    return Promise.resolve(job);
  }

  remove(jobId: string): Promise<number> {
    const index = this.jobs.findIndex((job) => job.id === jobId);
    if (index === -1) return Promise.resolve(0);
    this.jobs.splice(index, 1);
    return Promise.resolve(1);
  }

  clear(): void {
    this.jobs.length = 0;
    this.shouldFailToEnqueue = false;
  }
}

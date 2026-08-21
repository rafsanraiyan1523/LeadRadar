import { Queue, QueueOptions, Worker, WorkerOptions, Processor } from "bullmq";
import { connection } from "../lib/redis";

const defaultQueueOptions: Omit<QueueOptions, "connection"> = {
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 500,
    removeOnFail: 1000,
  },
};

export function createQueue<T = unknown>(name: string): Queue<T> {
  return new Queue<T>(name, { ...defaultQueueOptions, connection });
}

export function createWorker<T = unknown>(
  name: string,
  processor: Processor<T>,
  options?: Partial<WorkerOptions>,
): Worker<T> {
  return new Worker<T>(name, processor, { ...options, connection });
}

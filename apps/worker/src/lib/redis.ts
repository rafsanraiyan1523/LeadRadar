import { Redis } from "ioredis";
import { env } from "../config/env";

export function createRedisConnection(): Redis {
  return new Redis(env.redisUrl, {
    maxRetriesPerRequest: null,
  });
}

export const connection = createRedisConnection();

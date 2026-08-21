import { Global, Module } from '@nestjs/common';
import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import {
  FOLLOW_UP_REMINDER_QUEUE,
  LEAD_DISCOVERY_QUEUE,
  LEAD_ENRICHMENT_QUEUE,
  type FollowUpReminderJobData,
  type LeadDiscoveryJobData,
  type LeadEnrichmentJobData,
} from '@lead-radar/types';
import { REDIS_CLIENT } from '../redis/redis.module';

export const LEAD_DISCOVERY_QUEUE_TOKEN = 'LEAD_DISCOVERY_QUEUE';
export const LEAD_ENRICHMENT_QUEUE_TOKEN = 'LEAD_ENRICHMENT_QUEUE';
export const FOLLOW_UP_REMINDER_QUEUE_TOKEN = 'FOLLOW_UP_REMINDER_QUEUE';

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 2000 },
  removeOnComplete: 500,
  removeOnFail: 1000,
};

@Global()
@Module({
  providers: [
    {
      provide: LEAD_DISCOVERY_QUEUE_TOKEN,
      useFactory: (redis: Redis) =>
        new Queue<LeadDiscoveryJobData>(LEAD_DISCOVERY_QUEUE, {
          connection: redis,
          defaultJobOptions,
        }),
      inject: [REDIS_CLIENT],
    },
    {
      provide: LEAD_ENRICHMENT_QUEUE_TOKEN,
      useFactory: (redis: Redis) =>
        new Queue<LeadEnrichmentJobData>(LEAD_ENRICHMENT_QUEUE, {
          connection: redis,
          defaultJobOptions,
        }),
      inject: [REDIS_CLIENT],
    },
    {
      provide: FOLLOW_UP_REMINDER_QUEUE_TOKEN,
      useFactory: (redis: Redis) =>
        new Queue<FollowUpReminderJobData>(FOLLOW_UP_REMINDER_QUEUE, {
          connection: redis,
          defaultJobOptions,
        }),
      inject: [REDIS_CLIENT],
    },
  ],
  exports: [
    LEAD_DISCOVERY_QUEUE_TOKEN,
    LEAD_ENRICHMENT_QUEUE_TOKEN,
    FOLLOW_UP_REMINDER_QUEUE_TOKEN,
  ],
})
export class QueueModule {}

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import type { App } from 'supertest/types';
import type {
  FollowUpReminderJobData,
  LeadDiscoveryJobData,
  LeadEnrichmentJobData,
} from '@lead-radar/types';
import { AppModule } from '../../src/app.module';
import { MAIL_PROVIDER } from '../../src/mail/mail-provider.interface';
import { REDIS_CLIENT } from '../../src/redis/redis.module';
import {
  FOLLOW_UP_REMINDER_QUEUE_TOKEN,
  LEAD_DISCOVERY_QUEUE_TOKEN,
  LEAD_ENRICHMENT_QUEUE_TOKEN,
} from '../../src/queue/queue.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { MemoryMailProvider } from './memory-mail.provider';
import { FakeQueue } from './fake-queue';

export interface TestApp {
  app: INestApplication<App>;
  mail: MemoryMailProvider;
  queue: FakeQueue<LeadDiscoveryJobData>;
  enrichmentQueue: FakeQueue<LeadEnrichmentJobData>;
  followUpReminderQueue: FakeQueue<FollowUpReminderJobData>;
  prisma: PrismaService;
}

/**
 * No Redis is started for the e2e suite — nothing under test here (auth,
 * organizations) uses it yet. Only the health check pings it, so a minimal
 * fake is enough to keep that endpoint testable without a real server.
 */
const fakeRedisClient = { ping: () => Promise.resolve('PONG') };

export async function createTestApp(): Promise<TestApp> {
  const mail = new MemoryMailProvider();
  const queue = new FakeQueue<LeadDiscoveryJobData>();
  const enrichmentQueue = new FakeQueue<LeadEnrichmentJobData>();
  const followUpReminderQueue = new FakeQueue<FollowUpReminderJobData>();

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(MAIL_PROVIDER)
    .useValue(mail)
    .overrideProvider(REDIS_CLIENT)
    .useValue(fakeRedisClient)
    .overrideProvider(LEAD_DISCOVERY_QUEUE_TOKEN)
    .useValue(queue)
    .overrideProvider(LEAD_ENRICHMENT_QUEUE_TOKEN)
    .useValue(enrichmentQueue)
    .overrideProvider(FOLLOW_UP_REMINDER_QUEUE_TOKEN)
    .useValue(followUpReminderQueue)
    .compile();

  const app = moduleRef.createNestApplication<INestApplication<App>>();
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.init();

  const prisma = app.get(PrismaService);

  return { app, mail, queue, enrichmentQueue, followUpReminderQueue, prisma };
}

/** Pulls the `lr_access_token`/`lr_refresh_token` cookies out of a supertest response for reuse on the next request. */
export function extractCookies(
  setCookieHeader: string | string[] | undefined,
): string {
  const values = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : setCookieHeader
      ? [setCookieHeader]
      : [];
  return values.map((cookie) => cookie.split(';')[0]).join('; ');
}

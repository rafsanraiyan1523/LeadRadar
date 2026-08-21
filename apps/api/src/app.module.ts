import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { MailModule } from './mail/mail.module';
import { QueueModule } from './queue/queue.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { HealthModule } from './health/health.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { NotificationsModule } from './notifications/notifications.module';
import { LeadDiscoveryModule } from './lead-discovery/lead-discovery.module';
import { LeadsModule } from './leads/leads.module';
import { DigitalIntelligenceModule } from './digital-intelligence/digital-intelligence.module';
import { AiModule } from './ai/ai.module';
import { CrmModule } from './crm/crm.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    // Matches the worker's pino setup (apps/worker/src/lib/logger.ts): JSON
    // logs in production for log-aggregator ingestion, pretty-printed in
    // dev. Silenced in test env — Jest e2e runs fire hundreds of requests
    // and per-request log lines would just be noise. Auth/session secrets
    // are redacted so tokens never land in log output.
    LoggerModule.forRoot({
      pinoHttp: {
        name: 'leadradar-api',
        level:
          process.env.NODE_ENV === 'test'
            ? 'silent'
            : process.env.NODE_ENV === 'production'
              ? 'info'
              : 'debug',
        transport:
          process.env.NODE_ENV === 'production' ||
          process.env.NODE_ENV === 'test'
            ? undefined
            : {
                target: 'pino-pretty',
                options: { colorize: true, singleLine: true },
              },
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'res.headers["set-cookie"]',
            '*.password',
            '*.currentPassword',
            '*.newPassword',
            '*.token',
            '*.accessToken',
            '*.refreshToken',
          ],
          censor: '[redacted]',
        },
      },
    }),
    // Bumped in test env for the same reason every per-endpoint throttle in
    // this codebase is (see SEARCH_THROTTLE, AI_GENERATE_THROTTLE, etc.) —
    // the full e2e suite fires far more than 100 requests/min at a shared
    // loopback IP within one Jest run.
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: process.env.NODE_ENV === 'test' ? 10_000 : 100,
      },
    ]),
    PrismaModule,
    RedisModule,
    MailModule,
    QueueModule,
    AuditLogModule,
    HealthModule,
    UsersModule,
    AuthModule,
    OrganizationsModule,
    NotificationsModule,
    LeadDiscoveryModule,
    LeadsModule,
    DigitalIntelligenceModule,
    AiModule,
    CrmModule,
    CampaignsModule,
    AnalyticsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}

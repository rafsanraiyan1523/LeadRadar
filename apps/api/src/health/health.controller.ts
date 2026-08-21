import {
  Controller,
  Get,
  HttpCode,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { HealthCheckResult } from '@lead-radar/types';
import type { Redis } from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import { Public } from '../common/decorators/public.decorator';
import type { AppConfig } from '../config/configuration';

interface DemoModeFlags {
  mockGoogle: boolean;
  mockAi: boolean;
  mockData: boolean;
}

// Excluded from the Swagger UI (/api/docs) — these are infrastructure
// probes for the process manager/orchestrator, not product API surface.
@ApiExcludeController()
@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  // /health and /ready are intentionally identical — both check Postgres,
  // Redis, and (implicitly, by responding at all) the application process
  // itself. Two names because different orchestrators/dashboards default to
  // probing one or the other; there's no meaningful liveness-vs-readiness
  // split to make in a single-process API with no in-process degraded state.
  @Public()
  @Get('health')
  @HttpCode(200)
  async health(): Promise<HealthCheckResult> {
    return this.check();
  }

  @Public()
  @Get('ready')
  @HttpCode(200)
  async ready(): Promise<HealthCheckResult> {
    return this.check();
  }

  private async check(): Promise<HealthCheckResult> {
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const status =
      database.status === 'ok' && redis.status === 'ok' ? 'ok' : 'error';
    const result: HealthCheckResult = {
      status,
      service: 'api',
      timestamp: new Date().toISOString(),
      checks: { database, redis },
      demoMode: this.demoModeFlags(),
    };

    if (status === 'error') {
      throw new ServiceUnavailableException(result);
    }

    return result;
  }

  private demoModeFlags(): DemoModeFlags {
    return {
      mockGoogle: this.config.get('mockGoogle', { infer: true }),
      mockAi: this.config.get('mockAi', { infer: true }),
      mockData: this.config.get('mockData', { infer: true }),
    };
  }

  private async checkDatabase(): Promise<{
    status: 'ok' | 'error';
    message?: string;
  }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok' };
    } catch (error) {
      return { status: 'error', message: (error as Error).message };
    }
  }

  private async checkRedis(): Promise<{
    status: 'ok' | 'error';
    message?: string;
  }> {
    try {
      const pong = await this.redis.ping();
      return pong === 'PONG'
        ? { status: 'ok' }
        : { status: 'error', message: `unexpected reply: ${String(pong)}` };
    } catch (error) {
      return { status: 'error', message: (error as Error).message };
    }
  }
}

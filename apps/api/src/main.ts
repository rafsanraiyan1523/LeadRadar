import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import type { AppConfig } from './config/configuration';
import { ACCESS_TOKEN_COOKIE } from './auth/lib/cookies';

const INSECURE_DEFAULT_SECRETS = new Set([
  'dev-insecure-cookie-secret',
  'dev-insecure-jwt-secret',
]);

// The dev-time fallback secrets in configuration.ts exist so the app boots
// with zero setup locally — they must never reach a real deployment. Failing
// fast here (instead of quietly signing real users' sessions with a secret
// that's sitting in the public repo) is cheaper than the incident.
function assertProductionSecretsAreConfigured(
  config: ConfigService<AppConfig, true>,
) {
  if (config.get('nodeEnv', { infer: true }) !== 'production') return;
  const cookieSecret = config.get('cookieSecret', { infer: true });
  const jwtSecret = config.get('jwtSecret', { infer: true });
  if (
    !cookieSecret ||
    !jwtSecret ||
    INSECURE_DEFAULT_SECRETS.has(cookieSecret) ||
    INSECURE_DEFAULT_SECRETS.has(jwtSecret) ||
    cookieSecret === jwtSecret
  ) {
    throw new Error(
      'Refusing to start in production with a missing/default/shared COOKIE_SECRET or JWT_SECRET. ' +
        'Set both to distinct, strong random values (e.g. `openssl rand -base64 32`).',
    );
  }
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  const config = app.get(ConfigService<AppConfig, true>);
  const logger = app.get(Logger);
  app.useLogger(logger);

  assertProductionSecretsAreConfigured(config);

  // Render (and most PaaS platforms) sit exactly one reverse-proxy hop in
  // front of this container. Express ignores X-Forwarded-For by default,
  // so without this, req.ip resolves to the proxy's own address for every
  // request — collapsing the global ThrottlerModule's per-client rate limit
  // into one shared bucket for all users combined. `1` trusts exactly one
  // hop (the immediate proxy), not an arbitrary chain — a client can't
  // spoof its way past this by adding fake X-Forwarded-For hops of its own,
  // since only the outermost (proxy-appended) entry is trusted. Revisit
  // this number if a CDN/additional proxy is ever placed in front of Render.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: config.get('webOrigin', { infer: true }),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const swaggerDocument = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('LeadRadar API')
      .setDescription(
        'Lead intelligence & prospecting platform — discovery, digital-presence audit, ' +
          'AI insight/outreach, CRM, analytics, and campaigns. Auth is cookie-based (an ' +
          'httpOnly session cookie set by /auth/login or /auth/register), not a bearer ' +
          'token — use the "Authorize" button with the cookie value, or drive requests ' +
          'from a browser session that already has it set.',
      )
      .setVersion('1.0')
      .addCookieAuth(ACCESS_TOKEN_COOKIE, {
        type: 'apiKey',
        in: 'cookie',
        name: ACCESS_TOKEN_COOKIE,
      })
      .addTag('Auth')
      .addTag('Search')
      .addTag('Leads')
      .addTag('Audit')
      .addTag('AI & Outreach')
      .addTag('CRM')
      .addTag('Analytics')
      .addTag('Campaigns')
      .addTag('Organizations')
      .addTag('Notifications')
      .addTag('Audit Log')
      .build(),
  );
  SwaggerModule.setup('api/docs', app, swaggerDocument);

  const port = config.get('port', { infer: true });
  await app.listen(port);
  logger.log(`LeadRadar API listening on port ${port}`, 'Bootstrap');
}

void bootstrap();

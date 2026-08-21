import { execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import {
  E2E_DATABASE_URL,
  E2E_DATA_DIR,
  E2E_DB_NAME,
  E2E_PASSWORD,
  E2E_PORT,
  E2E_USER,
} from './e2e-db.constants';

/**
 * Spins up a real, throwaway Postgres server (no Docker required) so the
 * e2e suite exercises actual SQL — constraints, transactions, cascades —
 * rather than a mocked Prisma client. Applies the real migration history,
 * so this also verifies the migration itself is valid.
 */
export default async function globalSetup(): Promise<void> {
  if (existsSync(E2E_DATA_DIR)) {
    rmSync(E2E_DATA_DIR, { recursive: true, force: true });
  }

  const pg = new EmbeddedPostgres({
    databaseDir: E2E_DATA_DIR,
    user: E2E_USER,
    password: E2E_PASSWORD,
    port: E2E_PORT,
    persistent: false,
    // Without this, initdb inherits the host OS locale — on a Windows
    // machine with a non-UTF8 default (e.g. "English_United Kingdom.1252"),
    // that silently creates a WIN1252 database that can't store non-Latin
    // text (Bangla outreach messages, etc.), failing only at insert time.
    // `--locale=C` sidesteps locale-dependent collation entirely, which is
    // fine for a throwaway test database.
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
  });

  await pg.initialise();
  await pg.start();
  await pg.createDatabase(E2E_DB_NAME);

  process.env.DATABASE_URL = E2E_DATABASE_URL;
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'e2e-test-jwt-secret';
  process.env.COOKIE_SECRET = 'e2e-test-cookie-secret';

  execSync('npx prisma migrate deploy', {
    cwd: path.resolve(__dirname, '../..'),
    env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL },
    stdio: 'inherit',
  });
}

import { rmSync } from 'node:fs';
import EmbeddedPostgres from 'embedded-postgres';
import {
  E2E_DATA_DIR,
  E2E_PASSWORD,
  E2E_PORT,
  E2E_USER,
} from './e2e-db.constants';

export default async function globalTeardown(): Promise<void> {
  const pg = new EmbeddedPostgres({
    databaseDir: E2E_DATA_DIR,
    user: E2E_USER,
    password: E2E_PASSWORD,
    port: E2E_PORT,
    persistent: false,
  });

  try {
    await pg.stop();
  } catch {
    // already stopped or never started — nothing to clean up
  }

  try {
    // On Windows the OS can hold file locks briefly after the postgres
    // process exits; failing to remove the dir here isn't fatal since the
    // next run's global-setup deletes it before starting a fresh instance.
    rmSync(E2E_DATA_DIR, { recursive: true, force: true });
  } catch {
    // best-effort cleanup — see comment above
  }
}

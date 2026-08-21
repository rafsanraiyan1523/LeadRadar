// Persistent, no-Docker local Postgres for `npm run dev` — uses the same
// embedded-postgres package the e2e suite relies on, but with
// `persistent: true` and a data dir that survives restarts. Runs on port
// 5433 (not 5432) because something else on this machine already occupies
// 5432 with different credentials. Keep this process running in the
// background for as long as you want Postgres up; it shuts Postgres down
// cleanly on exit.
const path = require('node:path');
const { existsSync } = require('node:fs');
const EmbeddedPostgres = require('embedded-postgres').default;

const DATA_DIR = path.resolve(__dirname, '../.devdb-postgres');
const PORT = 5433;
const USER = 'leadradar';
const PASSWORD = 'leadradar_dev_password';
const DB_NAME = 'leadradar';

async function main() {
  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: USER,
    password: PASSWORD,
    port: PORT,
    persistent: true,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
  });

  const alreadyInitialised = existsSync(path.join(DATA_DIR, 'PG_VERSION'));
  if (!alreadyInitialised) {
    console.log(`Initialising a new Postgres data directory at ${DATA_DIR} ...`);
    await pg.initialise();
  }

  await pg.start();
  console.log(`Postgres started on port ${PORT}.`);

  try {
    await pg.createDatabase(DB_NAME);
    console.log(`Created database "${DB_NAME}".`);
  } catch {
    // Already exists — fine.
  }

  console.log(`Ready: postgresql://${USER}:${PASSWORD}@localhost:${PORT}/${DB_NAME}?schema=public`);

  const shutdown = async () => {
    console.log('Stopping Postgres...');
    await pg.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Keep the process alive — embedded-postgres stops the server when this exits.
  await new Promise(() => {});
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

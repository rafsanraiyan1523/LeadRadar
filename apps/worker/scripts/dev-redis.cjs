// Portable, no-install Redis for local dev on machines without Docker (e.g.
// no hardware virtualization available for Docker Desktop's WSL2 backend).
// Spawns the redis-server.exe already extracted into .devredis/ — see the
// one-time setup instructions below if it's missing.
const path = require('node:path');
const { existsSync } = require('node:fs');
const { spawn } = require('node:child_process');

const DIR = path.resolve(__dirname, '../.devredis');
const EXE = path.join(DIR, 'redis-server.exe');
const PORT = process.env.REDIS_DEV_PORT ?? '6379';

if (!existsSync(EXE)) {
  console.error(`Redis binary not found at ${EXE}.

One-time setup (portable Windows build, no install/virtualization needed):
  mkdir apps/worker/.devredis
  cd apps/worker/.devredis
  curl -sL -o redis.zip https://github.com/tporadowski/redis/releases/download/v5.0.14.1/Redis-x64-5.0.14.1.zip
  unzip -o redis.zip
  rm redis.zip
`);
  process.exit(1);
}

const child = spawn(EXE, ['--port', PORT], { stdio: 'inherit' });
child.on('exit', (code) => process.exit(code ?? 0));
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));

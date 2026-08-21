#!/usr/bin/env node
// Copies each app's .env.example to its working .env file, without
// overwriting any that already exist. Run with `pnpm setup`.

import { existsSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const envFiles = [
  { from: ".env.example", to: ".env" },
  { from: "apps/api/.env.example", to: "apps/api/.env" },
  { from: "apps/worker/.env.example", to: "apps/worker/.env" },
  { from: "apps/web/.env.example", to: "apps/web/.env.local" },
];

for (const { from, to } of envFiles) {
  const fromPath = join(root, from);
  const toPath = join(root, to);
  if (!existsSync(fromPath)) {
    console.warn(`skip: ${from} not found`);
    continue;
  }
  if (existsSync(toPath)) {
    console.log(`skip: ${to} already exists`);
    continue;
  }
  copyFileSync(fromPath, toPath);
  console.log(`created ${to}`);
}

console.log("\nNext steps:");
console.log("  1. pnpm docker:up            # start Postgres + Redis");
console.log("  2. pnpm --filter api run prisma:migrate");
console.log("  3. pnpm dev");

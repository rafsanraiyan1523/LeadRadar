# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
# See docker/api.Dockerfile's comment on this same line — Prisma's engine
# needs a system libssl, which node:22-alpine (Alpine 3.21) doesn't ship
# by default.
RUN apk add --no-cache openssl
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter api exec prisma generate
RUN pnpm --filter @lead-radar/types run build
RUN pnpm --filter @lead-radar/providers run build
RUN pnpm --filter worker run build
# See docker/api.Dockerfile's comment on this same line for why --legacy is needed.
RUN pnpm --filter=worker deploy --prod --legacy /repo/deploy

FROM node:22-alpine AS runtime
# This stage starts fresh from node:22-alpine (not FROM base) — the worker
# uses @prisma/client at runtime (see apps/worker/src/lib/prisma.ts), so it
# needs its own libssl for the copied-in Prisma query engine binary.
RUN apk add --no-cache openssl
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /repo/deploy/dist ./dist
COPY --from=build /repo/deploy/node_modules ./node_modules
COPY --from=build /repo/deploy/package.json ./package.json

EXPOSE 4100
CMD ["node", "dist/main.js"]

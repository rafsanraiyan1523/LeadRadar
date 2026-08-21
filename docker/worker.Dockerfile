# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter api exec prisma generate
RUN pnpm --filter @lead-radar/types run build
RUN pnpm --filter @lead-radar/providers run build
RUN pnpm --filter worker run build
RUN pnpm --filter=worker deploy --prod /repo/deploy

FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /repo/deploy/dist ./dist
COPY --from=build /repo/deploy/node_modules ./node_modules
COPY --from=build /repo/deploy/package.json ./package.json

EXPOSE 4100
CMD ["node", "dist/main.js"]

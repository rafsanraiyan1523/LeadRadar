# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter api exec prisma generate
RUN pnpm --filter @lead-radar/types run build
RUN pnpm --filter @lead-radar/providers run build
RUN pnpm --filter api run build
# --legacy: pnpm v10+'s default deploy mode requires
# inject-workspace-packages=true (a repo-wide install-time behavior change
# affecting local dev too, not just this Docker build) to produce a
# self-contained output; --legacy scopes the older, non-symlink-out
# behavior to just this one command, which is all a multi-stage Docker
# build needs. Verified: the resulting node_modules/@lead-radar/* symlinks
# resolve entirely within the deploy directory itself, so they stay valid
# after the COPY into the runtime stage below.
RUN pnpm --filter=api deploy --prod --legacy /repo/deploy

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /repo/deploy/dist ./dist
COPY --from=build /repo/deploy/node_modules ./node_modules
COPY --from=build /repo/deploy/prisma ./prisma
COPY --from=build /repo/deploy/package.json ./package.json

EXPOSE 4000
# Applies any pending migrations before starting — `migrate deploy` is the
# non-interactive, production-safe Prisma command (unlike `migrate dev`, it
# never prompts and never generates new migrations, only applies existing
# ones). Safe to run on every container start/restart: a no-op once the
# schema is already current.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/main.js"]

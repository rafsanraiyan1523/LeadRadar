# LeadRadar

A lead-intelligence and prospecting tool — finds local businesses, audits their
digital presence (website, SEO, mobile, Google Business profile), scores the
opportunity, and helps draft outreach. Includes a CRM pipeline, campaigns, and an
analytics dashboard.

Runs fully in mock mode with zero external API keys/accounts needed.

## Stack

- **Frontend:** Next.js (App Router), React, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, Zustand
- **Backend:** NestJS, TypeScript, Prisma
- **Database:** PostgreSQL
- **Jobs/Queue:** Redis, BullMQ
- **Monorepo:** pnpm workspaces
- **Infra:** Docker, GitHub Actions

## Development

From the repository root:

```bash
pnpm install       # install all workspace dependencies
pnpm run build     # build shared packages + apps
pnpm run lint      # lint every workspace
pnpm run typecheck # typecheck every workspace
pnpm run test      # unit + integration tests across every workspace
```

Each app/package also exposes these individually (e.g.
`pnpm --filter api run test`) — see that workspace's own `package.json`
for its full script list.

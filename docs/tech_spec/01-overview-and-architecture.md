# Overview and Architecture

**Part of:** [Technical Spec Index](./README.md)
**PRD:** [../prd.md](../prd.md)
**Packages:** [../service-packages.md](../service-packages.md)

## 1. Overview

BASE is a single-gym, mobile-first membership and attendance management platform. It replaces a paper attendance register and manual spreadsheet tracking with a web app that lets:

- members mark attendance, view their current progress, and see renewal state
- the owner manage members, subscriptions, attendance corrections for today, and renewal follow-up

### 1.1 Product Boundaries

The MVP intentionally excludes:

- online payments
- notifications on WhatsApp/SMS/email
- backdated attendance entry or deletion
- package management through the app UI
- multi-gym support
- password reset or password change flows

### 1.2 Design Principles

The implementation should optimize for:

- mobile-first usage
- same-origin deployment from a single Cloudflare Worker
- explicit, deterministic business rules
- minimal operational complexity
- readable server-side logic over premature abstraction

### 1.3 Tech Stack

| Layer | Technology |
|---|---|
| Package manager | `npm` |
| Frontend | React + Vite |
| Routing | React Router |
| Styling | Tailwind CSS |
| Server-state | TanStack Query |
| Backend | Hono on Cloudflare Workers |
| Database | Cloudflare D1 (SQLite) |
| Hosting | Single Worker serving API + static assets |
| Testing | Vitest |

## 2. System Architecture

### 2.1 Runtime Topology

```text
Browser (mobile)
   |
   | HTTPS
   v
Cloudflare Worker
  |- /api/*  -> Hono routes
  |- /*      -> Vite build served from Worker assets
  `- DB      -> Cloudflare D1
```

The Worker is the only runtime. The frontend and backend are deployed together. There is no separate Node server, no separate CDN configuration to manage, and no separate Pages deployment.

### 2.2 Request Handling Order

The Worker handles requests in this order:

1. Match `/api/*` and route through Hono.
2. Apply auth/owner middleware only to the protected route groups.
3. For non-API `GET` requests, serve the built frontend assets.
4. For SPA deep links, fall back to `index.html`.

All `/api/*` responses must include:

- `Content-Type: application/json; charset=utf-8`
- `Cache-Control: no-store`

### 2.3 Recommended Repo Structure

```text
/
├── src/
│   ├── index.ts                 # Worker entry point
│   ├── app.ts                   # Hono app assembly
│   ├── env.ts                   # Worker env typing
│   ├── middleware/
│   │   ├── auth.ts
│   │   ├── require-member.ts
│   │   └── require-owner.ts
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── packages.ts
│   │   ├── member.ts
│   │   ├── members.ts
│   │   ├── subscriptions.ts
│   │   ├── sessions.ts
│   │   └── owner-home.ts
│   ├── services/
│   │   ├── auth-service.ts
│   │   ├── member-service.ts
│   │   ├── subscription-service.ts
│   │   ├── attendance-service.ts
│   │   └── dashboard-service.ts
│   ├── repositories/
│   │   ├── packages-repo.ts
│   │   ├── members-repo.ts
│   │   ├── subscriptions-repo.ts
│   │   ├── sessions-repo.ts
│   │   └── user-sessions-repo.ts
│   ├── lib/
│   │   ├── date.ts
│   │   ├── subscription.ts
│   │   ├── renewal.ts
│   │   └── consistency.ts
│   └── db/
│       ├── seed.sql
│       └── seed.credentials.sql   # uncommitted
├── client/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── router.tsx
│   │   ├── app-shell/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── queries/
│   │   └── lib/api.ts
│   ├── index.html
│   └── vite.config.ts
├── migrations/
│   └── 0001_initial.sql
├── docs/
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── wrangler.toml.example
```

### 2.4 Worker Environment Contract

```ts
export interface Env {
  DB: D1Database
}
```

Static assets are configured through Wrangler's `[assets]` section rather than an additional binding in code.

### 2.5 Development Workflow

Two local processes run in parallel:

1. `vite` for the client on port `5173`
2. `wrangler dev` for the Worker and local D1 on port `8787`

Vite proxies `/api` to the Worker.

### 2.6 NPM Scripts

| Script | Command | Purpose |
|---|---|---|
| `dev:client` | `vite --config client/vite.config.ts` | Run the React dev server |
| `dev:worker` | `wrangler dev` | Run Worker + local D1 |
| `build:client` | `vite build --config client/vite.config.ts` | Build the frontend |
| `deploy` | `npm run build:client && wrangler deploy` | Build and deploy |
| `test` | `vitest run` | Run all tests |
| `test:watch` | `vitest` | Run tests in watch mode |
| `db:migrate:local` | `wrangler d1 migrations apply base-gym-db --local` | Apply local migrations |
| `db:seed:local` | `wrangler d1 execute base-gym-db --local --file=src/db/seed.sql && wrangler d1 execute base-gym-db --local --file=src/db/seed.credentials.sql` | Seed local data |

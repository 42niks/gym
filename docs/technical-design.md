# Technical Design Document — Gym Management Platform (BASE)

**Status:** Draft
**Last updated:** 2026-04-07
**PRD:** [prd.md](prd.md)
**Packages:** [service-packages.md](service-packages.md)

---

## Table of Contents

1. [Overview](#1-overview)
2. [System Architecture](#2-system-architecture)
3. [Database Schema](#3-database-schema)
4. [API Design](#4-api-design)
5. [Authentication & Session Management](#5-authentication--session-management)
6. [Core Business Logic](#6-core-business-logic)
7. [Frontend Architecture](#7-frontend-architecture)
8. [Timezone Handling](#8-timezone-handling)
9. [Deployment](#9-deployment)
10. [Testing Strategy](#10-testing-strategy)
11. [Resolved Decisions](#11-resolved-decisions)

---

## 1. Overview

This is a gym membership and attendance management platform built for BASE gym. It replaces a physical attendance register and manual spreadsheet tracking with a mobile-first web application.

There are two user roles: **member** and **owner**. Members mark attendance and view their subscription and consistency progress. The owner manages member records, subscriptions, and monitors renewals.

### Tech Stack

| Layer | Technology |
|---|---|
| Package manager | npm |
| Frontend | React + Vite |
| Frontend routing | React Router |
| Backend / API | Hono on Cloudflare Workers |
| Database | Cloudflare D1 (SQLite) |
| Hosting | Cloudflare Workers (API + static assets) |

---

## 2. System Architecture

### 2.1 High-Level Overview

```
Browser (mobile)
     │
     │  HTTPS
     ▼
Cloudflare Worker  ──────────────────────────────────┐
│                                                     │
│  /api/*  →  Hono router (API handlers)              │
│  /*      →  serve React static build from Assets    │
│                                                     │
│                             D1 (SQLite database)  ◄─┘
└─────────────────────────────────────────────────────
```

The single Cloudflare Worker handles both the API and serves the React frontend's static build. The frontend is built by Vite and bundled into the Worker's static assets. No separate CDN or Pages deployment is needed.

### 2.2 Monorepo Structure

```
/
├── src/                    # Hono API (Worker entry point)
│   ├── index.ts            # Worker entry, Hono app setup
│   ├── routes/             # Route handlers
│   │   ├── auth.ts
│   │   ├── members.ts
│   │   ├── me.ts
│   │   ├── owner.ts
│   │   ├── subscriptions.ts
│   │   ├── sessions.ts
│   │   └── packages.ts
│   ├── middleware/
│   │   ├── auth.ts         # Session validation middleware
│   │   └── role.ts         # Role guard middleware
│   ├── lib/
│   │   ├── consistency.ts  # Consistency evaluation logic
│   │   ├── subscription.ts # Lifecycle derivation, end date calc
│   │   ├── renewal.ts      # Renewal message logic
│   │   └── date.ts         # IST-aware date utilities
│   └── db/
│       ├── schema.sql       # Migration file
│       └── seed.sql         # Package seed (committed)
│       └── seed.credentials.sql   # Owner + initial member (NOT committed)
├── client/                 # React + Vite frontend
│   ├── src/
│   │   ├── main.tsx
│   │   ├── router.tsx
│   │   ├── pages/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── lib/
│   ├── index.html
│   └── vite.config.ts
├── wrangler.toml
└── package.json
```

The repo uses a single root `package.json` for MVP simplicity. The frontend build targets `client/`, and Worker commands are run from the root.

---

## 3. Database Schema

All dates are stored as `TEXT` in `YYYY-MM-DD` format in IST. All datetimes are stored as UTC `TEXT` in SQLite `datetime('now')` format (`YYYY-MM-DD HH:MM:SS`).

### 3.1 Tables

```sql
-- Seeded package definitions. Not editable through the app UI.
-- Backend/database edits are limited to consistency-rule changes.
-- Price, duration, service type, and session-count changes are introduced as new rows.
CREATE TABLE packages (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  service_type            TEXT    NOT NULL,  -- '1:1 Personal Training' | 'MMA/Kickboxing Personal Training' | 'Group Personal Training'
  sessions                INTEGER NOT NULL,
  duration_months         INTEGER NOT NULL,
  price                   INTEGER NOT NULL,  -- INR, whole number
  consistency_window_days INTEGER NOT NULL,  -- rolling window in calendar days
  consistency_min_days    INTEGER NOT NULL,  -- min exercise days within window
  UNIQUE (service_type, sessions, duration_months, price)
);

-- Both owner and members are stored in this table.
-- The owner has role = 'owner'; all others have role = 'member'.
CREATE TABLE members (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  role       TEXT    NOT NULL DEFAULT 'member',  -- 'member' | 'owner'
  full_name  TEXT    NOT NULL,
  email      TEXT    NOT NULL,                   -- stored lowercase; unique enforced
  phone      TEXT    NOT NULL,                   -- also serves as login password
  join_date  TEXT    NOT NULL,                   -- YYYY-MM-DD IST; set at creation
  status     TEXT    NOT NULL DEFAULT 'active',  -- 'active' | 'archived'
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_members_email ON members (LOWER(email));

-- A member-specific instance of a package.
CREATE TABLE subscriptions (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id        INTEGER NOT NULL REFERENCES members(id),
  package_id       INTEGER NOT NULL REFERENCES packages(id),
  start_date       TEXT    NOT NULL,  -- YYYY-MM-DD IST
  end_date         TEXT    NOT NULL,  -- YYYY-MM-DD IST; derived at creation
  total_sessions   INTEGER NOT NULL,
  attended_sessions INTEGER NOT NULL DEFAULT 0,
  amount           INTEGER NOT NULL,  -- INR; snapshot of package price at creation
  owner_completed  INTEGER NOT NULL DEFAULT 0,  -- 0 = false, 1 = true
  created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_subscriptions_member_id ON subscriptions(member_id);

-- One attendance record per member per calendar day.
CREATE TABLE sessions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id       INTEGER NOT NULL REFERENCES members(id),
  subscription_id INTEGER NOT NULL REFERENCES subscriptions(id),
  date            TEXT    NOT NULL,  -- YYYY-MM-DD IST
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (member_id, date)
);

CREATE INDEX idx_sessions_member_id ON sessions(member_id);

-- Login sessions.
CREATE TABLE user_sessions (
  id         TEXT    PRIMARY KEY,  -- UUID v4
  member_id  INTEGER NOT NULL REFERENCES members(id),
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT    NOT NULL
);
```

### 3.2 Derived / Not Stored

The following are computed at query time and never persisted:

| Concept | Derived from |
|---|---|
| Subscription lifecycle state (`active` / `upcoming` / `completed`) | `start_date`, `end_date`, `owner_completed`, `remaining_sessions`, current IST date |
| Remaining sessions | `total_sessions - attended_sessions` |
| Consistency status | Full attendance history + active package rule + current IST date |
| Renewal message | Active and upcoming subscription state |

### 3.3 Seed Data

**`seed.sql` (committed):** All package definitions from `service-packages.md`. This seed must be idempotent.

```sql
INSERT OR IGNORE INTO packages (service_type, sessions, duration_months, price, consistency_window_days, consistency_min_days) VALUES
  ('1:1 Personal Training',             8,  1, 19900, 7, 2),
  ('1:1 Personal Training',            12,  1, 29500, 7, 3),
  ('1:1 Personal Training',            24,  3, 59000, 7, 2),
  ('1:1 Personal Training',            36,  3, 85800, 7, 3),
  ('MMA/Kickboxing Personal Training',  4,  1,  9600, 7, 1),
  ('MMA/Kickboxing Personal Training',  8,  1, 18800, 7, 2),
  ('MMA/Kickboxing Personal Training', 12,  1, 26400, 7, 3),
  ('Group Personal Training',          12,  1, 14500, 7, 3),
  ('Group Personal Training',          16,  1, 18900, 7, 4),
  ('Group Personal Training',          36,  3, 42000, 7, 3),
  ('Group Personal Training',          48,  3, 54000, 7, 4),
  ('Group Personal Training',          16,  2, 22800, 7, 2),
  ('Group Personal Training',          30,  4, 42500, 7, 2),
  ('Group Personal Training',          40,  5, 56000, 7, 2);
```

**`seed.credentials.sql` (NOT committed, gitignored):** Owner account and one initial member. The same file is used across local development, automated test setup, and production.

```sql
INSERT INTO members (role, full_name, email, phone, join_date) VALUES
  ('owner', '<owner name>', '<owner email>', '<owner phone>', '<today>'),
  ('member', '<member name>', '<member email>', '<member phone>', '<today>');
```

---

## 4. API Design

Base path: `/api`

All responses use JSON. Error responses follow the shape:
```json
{ "error": "human-readable message" }
```

Successful responses return the relevant resource or `{ "ok": true }` for mutations with no meaningful return body.

### 4.1 Auth

| Method | Path | Auth required | Description |
|---|---|---|---|
| POST | `/api/auth/login` | No | Log in with email + password |
| POST | `/api/auth/logout` | Yes | Invalidate session |
| GET | `/api/auth/me` | Yes | Return current user's role and basic info |

**POST /api/auth/login**
```json
// Request
{ "email": "user@example.com", "password": "0987654321" }

// Response 200
{ "id": 1, "role": "member", "full_name": "Riya Patel", "email": "user@example.com" }

// Response 401
{ "error": "Invalid email or password" }
```

### 4.2 Packages

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/packages` | Yes | List all packages grouped by service type |

### 4.3 Members

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/members` | Owner | List all members (non-archived by default) |
| GET | `/api/me/profile` | Member | Get the logged-in member's profile |
| GET | `/api/me/home` | Member | Get member home-screen state |
| POST | `/api/members` | Owner | Create a new member |
| GET | `/api/members/:id` | Owner | Get owner-facing member detail |
| PATCH | `/api/members/:id` | Owner | Update `full_name` and/or `phone` |
| POST | `/api/members/:id/archive` | Owner | Archive a member |

**GET /api/members query params:**
- `?status=active` — return active members (default)
- `?status=archived` — return archived members instead

**POST /api/members request body:**
```json
{ "full_name": "Riya Patel", "email": "riya@example.com", "phone": "9876543210" }
```

**GET /api/me/home response:**
```json
{
  "member": {
    "id": 1,
    "full_name": "Riya Patel",
    "email": "riya@example.com",
    "phone": "9876543210",
    "join_date": "2026-04-07",
    "status": "active"
  },
  "active_subscription": { ... } | null,
  "consistency": { "status": "consistent", "days": 14 } | { "status": "building" } | null,
  "renewal_message": "Your subscription ends soon, please renew." | null,
  "marked_attendance_today": false
}
```

**GET /api/members/:id response:**
```json
{
  "id": 1,
  "full_name": "Riya Patel",
  "email": "riya@example.com",
  "phone": "9876543210",
  "join_date": "2026-04-07",
  "status": "active",
  "active_subscription": { ... } | null,
  "consistency": { "status": "consistent", "days": 14 } | { "status": "building" } | null,
  "renewal_message": "Your subscription ends soon, please renew." | null,
  "marked_attendance_today": false
}
```

### 4.4 Subscriptions

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/me/subscriptions` | Member | List the logged-in member's subscriptions |
| GET | `/api/members/:id/subscriptions` | Owner | List all subscriptions for a member |
| POST | `/api/members/:id/subscriptions` | Owner | Create a subscription |
| POST | `/api/subscriptions/:id/complete` | Owner | Mark subscription as completed |

**POST /api/members/:id/subscriptions request body:**
```json
{ "package_id": 3, "start_date": "2026-04-10" }
```

**Subscription object shape:**
```json
{
  "id": 7,
  "package_id": 3,
  "service_type": "1:1 Personal Training",
  "start_date": "2026-04-10",
  "end_date": "2026-05-09",
  "total_sessions": 12,
  "attended_sessions": 4,
  "remaining_sessions": 8,
  "amount": 29500,
  "owner_completed": false,
  "lifecycle_state": "active"
}
```

### 4.5 Sessions (Attendance)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/me/sessions` | Member | Mark attendance for today |
| POST | `/api/members/:id/sessions` | Owner | Mark attendance for a member for today |

**Attendance mutation contract:** no body required; date is always today in IST.

### 4.6 Owner Dashboard

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/owner/dashboard` | Owner | Return all owner home/renewal screen sections |

**GET /api/owner/dashboard response:**
```json
{
  "renewal_no_active": [
    {
      "member_id": 3,
      "full_name": "Asha Singh",
      "status": "active",
      "earliest_upcoming_start_date": null,
      "renewal_message": "You have no active subscription, please activate."
    }
  ],
  "renewal_nearing_end": [
    {
      "member_id": 4,
      "full_name": "Kabir Shah",
      "status": "active",
      "active_subscription": { ... },
      "renewal_message": "Your subscription ends soon, please renew."
    }
  ],
  "checked_in_today": [
    {
      "member_id": 4,
      "full_name": "Kabir Shah",
      "marked_attendance_today": true,
      "consistency": { "status": "consistent", "days": 14 }
    }
  ],
  "active_members": [
    {
      "member_id": 4,
      "full_name": "Kabir Shah",
      "status": "active",
      "active_subscription": { ... } | null,
      "consistency": { "status": "consistent", "days": 14 } | { "status": "building" } | null,
      "marked_attendance_today": true
    }
  ],
  "archived_members": [
    {
      "member_id": 8,
      "full_name": "Neha Rao",
      "status": "archived",
      "marked_attendance_today": false
    }
  ]
}
```

---

## 5. Authentication & Session Management

### 5.1 Mechanism

Cookie-based sessions. On successful login, a UUID session token is issued as an `HttpOnly`, `SameSite=Strict` cookie. The session record is stored in the `user_sessions` D1 table.

**Rationale for D1 over KV:** Keeps the data layer to a single binding for MVP simplicity. KV has better read latency at edge scale, but that is not a concern for a single-gym app.

### 5.2 Session Lifetime

- Sessions expire after **10 days** of inactivity.
- `expires_at` is updated on each authenticated request (sliding expiry).

### 5.3 Middleware

Two Hono middleware functions protect all `/api` routes (except `/api/auth/login`):

1. **`authMiddleware`** — reads the session cookie, looks up `user_sessions`, joins to `members`, validates expiry, and confirms the user is still allowed to access the product. If the member record is archived, the middleware deletes the session, clears the cookie, and returns `401`. On success it attaches `{ member_id, role, status }` to context.
2. **`requireOwner`** — returns `403` if `role !== 'owner'`. Applied to owner-only routes.

When the owner archives a member, the archive mutation must also delete all rows from `user_sessions` for that member so existing sessions are revoked immediately.

### 5.4 Password Model

No separate password field. A user's `phone` value is their password for both members and the owner. Authentication compares `submitted_password === member.phone` directly (plaintext comparison as specified by PRD).

> **Note:** If hashing is desired in future, it can be added as a migration without interface changes.

---

## 6. Core Business Logic

### 6.1 Subscription End Date Calculation

Given `start_date` (YYYY-MM-DD) and `duration_months` (integer):

1. Add `duration_months` calendar months to `start_date`. If the resulting day does not exist (e.g., 31 Jan + 1 month → no 31 Feb), clamp to the last valid day of that month.
2. Subtract 1 day. That is the `end_date`.

```
start = 2026-04-07, duration = 1 month
target = 2026-05-07
end_date = 2026-05-06  ✓

start = 2026-01-31, duration = 1 month
target = 2026-02-31 → clamped to 2026-02-28
end_date = 2026-02-27  ✓
```

### 6.2 Subscription Lifecycle Derivation

Evaluated at query time using IST today's date:

```
remaining_sessions = total_sessions - attended_sessions

state =
  if owner_completed                          → "completed"
  else if today > end_date                    → "completed"
  else if remaining_sessions == 0             → "completed"
  else if start_date > today                  → "upcoming"
  else /* start_date <= today <= end_date
          and remaining_sessions > 0
          and not owner_completed */          → "active"
```

### 6.3 Subscription Overlap Validation

When creating a new subscription for a member, reject if any **active or upcoming** subscription for that member satisfies:

```
new.start_date <= existing.end_date  AND  new.end_date >= existing.start_date
```

Additionally, boundary overlap is also rejected:

```
new.start_date == existing.end_date  →  reject (inclusive boundary)
```

Only `active` and `upcoming` subscriptions are checked. Completed subscriptions are excluded.

### 6.4 Renewal Message Logic

Evaluated using IST today's date. Checked in order:

```
1. Find active subscription (if any).
2. Find upcoming subscriptions (ordered by start_date ASC).
3. nearing_end = active exists AND (remaining_sessions < 3 OR days_until_end <= 4)

Message:
  if nearing_end AND no upcoming         → "Your subscription ends soon, please renew."
  else if no active AND upcoming exists  → "Your subscription starts on [earliest upcoming start_date]."
  else if no active AND no upcoming      → "You have no active subscription, please activate."
  else                                   → (no message)
```

`days_until_end = end_date - today` (both in IST). "Fewer than 5 days remain" = `days_until_end <= 4`.

### 6.5 Consistency Evaluation

**Inputs:**
- `attendance_dates`: all attended dates for the member across all subscriptions (sorted ascending), in IST
- `earliest_subscription_start`: earliest `start_date` across all the member's subscriptions
- Active package rule: `window_days` (always 7 for current packages), `min_days`
- `today`: current IST date

**Algorithm:**

```
Step 1 — Eligibility check
  if (today - earliest_subscription_start) < window_days:
    return { status: "building" }

Step 2 — Find the current continuous consistent suffix
  streak = 0
  d = today
  first_eligible_day = earliest_subscription_start + window_days
  while d >= first_eligible_day:
    window_start = d - (window_days - 1)
    attended_in_window = count of attendance_dates in [window_start, d]
    if attended_in_window >= min_days:
      streak += 1
      d -= 1 day
    else:
      break

Step 3 — Threshold check
  if streak >= window_days:
    return { status: "consistent", days: streak }
  else:
    return { status: "building" }
```

**Output messages:**
- `consistent` → "You have been consistent for the last {days} days"
- `building` → "You are building your consistency, keep it up!"

> **Note:** The consistency rule used is always the rule of the **currently active package** at the time of evaluation. It is never snapshotted per subscription.

### 6.6 Nearing-End Renewal Threshold (Owner View)

A member appears in the owner's renewal list if:
- They have an active subscription with `remaining_sessions < 3` OR `days_until_end <= 4`
- AND they have no upcoming subscription

### 6.7 Attendance Write Semantics

Attendance creation is a single transaction:

1. Load the member and the currently active subscription for today's IST date.
2. Reject if the member is archived, has no active subscription, or already has a session for today.
3. Insert the `sessions` row for `(member_id, subscription_id, today)`.
4. Increment `subscriptions.attended_sessions` by 1 for that active subscription.
5. Commit.

If any step fails, the transaction is rolled back. The API treats duplicate same-day attendance as a rejected mutation and must not partially update subscription counters.

### 6.8 Package Mutation Policy

Package definitions are immutable from the app UI. Operational backend/database changes follow these rules:

- `consistency_window_days` and `consistency_min_days` may be updated directly, and those changes retroactively affect current consistency evaluation for members on that package
- `price`, `duration_months`, `service_type`, and `sessions` are not edited in place for business changes; a new package row is inserted instead
- package rows are not deleted in MVP

---

## 7. Frontend Architecture

### 7.1 Route Structure

```
/                     → LoginPage (unauthenticated only)

/home                 → MemberHomePage
/billing              → MemberBillingPage
/profile              → MemberProfilePage

/owner                → OwnerHomePage
/owner/renewal        → OwnerRenewalPage
/owner/members        → OwnerMemberListPage
/owner/members/new    → OwnerCreateMemberPage
/owner/members/:id    → OwnerMemberDetailPage
/owner/members/:id/subscriptions/new  → OwnerCreateSubscriptionPage
```

### 7.2 Auth Context

A top-level `AuthProvider` wraps the app. On mount it calls `GET /api/auth/me`:
- If 200 → populate context with `{ id, role, full_name, email }` and route to the correct shell.
- If 401 → redirect to `/`.

Role-based layout shells:
- `MemberShell` — drawer navigation (Profile, Billing history)
- `OwnerShell` — tab or nav structure across Home, Members, Renewal

### 7.3 Data Fetching

TanStack Query is used for all server-state fetching and mutations. It keeps the UI consistent after attendance, subscription, and member-management mutations without custom cache plumbing.

Key cache invalidations:
- After marking attendance → invalidate member home + subscription detail
- After subscription create/complete → invalidate member subscriptions + owner member list
- After member create/update/archive → invalidate member list

### 7.4 Member Home Screen Layout

Per PRD §10.3, sections rendered in this order:

1. Renewal message banner (if applicable)
2. Consistency message
3. Mark attendance action (primary CTA, prominently sized)

The attendance button states:
- **Active, not yet marked today** → enabled, primary style
- **Already marked today** → disabled, with "Attendance marked for today" label
- **No active subscription** → disabled, with contextual message
- **Archived** → disabled (member cannot log in; this state is unreachable in practice)

### 7.5 Owner Home Screen Layout

Per PRD §10.3, sections rendered in this order:

1. Renewal section: members with no active subscription + members nearing renewal
2. Consistency section: members who have marked attendance today + their consistency label
3. Full member list (non-archived, alphabetical; toggle to show archived)
4. Create new member action

### 7.6 Key Component Boundaries

| Component | Responsibility |
|---|---|
| `AttendanceButton` | Handles mark attendance mutation + disabled states |
| `ConsistencyBadge` | Renders "Consistent: Xd" or "Building consistency" |
| `RenewalBanner` | Renders the appropriate renewal message string |
| `SubscriptionCard` | Shows total / attended / remaining sessions + lifecycle state |
| `SubscriptionList` | Splits subscriptions into completed+active (reverse chron) and upcoming (chron) sections |
| `MemberRow` (owner) | Compact row: name, active sub progress, consistency label |
| `ConfirmDialog` | Reusable confirmation modal for destructive actions |

---

## 8. Timezone Handling

All date logic uses **Asia/Kolkata (IST, UTC+5:30)**.

### 8.1 Rule of Thumb

| Location | Responsibility |
|---|---|
| API layer | All date comparisons (today, subscription bounds, attendance uniqueness) use IST date derived from the request timestamp |
| Database | Dates stored as plain `YYYY-MM-DD` text, always in IST |
| Frontend | Display dates as-is from the API (already IST); no client-side timezone conversion |

### 8.2 Getting IST "Today" on the Worker

```ts
function getISTDate(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const get = (type: string) => parts.find(p => p.type === type)!.value
  return `${get('year')}-${get('month')}-${get('day')}` // YYYY-MM-DD
}
```

This is used everywhere a "today" date is needed on the server.

---

## 9. Deployment

### 9.1 Wrangler Config (`wrangler.toml`)

`wrangler.toml` is **not committed to version control** as it contains environment-specific values (database ID, worker name). A `wrangler.toml.example` is committed as a reference template.

```toml
# wrangler.toml.example — copy to wrangler.toml and fill in values
name = "<worker-name>"
main = "src/index.ts"
compatibility_date = "2025-01-01"

[assets]
directory = "./client/dist"

[[d1_databases]]
binding = "DB"
database_name = "<d1-database-name>"
database_id = "<d1-database-id>"
```

### 9.2 Local Development

```bash
# Install dependencies
npm install

# Run Vite dev server (frontend)
npm run dev:client

# Run Wrangler dev (Worker + D1 local)
npm run dev:worker

# Apply migrations
npx wrangler d1 migrations apply base-gym-db --local

# Seed packages
npx wrangler d1 execute base-gym-db --local --file=src/db/seed.sql

# Seed owner + initial member (same uncommitted credentials seed used across environments)
npx wrangler d1 execute base-gym-db --local --file=src/db/seed.credentials.sql
```

### 9.3 Production Deployment

```bash
# Apply additive migrations to production D1
npx wrangler d1 migrations apply base-gym-db

# Seed packages (idempotent)
npx wrangler d1 execute base-gym-db --file=src/db/seed.sql

# Seed owner + initial member (same uncommitted credentials seed used across environments)
npx wrangler d1 execute base-gym-db --file=src/db/seed.credentials.sql

# Build frontend
npm run build:client

# Deploy worker (includes static assets)
npx wrangler deploy
```

For existing environments, rollout steps must remain backward-compatible: apply additive schema changes first, deploy code that works with both old and new data where necessary, and only then remove deprecated paths in a later migration.

### 9.4 `.gitignore` Additions

```
wrangler.toml
src/db/seed.credentials.sql
.dev.vars
```

---

## 10. Testing Strategy

### 10.1 Unit Tests (Vitest)

Pure logic functions with no I/O dependencies. These are the highest priority to test given the business rule complexity.

| Module | Test cases |
|---|---|
| `lib/subscription.ts` — end date calc | 1 month from mid-month, 1 month from Jan 31, 3 months, month-end edge cases |
| `lib/subscription.ts` — lifecycle derivation | all state transitions including `owner_completed`, `remaining_sessions = 0`, boundary dates |
| `lib/subscription.ts` — overlap validation | no overlap, adjacent (boundary), partial overlap, new inside existing, completed excluded |
| `lib/consistency.ts` | below eligibility threshold, exactly at threshold, consistent streak, streak broken, cross-subscription attendance |
| `lib/renewal.ts` | all 5 message conditions including boundary values for session and day thresholds |
| `lib/date.ts` | IST date extraction from various UTC timestamps around IST midnight |

### 10.2 Integration Tests

API route tests against a local D1 instance using Wrangler's test environment.

Priority flows:
- Login → session cookie → authenticated request → logout
- Owner creates member → member logs in
- Owner creates subscription → member marks attendance → session counts update
- Overlap rejection on subscription creation
- Archive rejection when active subscription exists
- Owner marks subscription complete → subsequent subscription on same day allowed

### 10.3 End-to-End (Optional for MVP)

Manual test checklist covering the core user flows in PRD §9 is sufficient for MVP. Automated E2E (Playwright) can be added post-launch.

---

## 11. Resolved Decisions

## 11. Resolved Decisions

| Area | Decision |
|---|---|
| Session storage | D1 table for MVP simplicity |
| Frontend hosting | Single Worker serves API and static assets |
| Data fetching | TanStack Query |
| Session expiry | Sliding expiry, 10 days of inactivity |
| Repo structure | Single root `package.json` |
| Phone storage | Stored as provided; no normalization in MVP |
| Owner password model | Owner password is also `phone` |
| Credentials seed | One uncommitted credentials seed reused across local, test, and production |
| Package mutation policy | UI-immutable; backend consistency-rule edits allowed; price/duration/service/session changes use new rows |

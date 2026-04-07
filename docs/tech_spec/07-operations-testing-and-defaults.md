# Operations, Testing, and Defaults

**Part of:** [Technical Spec Index](./README.md)
**PRD:** [../prd.md](../prd.md)

## 8. Deployment & Operations

### 8.1 Wrangler Configuration

`wrangler.toml` is not committed. `wrangler.toml.example` is committed.

```toml
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

### 8.2 Local Setup

```bash
npm install
npm run db:migrate:local
npm run db:seed:local
npm run dev:client
npm run dev:worker
```

### 8.3 Production Rollout

```bash
npx wrangler d1 migrations apply base-gym-db
npx wrangler d1 execute base-gym-db --file=src/db/seed.sql
npx wrangler d1 execute base-gym-db --file=src/db/seed.credentials.sql
npm run deploy
```

Rollout order:

1. apply additive migrations
2. run idempotent seeds
3. deploy Worker

### 8.4 `.gitignore`

```gitignore
node_modules/
wrangler.toml
src/db/seed.credentials.sql
.dev.vars
.wrangler/
client/dist/
```

### 8.5 Migration Policy

- migrations are forward-only
- never edit an already-applied migration
- schema removals happen only in a later migration after compatible code is deployed

## 9. Testing Strategy

### 9.1 Unit Tests

Highest-priority pure logic coverage:

| Module | Cases |
|---|---|
| `lib/date.ts` | IST extraction around midnight, date add/subtract, month clamp, human formatting |
| `lib/subscription.ts` | end-date derivation, lifecycle states, overlap detection |
| `lib/renewal.ts` | all renewal branches and threshold boundaries |
| `lib/consistency.ts` | below eligibility, exactly eligible, long streak, streak break, cross-subscription history |

### 9.2 Integration Tests

Priority route flows:

- login -> authenticated request -> logout
- owner creates member -> member logs in
- owner creates subscription -> member marks attendance -> counters update
- overlap rejection on subscription creation
- archive rejection when active/upcoming subscription exists
- owner completes subscription -> same-day replacement subscription succeeds
- owner marks attendance for member
- archived member session is revoked on next protected request

### 9.3 Seed Strategy In Tests

Automated tests must not depend on the uncommitted `seed.credentials.sql` file.

Instead:

- package seed can be reused from committed SQL
- tests should insert deterministic throwaway owner/member rows in setup helpers

This keeps CI deterministic without depending on local or production credentials.

### 9.4 Manual MVP Checklist

- Member can log in, mark attendance, and see the button disable for the day.
- Member sees the correct renewal state in all three message branches.
- Owner can create, archive, and re-activate a member through subscription creation.
- Owner can complete a subscription and immediately create a replacement starting the same day.
- Owner dashboard ordering matches the spec.

## 10. Defaults Resolved In This Revision

The following choices were previously implicit and are now fixed for MVP:

1. `POST /api/auth/logout` is idempotent and does not require a valid session.
2. `renewal` and `consistency` are structured payloads, not bare strings.
3. Input normalization trims all user-entered strings; only `email` is lowercased.
4. Updating a member's `phone` changes future logins but does not revoke existing sessions.
5. Package rows are immutable in-app; only consistency fields may be edited outside the app.
6. Deterministic sort order always includes an `id` tiebreaker.
7. Credentials seed files are idempotent for operational safety.
8. Automated tests use fixture users instead of relying on the uncommitted credentials seed.
9. Same-day subscription replacement after manual completion is explicitly supported.
10. `marked_attendance_today` is derived solely from today's session row, independent of current lifecycle state.
11. `checked_in_today` may rarely contain `consistency: null` if a member checked in earlier today and the owner later completed the subscription; this is accepted because consistency is defined only when an active subscription exists.

No additional product decisions are required before implementation starts.

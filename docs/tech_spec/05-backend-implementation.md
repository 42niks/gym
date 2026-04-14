# Backend Implementation

**Part of:** [Technical Spec Index](./README.md)
**PRD:** [../prd.md](../prd.md)

## 6. Backend Implementation Plan

### 6.1 Layer Responsibilities

#### Routes

Routes should:

- parse params/body/query
- call a service
- map known errors to HTTP status codes
- set cookies when needed
- never contain business logic loops or raw SQL beyond trivial read-only cases

#### Services

Services should:

- orchestrate transactions
- enforce business invariants
- use repository helpers
- return canonical DTOs

#### Repositories

Repositories should:

- contain prepared SQL statements
- return row-shaped data only
- avoid date math and lifecycle derivation logic

#### `lib/*`

Pure helpers for:

- date math
- lifecycle derivation
- overlap checks
- renewal logic
- consistency evaluation

### 6.2 Middleware

#### `authMiddleware`

Behavior:

1. Read `session_id` cookie.
2. If missing, return `401`.
3. Load `user_sessions` + `members`.
4. If no row, expired row, or archived member:
   - delete session row if it exists
   - clear cookie
   - return `401`
5. Otherwise:
   - compute new expiry = `now + 10 days`
   - update `user_sessions.expires_at`
   - refresh the cookie with the same expiry
   - attach `user = { member_id, role, status }` to the Hono context

#### `requireOwner`

- Return `403` if `ctx.var.user.role !== 'owner'`.

#### `requireMember`

- Return `403` if `ctx.var.user.role !== 'member'`.

Route protection:

- `/api/member/*` -> `authMiddleware` + `requireMember`
- `/api/packages` -> `authMiddleware` + `requireOwner`
- `/api/owner/*` and owner management routes -> `authMiddleware` + `requireOwner`

### 6.3 Cookie and Session Strategy

Session expiry is sliding and server authoritative.

This means every successful protected request must refresh both:

- `user_sessions.expires_at` in D1
- the browser cookie expiry

If only the database expiry is refreshed, the browser cookie may expire early. If only the cookie is refreshed, the database session may expire early. Both must move together.

### 6.4 SQL Access Rules

- Use prepared statements exclusively.
- Never interpolate user input into SQL strings.
- Read-after-write responses should fetch the canonical row from the database rather than rebuilding the response from the request body.
- Deterministic sorting must always include an `id` tiebreaker.

### 6.5 Route-to-Service Mapping

| Route module | Service(s) |
|---|---|
| `routes/auth.ts` | `auth-service.ts` |
| `routes/packages.ts` | `packages-repo.ts` or small service |
| `routes/member.ts` | `member-service.ts`, `subscription-service.ts`, `attendance-service.ts` |
| `routes/members.ts` | `member-service.ts`, `subscription-service.ts`, `attendance-service.ts` |
| `routes/subscriptions.ts` | `subscription-service.ts` |
| `routes/sessions.ts` | `attendance-service.ts` |
| `routes/owner-home.ts` | `dashboard-service.ts` |

### 6.6 Dashboard Assembly

`dashboard-service.ts` should produce all owner home/renewal sections in one call.

Because this is a single-gym MVP with a small dataset:

- a single service method may issue multiple focused queries
- no pagination is required
- no denormalized materialized table is required

### 6.7 Asset Serving

Implementation requirement:

- `/api/*` must never fall through to the asset handler
- non-API SPA routes must return `index.html`

This is necessary so direct visits to `/owner/members/12` load the frontend app rather than a `404`.

### 6.8 Security Posture

MVP security choices:

- cookie-based auth with `SameSite=Strict`
- same-origin frontend and API
- no CORS support needed
- no CSRF token in MVP because there is no cross-site form usage and requests originate from the same deployed app

Known limitation accepted by PRD:

- passwords are effectively stored in plaintext because `phone` is the password

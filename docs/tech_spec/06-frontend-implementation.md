# Frontend Implementation

**Part of:** [Technical Spec Index](./README.md)
**PRD:** [../prd.md](../prd.md)

## 7. Frontend Implementation Plan

### 7.1 Route Tree

```text
/                               -> LoginPage

/home                           -> MemberHomePage
/billing                        -> MemberBillingPage
/profile                        -> MemberProfilePage

/owner                          -> OwnerHomePage
/owner/renewal                  -> OwnerRenewalPage
/owner/members                  -> OwnerMemberListPage
/owner/members/new              -> OwnerCreateMemberPage
/owner/members/:id              -> OwnerMemberDetailPage
/owner/members/:id/subscriptions/new
                                -> OwnerCreateSubscriptionPage
```

### 7.2 Route Guards

- Public route `/` redirects authenticated users to their role-specific home.
- Member routes require authenticated `role = member`.
- Owner routes require authenticated `role = owner`.
- Any `401` from the API clears auth state and redirects to `/`.

### 7.3 Auth Bootstrap

`AuthProvider` should call `GET /api/auth/me` once on app startup.

States:

- loading -> hold route rendering behind a splash/spinner
- authenticated -> store `{ id, role, full_name, email }`
- unauthenticated -> route to `/`

### 7.4 Shared API Client

`client/src/lib/api.ts` should:

- send `credentials: 'include'`
- set `Content-Type: application/json` for JSON requests
- parse JSON success and error bodies
- throw a typed error object containing `status` and `message`
- redirect on `401`

### 7.5 Query Keys

Recommended keys:

- `['auth-me']`
- `['packages']`
- `['me-profile']`
- `['me-home']`
- `['me-subscriptions']`
- `['members', status]`
- `['member', id]`
- `['member-subscriptions', id]`
- `['owner-dashboard']`

### 7.6 Mutation Invalidation

| Mutation | Invalidate |
|---|---|
| login / logout | `['auth-me']` and route redirect |
| member marks attendance | `['me-home']`, `['me-subscriptions']`, `['owner-dashboard']`, `['members', 'active']` |
| owner marks attendance | `['member', id]`, `['member-subscriptions', id]`, `['owner-dashboard']`, `['members', 'active']` |
| create member | `['members', 'active']`, `['owner-dashboard']` |
| update member | `['member', id]`, `['members', 'active']`, `['members', 'archived']`, `['owner-dashboard']` |
| archive member | `['member', id]`, `['members', 'active']`, `['members', 'archived']`, `['owner-dashboard']` |
| create subscription | `['member', id]`, `['member-subscriptions', id]`, `['members', 'active']`, `['members', 'archived']`, `['owner-dashboard']` |
| complete subscription | same as create subscription |

### 7.7 Page Data Responsibilities

| Page | Primary API calls |
|---|---|
| `LoginPage` | `POST /api/auth/login` |
| `MemberHomePage` | `GET /api/me/home`, `POST /api/me/sessions` |
| `MemberBillingPage` | `GET /api/me/subscriptions` |
| `MemberProfilePage` | `GET /api/me/profile` |
| `OwnerHomePage` | `GET /api/owner/dashboard` |
| `OwnerRenewalPage` | `GET /api/owner/dashboard` |
| `OwnerMemberListPage` | `GET /api/members?status=active|archived` |
| `OwnerCreateMemberPage` | `POST /api/members` |
| `OwnerMemberDetailPage` | `GET /api/members/:id`, `GET /api/members/:id/subscriptions` |
| `OwnerCreateSubscriptionPage` | `GET /api/packages`, `POST /api/members/:id/subscriptions` |

### 7.8 UI Behavior

#### Member Home

Render order:

1. renewal banner
2. consistency message
3. attendance CTA

Attendance button states:

- active + not marked today -> enabled
- already marked -> disabled with explanation
- no active subscription -> disabled with explanation

#### Owner Home

Render order:

1. renewal-related sections
2. checked-in-today section
3. member lists
4. create-member action

#### Risky Actions

Both require confirmation dialogs:

- archive member
- complete subscription

### 7.9 Form Defaults

- login field labels stay `Username` and `Password`
- create subscription defaults `start_date` to today's IST date
- package selection UI groups packages by `service_type`
- create/update member forms trim inputs before submit

### 7.10 Date Display

The frontend should not perform timezone conversion on server dates.

Display rule:

- API provides canonical `YYYY-MM-DD`
- UI may format for presentation, but must treat the string as an IST local date

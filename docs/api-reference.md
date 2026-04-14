# API Reference

This document reflects the backend routes currently implemented in:

- `src/app.ts`
- `src/server/test-routes.ts`

## Conventions

- Base path: all routes are rooted at `/api/...`
- Authenticated routes use the `session_id` HTTP-only cookie
- Dates use `YYYY-MM-DD`
- Money is stored as integer INR amounts
- Standard error payload:

```json
{
  "error": "Human-readable message"
}
```

## Common Access Rules

### Authenticated routes

- Require a valid `session_id` cookie
- Return `401 { "error": "Not authenticated" }` when:
  - the cookie is missing
  - the session does not exist
  - the session is expired
  - the session belongs to an archived user

### Owner-only routes

- First require authentication
- Then require `role === "owner"`
- Return `403 { "error": "Forbidden" }` for authenticated non-owners

### Member-only routes

- First require authentication
- Then require `role === "member"`
- Return `403 { "error": "Forbidden" }` for authenticated non-members

## Production API

### POST `/api/auth/login`

- Access: Public
- Description: Logs a member or owner in and sets the `session_id` cookie.
- Expected input:
  - JSON body:

```json
{
  "email": "owner@thebase.fit",
  "password": "9999999999"
}
```

- Validation:
  - Body must be valid JSON, else `400 Invalid JSON body`
  - `email` must be a string; it is trimmed and lowercased
  - `email` is required, else `400 Email is required`
  - `password` must be a string; it is trimmed
  - `password` is required unless the app is started with `allowPasswordlessLogin`, else `400 Password is required`
  - Unknown email, archived member, or password mismatch returns `401 Invalid email or password`
- Sample response:

```json
{
  "id": 1,
  "role": "owner",
  "full_name": "Sam Chen",
  "email": "owner@thebase.fit"
}
```

### POST `/api/auth/logout`

- Access: Public
- Description: Deletes the current session cookie and invalidates the current session if present.
- Expected input:
  - No body
  - Optional `session_id` cookie
- Validation:
  - No request validation
  - Missing cookie still returns success
- Sample response:

```json
{
  "ok": true
}
```

### GET `/api/auth/me`

- Access: Authenticated
- Description: Returns the currently authenticated user.
- Expected input:
  - No body
  - Valid `session_id` cookie
- Validation:
  - Common authenticated-route checks apply
  - If the underlying member row cannot be found, returns `401 Not authenticated`
- Sample response:

```json
{
  "id": 2,
  "role": "member",
  "full_name": "Alex Kumar",
  "email": "member@thebase.fit"
}
```

## Owner: Packages

### GET `/api/packages`

- Access: Owner only
- Description: Returns the full managed package catalog for owners, including archived rows and usage counts.
- Expected input:
  - No body
  - Valid owner `session_id` cookie
- Validation:
  - Common authenticated-route checks apply
  - Common owner-route checks apply
  - All package rows are returned, including archived rows
- Sample response:

```json
[
  {
    "id": 1,
    "service_type": "1:1 Personal Training",
    "sessions": 12,
    "duration_months": 1,
    "price": 29500,
    "consistency_window_days": 7,
    "consistency_min_days": 3,
    "is_active": true,
    "subscription_count": 6,
    "active_subscription_count": 2,
    "upcoming_subscription_count": 1
  },
  {
    "id": 3,
    "service_type": "MMA/Kickboxing Personal Training",
    "sessions": 8,
    "duration_months": 1,
    "price": 22000,
    "consistency_window_days": 7,
    "consistency_min_days": 2,
    "is_active": false,
    "subscription_count": 1,
    "active_subscription_count": 0,
    "upcoming_subscription_count": 0
  }
]
```

### POST `/api/packages`

- Access: Owner only
- Description: Creates a new package row. Packages are immutable after creation except for archiving.
- Expected input:
  - JSON body:

```json
{
  "service_type": "MMA/Kickboxing Personal Training",
  "sessions": 10,
  "duration_months": 2,
  "price": 12000,
  "consistency_window_days": 7,
  "consistency_min_days": 2,
  "is_active": true
}
```

- Validation:
  - Body must be valid JSON, else `400 Invalid JSON body`
  - `service_type` must be a string; it is trimmed
  - `service_type` is required, else `400 service_type is required`
  - `service_type` length must be `<= 120`, else `400 service_type exceeds 120 characters`
  - `sessions` must parse as an integer and be `> 0`, else `400 sessions must be a positive integer`
  - `duration_months` must parse as an integer and be `> 0`, else `400 duration_months must be a positive integer`
  - `price` must parse as an integer and be `> 0`, else `400 price must be a positive integer`
  - `consistency_window_days` must parse as an integer and be `>= 5`, else `400 consistency_window_days must be at least 5`
  - `consistency_min_days` must parse as an integer and be `> 0`, else `400 consistency_min_days must be a positive integer`
  - `consistency_min_days` must be strictly less than `consistency_window_days`, else `400 consistency_min_days must be less than consistency_window_days`
  - `is_active` may be boolean, `1`/`0`, or `"true"`/`"false"`; defaults to `true` if omitted
  - Duplicate `(service_type, sessions, duration_months, price)` returns `409 A package with this service type, duration, sessions, and price already exists`
- Sample response:

```json
{
  "id": 12,
  "service_type": "MMA/Kickboxing Personal Training",
  "sessions": 10,
  "duration_months": 2,
  "price": 12000,
  "consistency_window_days": 7,
  "consistency_min_days": 2,
  "is_active": true,
  "subscription_count": 0,
  "active_subscription_count": 0,
  "upcoming_subscription_count": 0
}
```

### PATCH `/api/packages/:id`

- Access: Owner only
- Description: Archives or unarchives a package by changing `is_active`. Other package fields are rejected.
- Expected input:
  - Path param:
    - `id`: package id
  - JSON body:

```json
{
  "is_active": false
}
```

- Validation:
  - `id` must parse as an integer and be `> 0`, else `400 Invalid package id`
  - Body must be valid JSON, else `400 Invalid JSON body`
  - Package must exist, else `404 Package not found`
  - Body fields must parse into supported types; invalid values return `400 Invalid package payload`
  - At least one editable field must be present, else `400 No editable field provided`
  - Any field other than `is_active` is rejected with `409 Packages are not editable. Create a new package row instead.`
  - `is_active` accepts boolean, `1`/`0`, or `"true"`/`"false"`
- Sample response:

```json
{
  "id": 1,
  "service_type": "1:1 Personal Training",
  "sessions": 12,
  "duration_months": 1,
  "price": 29500,
  "consistency_window_days": 7,
  "consistency_min_days": 3,
  "is_active": false,
  "subscription_count": 6,
  "active_subscription_count": 2,
  "upcoming_subscription_count": 1
}
```

## Member: Self Service

### GET `/api/member/profile`

- Access: Member only
- Description: Returns the authenticated member profile.
- Expected input:
  - No body
  - Valid member `session_id` cookie
- Validation:
  - Common authenticated-route checks apply
  - Common member-route checks apply
  - If the member row no longer exists, returns `404 Not found`
- Sample response:

```json
{
  "id": 2,
  "full_name": "Alex Kumar",
  "email": "member@thebase.fit",
  "phone": "9876543210",
  "join_date": "2026-04-07",
  "status": "active"
}
```

### GET `/api/member/home`

- Access: Member only
- Description: Returns the member home payload, including active subscription, consistency, renewal, and recent attendance.
- Expected input:
  - No body
  - Valid member `session_id` cookie
- Validation:
  - Common authenticated-route checks apply
  - Common member-route checks apply
  - If the member row no longer exists, returns `404 Not found`
- Sample response:

```json
{
  "member": {
    "id": 2,
    "full_name": "Alex Kumar",
    "email": "member@thebase.fit",
    "phone": "9876543210",
    "join_date": "2026-04-07",
    "status": "active"
  },
  "active_subscription": {
    "id": 31,
    "package_id": 1,
    "service_type": "1:1 Personal Training",
    "start_date": "2026-04-01",
    "end_date": "2026-04-30",
    "total_sessions": 12,
    "attended_sessions": 5,
    "remaining_sessions": 7,
    "amount": 29500,
    "owner_completed": false,
    "lifecycle_state": "active"
  },
  "consistency": {
    "status": "consistent",
    "days": 14,
    "message": "Consistent for 14 days"
  },
  "renewal": {
    "kind": "ends_soon",
    "message": "Your subscription ends in 3 days"
  },
  "marked_attendance_today": false,
  "recent_attendance": [
    { "date": "2026-04-08", "attended": false },
    { "date": "2026-04-09", "attended": true },
    { "date": "2026-04-10", "attended": false },
    { "date": "2026-04-11", "attended": true },
    { "date": "2026-04-12", "attended": false },
    { "date": "2026-04-13", "attended": true },
    { "date": "2026-04-14", "attended": false }
  ]
}
```

### GET `/api/member/subscription`

- Access: Member only
- Description: Returns the member subscription history as a flat list. Clients should group and sort as needed.
- Expected input:
  - No body
  - Valid member `session_id` cookie
- Validation:
  - Common authenticated-route checks apply
  - Common member-route checks apply
  - Response order is not guaranteed
- Sample response:

```json
[
  {
    "id": 44,
    "package_id": 3,
    "service_type": "Group Personal Training",
    "start_date": "2026-05-01",
    "end_date": "2026-05-31",
    "total_sessions": 12,
    "attended_sessions": 0,
    "remaining_sessions": 12,
    "amount": 14500,
    "owner_completed": false,
    "lifecycle_state": "upcoming"
  },
  {
    "id": 31,
    "package_id": 1,
    "service_type": "1:1 Personal Training",
    "start_date": "2026-04-01",
    "end_date": "2026-04-30",
    "total_sessions": 12,
    "attended_sessions": 5,
    "remaining_sessions": 7,
    "amount": 29500,
    "owner_completed": false,
    "lifecycle_state": "active"
  }
]
```

### POST `/api/member/session`

- Access: Member only
- Description: Marks attendance for the authenticated member for the current day.
- Expected input:
  - No body
  - Valid member `session_id` cookie
- Validation:
  - Common authenticated-route checks apply
  - Common member-route checks apply
  - If the member row cannot be found, returns `404 Member not found`
  - Archived members are rejected with `400 Cannot mark attendance for an archived member`
  - Member must have exactly one active subscription
  - No active subscription returns `400 No active subscription`
  - More than one active subscription returns `500 Multiple active subscriptions found`
  - Duplicate same-day attendance returns `409 Attendance already marked for today`
- Sample response:

```json
{
  "ok": true
}
```

## Owner: Members

### GET `/api/members`

- Access: Owner only
- Description: Returns members filtered by `status`. Active members include enrichment data; archived members return profile data only.
- Expected input:
  - Query params:
    - `status`: optional, defaults to `active`, allowed values are `active` or `archived`
- Validation:
  - Common authenticated-route checks apply
  - Common owner-route checks apply
  - Any `status` other than `active` or `archived` returns `400 Invalid status parameter`
- Sample response:

```json
[
  {
    "id": 2,
    "full_name": "Alex Kumar",
    "email": "member@thebase.fit",
    "phone": "9876543210",
    "join_date": "2026-04-07",
    "status": "active",
    "active_subscription": {
      "id": 31,
      "package_id": 1,
      "service_type": "1:1 Personal Training",
      "start_date": "2026-04-01",
      "end_date": "2026-04-30",
      "total_sessions": 12,
      "attended_sessions": 5,
      "remaining_sessions": 7,
      "amount": 29500,
      "owner_completed": false,
      "lifecycle_state": "active"
    },
    "consistency": {
      "status": "consistent",
      "days": 14,
      "message": "Consistent for 14 days"
    },
    "renewal": {
      "kind": "ends_soon",
      "message": "Your subscription ends in 3 days"
    },
    "marked_attendance_today": false,
    "recent_attendance": [
      { "date": "2026-04-08", "attended": false },
      { "date": "2026-04-09", "attended": true }
    ]
  }
]
```

### POST `/api/members`

- Access: Owner only
- Description: Creates a new member. The backend sets `join_date` to today.
- Expected input:
  - JSON body:

```json
{
  "full_name": "Jane Doe",
  "email": "jane@example.com",
  "phone": "9876543210"
}
```

- Validation:
  - Body must be valid JSON, else `400 Invalid JSON body`
  - `full_name` must be a non-empty string after trimming, else `400 full_name is required`
  - `email` must be a non-empty string after trimming and lowercasing, else `400 email is required`
  - `email` must match a basic email regex, else `400 Invalid email format`
  - `phone` must be a non-empty string after trimming, else `400 phone is required`
  - `full_name` length must be `<= 120`, else `400 full_name exceeds 120 characters`
  - `email` length must be `<= 254`, else `400 email exceeds 254 characters`
  - `phone` length must be `<= 32`, else `400 phone exceeds 32 characters`
  - Duplicate email returns `409 A member with this email already exists`
- Sample response:

```json
{
  "id": 9,
  "full_name": "Jane Doe",
  "email": "jane@example.com",
  "phone": "9876543210",
  "join_date": "2026-04-14",
  "status": "active"
}
```

### GET `/api/members/:id`

- Access: Owner only
- Description: Returns a single member detail payload.
- Expected input:
  - Path param:
    - `id`: member id
- Validation:
  - `id` must parse as an integer and be `> 0`, else `400 Invalid member id`
  - Member must exist, else `404 Member not found`
- Sample response:

```json
{
  "id": 2,
  "full_name": "Alex Kumar",
  "email": "member@thebase.fit",
  "phone": "9876543210",
  "join_date": "2026-04-07",
  "status": "active",
  "active_subscription": {
    "id": 31,
    "package_id": 1,
    "service_type": "1:1 Personal Training",
    "start_date": "2026-04-01",
    "end_date": "2026-04-30",
    "total_sessions": 12,
    "attended_sessions": 5,
    "remaining_sessions": 7,
    "amount": 29500,
    "owner_completed": false,
    "lifecycle_state": "active"
  },
  "consistency": {
    "status": "consistent",
    "days": 14,
    "message": "Consistent for 14 days"
  },
  "renewal": {
    "kind": "ends_soon",
    "message": "Your subscription ends in 3 days"
  },
  "marked_attendance_today": false,
  "recent_attendance": [
    { "date": "2026-04-08", "attended": false },
    { "date": "2026-04-09", "attended": true }
  ]
}
```

### PATCH `/api/members/:id`

- Access: Owner only
- Description: Updates editable member fields. The backend currently allows `full_name` and `phone`.
- Expected input:
  - Path param:
    - `id`: member id
  - JSON body:

```json
{
  "full_name": "Alex Kumar",
  "phone": "9998887777"
}
```

- Validation:
  - `id` must parse as an integer and be `> 0`, else `400 Invalid member id`
  - Body must be valid JSON, else `400 Invalid JSON body`
  - If provided, `full_name` must be a string that remains non-empty after trimming, else `400 full_name cannot be empty`
  - If provided, `full_name` length must be `<= 120`, else `400 full_name exceeds 120 characters`
  - If provided, `phone` must be a string that remains non-empty after trimming, else `400 phone cannot be empty`
  - If provided, `phone` length must be `<= 32`, else `400 phone exceeds 32 characters`
  - At least one editable field must be present, else `400 No editable field provided`
  - Member must exist, else `404 Member not found`
- Sample response:

```json
{
  "id": 2,
  "full_name": "Alex Kumar",
  "email": "member@thebase.fit",
  "phone": "9998887777",
  "join_date": "2026-04-07",
  "status": "active"
}
```

### POST `/api/members/:id/archive`

- Access: Owner only
- Description: Archives a member if they have no active or upcoming subscriptions, and clears all user sessions for that member.
- Expected input:
  - Path param:
    - `id`: member id
- Validation:
  - `id` must parse as an integer and be `> 0`, else `400 Invalid member id`
  - Member must exist, else `404 Member not found`
  - Already archived members return `409 Member is already archived`
  - Members with active or upcoming subscriptions return `409 Cannot archive member with active or upcoming subscriptions`
- Sample response:

```json
{
  "ok": true
}
```

## Owner: Subscriptions

### GET `/api/members/:id/subscriptions`

- Access: Owner only
- Description: Returns a member's subscriptions as a flat list. Clients should group and sort as needed.
- Expected input:
  - Path param:
    - `id`: member id
- Validation:
  - `id` must parse as an integer and be `> 0`, else `400 Invalid member id`
  - Member must exist, else `404 Member not found`
  - Response order is not guaranteed
- Sample response:

```json
[
  {
    "id": 31,
    "package_id": 1,
    "service_type": "1:1 Personal Training",
    "start_date": "2026-04-01",
    "end_date": "2026-04-30",
    "total_sessions": 12,
    "attended_sessions": 5,
    "remaining_sessions": 7,
    "amount": 29500,
    "owner_completed": false,
    "lifecycle_state": "active"
  }
]
```

### POST `/api/members/:id/subscriptions`

- Access: Owner only
- Description: Creates a new subscription for the member using an active package and a future-or-today start date. Archived members are automatically reactivated inside the transaction.
- Expected input:
  - Path param:
    - `id`: member id
  - JSON body:

```json
{
  "package_id": 1,
  "start_date": "2026-04-20"
}
```

- Validation:
  - `id` must parse as an integer and be `> 0`, else `400 Invalid member id`
  - Body must be valid JSON, else `400 Invalid JSON body`
  - `package_id` is required and must parse as a positive integer, else `400 package_id is required`
  - `start_date` is required and must be a string, else `400 start_date is required`
  - `start_date` must match `YYYY-MM-DD`, else `400 Invalid start_date format`
  - `start_date` cannot be in the past, else `400 start_date cannot be in the past`
  - Member must exist, else `404 Member not found`
  - Package must exist and must be active, else `404 Package not found`
  - New subscription must not overlap an existing active or upcoming subscription, else `409 New subscription overlaps with an existing active or upcoming subscription`
- Sample response:

```json
{
  "id": 52,
  "package_id": 1,
  "service_type": "1:1 Personal Training",
  "start_date": "2026-04-20",
  "end_date": "2026-05-19",
  "total_sessions": 12,
  "attended_sessions": 0,
  "remaining_sessions": 12,
  "amount": 29500,
  "owner_completed": false,
  "lifecycle_state": "upcoming"
}
```

### POST `/api/subscriptions/:id/complete`

- Access: Owner only
- Description: Marks a subscription as owner-completed.
- Expected input:
  - Path param:
    - `id`: subscription id
- Validation:
  - `id` must parse as an integer and be `> 0`, else `400 Invalid subscription id`
  - Subscription must exist, else `404 Subscription not found`
  - Completed subscriptions return `409 Subscription is already completed`
- Sample response:

```json
{
  "ok": true
}
```

## Owner: Attendance

### POST `/api/members/:id/sessions`

- Access: Owner only
- Description: Marks attendance for the specified member for the current day.
- Expected input:
  - Path param:
    - `id`: member id
- Validation:
  - `id` must parse as an integer and be `> 0`, else `400 Invalid member id`
  - Member must exist, else `404 Member not found`
  - Archived members are rejected with `400 Cannot mark attendance for an archived member`
  - Member must have exactly one active subscription
  - No active subscription returns `400 No active subscription`
  - More than one active subscription returns `500 Multiple active subscriptions found`
  - Duplicate same-day attendance returns `409 Attendance already marked for today`
- Sample response:

```json
{
  "ok": true
}
```

## Owner: Home

### GET `/api/owner/home`

- Access: Owner only
- Description: Returns the owner home payload with attendance summary, renewal queues, check-ins, and active/archived member lists.
- Expected input:
  - No body
  - Valid owner `session_id` cookie
- Validation:
  - Common authenticated-route checks apply
  - Common owner-route checks apply
- Sample response:

```json
{
  "attendance_summary": {
    "present_today": 4,
    "present_yesterday": 3,
    "delta": 1
  },
  "renewal_no_active": [
    {
      "member_id": 8,
      "full_name": "Nina Shah",
      "status": "active",
      "renewal": {
        "kind": "no_active",
        "message": "You have no active subscription, please activate."
      }
    }
  ],
  "renewal_nearing_end": [
    {
      "member_id": 2,
      "full_name": "Alex Kumar",
      "status": "active",
      "active_subscription": {
        "id": 31,
        "package_id": 1,
        "service_type": "1:1 Personal Training",
        "start_date": "2026-04-01",
        "end_date": "2026-04-30",
        "total_sessions": 12,
        "attended_sessions": 5,
        "remaining_sessions": 7,
        "amount": 29500,
        "owner_completed": false,
        "lifecycle_state": "active"
      },
      "renewal": {
        "kind": "ends_soon",
        "message": "Your subscription ends in 3 days"
      }
    }
  ],
  "checked_in_today": [
    {
      "member_id": 2,
      "full_name": "Alex Kumar",
      "marked_attendance_today": true,
      "consistency": {
        "status": "consistent",
        "days": 14,
        "message": "Consistent for 14 days"
      }
    }
  ],
  "active_members": [
    {
      "member_id": 2,
      "full_name": "Alex Kumar",
      "status": "active",
      "active_subscription": {
        "id": 31,
        "package_id": 1,
        "service_type": "1:1 Personal Training",
        "start_date": "2026-04-01",
        "end_date": "2026-04-30",
        "total_sessions": 12,
        "attended_sessions": 5,
        "remaining_sessions": 7,
        "amount": 29500,
        "owner_completed": false,
        "lifecycle_state": "active"
      },
      "consistency": {
        "status": "consistent",
        "days": 14,
        "message": "Consistent for 14 days"
      },
      "marked_attendance_today": true
    }
  ],
  "archived_members": [
    {
      "member_id": 19,
      "full_name": "Former Member",
      "status": "archived",
      "marked_attendance_today": false
    }
  ]
}
```

## Test-Only API

These routes are only registered by `src/server/test-routes.ts` and are intended for automated tests. They should not be exposed in production.

### GET `/api/__test__/health`

- Access: Test-only
- Description: Returns basic health data for the test server.
- Expected input:
  - No body
- Validation:
  - No request validation
- Sample response:

```json
{
  "ok": true,
  "port": 8002,
  "dbPath": "/tmp/base-gym-test.db"
}
```

### POST `/api/__test__/reset`

- Access: Test-only
- Description: Wipes test data and re-applies the seeded package catalog.
- Expected input:
  - No body
- Validation:
  - No request validation
- Sample response:

```json
{
  "ok": true
}
```

### POST `/api/__test__/member`

- Access: Test-only
- Description: Inserts a member row directly into the test database.
- Expected input:
  - JSON body; all fields are optional and defaulted by the handler:

```json
{
  "role": "member",
  "full_name": "Test User",
  "email": "test@test.com",
  "phone": "1234567890",
  "join_date": "2026-01-01",
  "status": "active"
}
```

- Validation:
  - Body must be valid JSON
  - No explicit route-level validation; database constraints still apply
- Sample response:

```json
{
  "id": 5
}
```

### POST `/api/__test__/subscription`

- Access: Test-only
- Description: Inserts a subscription row directly into the test database.
- Expected input:

```json
{
  "member_id": 2,
  "package_id": 1,
  "start_date": "2026-04-14",
  "end_date": "2026-05-13",
  "total_sessions": 12,
  "attended_sessions": 0,
  "amount": 29500,
  "owner_completed": 0
}
```

- Validation:
  - Body must be valid JSON
  - No explicit route-level validation; database constraints still apply
- Sample response:

```json
{
  "id": 17
}
```

### POST `/api/__test__/session`

- Access: Test-only
- Description: Inserts an attendance session row directly into the test database.
- Expected input:

```json
{
  "member_id": 2,
  "subscription_id": 17,
  "date": "2026-04-14"
}
```

- Validation:
  - Body must be valid JSON
  - No explicit route-level validation; database constraints still apply
- Sample response:

```json
{
  "id": 33
}
```

### POST `/api/__test__/user-session`

- Access: Test-only
- Description: Inserts a user session row directly into the test database.
- Expected input:

```json
{
  "id": "session-token",
  "member_id": 2,
  "expires_at": "2026-04-14 10:00:00"
}
```

- Validation:
  - Body must be valid JSON
  - No explicit route-level validation; database constraints still apply
- Sample response:

```json
{
  "ok": true
}
```

### GET `/api/__test__/user-session/:token`

- Access: Test-only
- Description: Checks whether a specific test session token exists.
- Expected input:
  - Path param:
    - `token`: raw session token
- Validation:
  - No explicit route-level validation
- Sample response:

```json
{
  "exists": true,
  "expires_at": "2026-04-14 10:00:00"
}
```

### GET `/api/__test__/user-sessions/member/:memberId`

- Access: Test-only
- Description: Returns the number of user sessions currently stored for the member.
- Expected input:
  - Path param:
    - `memberId`: member id
- Validation:
  - `memberId` is parsed with `parseInt`
  - No explicit error handling for invalid ids; the count query still runs
- Sample response:

```json
{
  "count": 1
}
```

### GET `/api/__test__/subscription/:id`

- Access: Test-only
- Description: Returns the raw subscription row from the test database.
- Expected input:
  - Path param:
    - `id`: subscription id
- Validation:
  - `id` is parsed with `parseInt`
  - If no row is found, returns `404 { "error": "not found" }`
- Sample response:

```json
{
  "id": 17,
  "member_id": 2,
  "package_id": 1,
  "start_date": "2026-04-14",
  "end_date": "2026-05-13",
  "total_sessions": 12,
  "attended_sessions": 0,
  "amount": 29500,
  "owner_completed": 0,
  "created_at": "2026-04-14 11:30:00"
}
```

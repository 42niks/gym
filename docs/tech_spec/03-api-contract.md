# API Contract

**Part of:** [Technical Spec Index](./README.md)
**PRD:** [../prd.md](../prd.md)

## 4. API Contract

Base path: `/api`

### 4.1 Conventions

- All responses are JSON.
- All non-2xx responses use:

```json
{ "error": "Human-readable message" }
```

- No pagination is needed in MVP.
- Invalid JSON body returns `400` with `{"error":"Invalid JSON body"}`.
- Invalid path params or query params return `400`.
- Well-formed but missing resources return `404`.
- All protected endpoints clear the `session_id` cookie when authentication fails because the session is expired, missing, or belongs to an archived member.

### 4.2 Status Codes

| Code | Meaning |
|---|---|
| `200` | Successful read or mutation |
| `201` | Successful creation |
| `400` | Validation or malformed input |
| `401` | Not authenticated / session invalid |
| `403` | Authenticated but not owner |
| `404` | Resource not found |
| `409` | Business-rule conflict |
| `500` | Unexpected invariant break or internal failure |

### 4.3 Common Response Shapes

#### User Summary

```json
{
  "id": 1,
  "role": "member",
  "full_name": "Riya Patel",
  "email": "riya@example.com"
}
```

#### Member Profile

```json
{
  "id": 1,
  "full_name": "Riya Patel",
  "email": "riya@example.com",
  "phone": "9876543210",
  "join_date": "2026-04-07",
  "status": "active"
}
```

#### Subscription Summary

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

#### Consistency Summary

```json
{
  "status": "consistent",
  "days": 14,
  "message": "You have been consistent for the last 14 days"
}
```

or

```json
{
  "status": "building",
  "message": "You are building your consistency, keep it up!"
}
```

#### Renewal Summary

```json
{
  "kind": "ends_soon",
  "message": "Your subscription ends soon, please renew."
}
```

or

```json
{
  "kind": "starts_on",
  "message": "Your subscription starts on 10 May 2026.",
  "upcoming_start_date": "2026-05-10"
}
```

or

```json
{
  "kind": "no_active",
  "message": "You have no active subscription, please activate."
}
```

### 4.4 Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | No | Log in with email + password |
| `POST` | `/api/auth/logout` | No | Idempotent logout |
| `GET` | `/api/auth/me` | Yes | Return current authenticated user |

#### `POST /api/auth/login`

Request:

```json
{
  "email": "user@example.com",
  "password": "0987654321"
}
```

Rules:

- `email` is trimmed and lowercased before lookup.
- `password` is trimmed before comparison.
- The stored password is the member's current `phone`.
- On success, delete expired `user_sessions` rows for that member, create a new session row, and set `session_id`.
- Existing valid sessions for that member are not revoked on login; multiple concurrent sessions are allowed in MVP.

Success response:

```json
{
  "id": 1,
  "role": "member",
  "full_name": "Riya Patel",
  "email": "user@example.com"
}
```

Failure:

- `401` -> `{"error":"Invalid email or password"}`

Cookie:

| Attribute | Value |
|---|---|
| Name | `session_id` |
| HttpOnly | `true` |
| SameSite | `Strict` |
| Secure | `true` in production, `false` locally |
| Path | `/` |
| Max-Age | `864000` seconds (10 days) |

#### `POST /api/auth/logout`

This endpoint is intentionally idempotent.

Server behavior:

1. Read `session_id` cookie if present.
2. Delete the matching `user_sessions` row if it exists.
3. Clear the cookie.
4. Return `200`.

Response:

```json
{ "ok": true }
```

#### `GET /api/auth/me`

Success:

```json
{
  "id": 1,
  "role": "member",
  "full_name": "Riya Patel",
  "email": "riya@example.com"
}
```

Failure:

- `401` -> `{"error":"Not authenticated"}`

### 4.5 Packages

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/packages` | Yes | Return all package rows |

Response is a flat array sorted by:

1. `service_type ASC`
2. `duration_months ASC`
3. `sessions ASC`
4. `price ASC`

### 4.6 Member Self Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/me/profile` | Member | Return own profile |
| `GET` | `/api/me/home` | Member | Return member home screen state |
| `GET` | `/api/me/subscriptions` | Member | Return own subscriptions grouped for UI |
| `POST` | `/api/me/sessions` | Member | Mark attendance for today |

#### `GET /api/me/home`

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
  "active_subscription": {
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
  },
  "consistency": {
    "status": "consistent",
    "days": 14,
    "message": "You have been consistent for the last 14 days"
  },
  "renewal": null,
  "marked_attendance_today": false
}
```

Notes:

- `active_subscription` is `null` when no active subscription exists.
- `consistency` is `null` when there is no active subscription.
- `renewal` may be `null`, `ends_soon`, `starts_on`, or `no_active`.
- `marked_attendance_today` is independent of current subscription state.

#### `GET /api/me/subscriptions`

```json
{
  "completed_and_active": [
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
  ],
  "upcoming": [
    {
      "id": 9,
      "package_id": 3,
      "service_type": "1:1 Personal Training",
      "start_date": "2026-05-10",
      "end_date": "2026-06-09",
      "total_sessions": 12,
      "attended_sessions": 0,
      "remaining_sessions": 12,
      "amount": 29500,
      "owner_completed": false,
      "lifecycle_state": "upcoming"
    }
  ]
}
```

Ordering:

- `completed_and_active`: active subscription first if present, then completed subscriptions by `start_date DESC, id DESC`
- `upcoming`: `start_date ASC, id ASC`

### 4.7 Owner Member Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/members` | Owner | List members by status |
| `POST` | `/api/members` | Owner | Create a member |
| `GET` | `/api/members/:id` | Owner | Get owner-facing member detail |
| `PATCH` | `/api/members/:id` | Owner | Update `full_name` and/or `phone` |
| `POST` | `/api/members/:id/archive` | Owner | Archive a member |
| `GET` | `/api/members/:id/subscriptions` | Owner | List subscriptions for a member |
| `POST` | `/api/members/:id/subscriptions` | Owner | Create a subscription |
| `POST` | `/api/members/:id/sessions` | Owner | Mark attendance for that member today |

#### `GET /api/members?status=active|archived`

Rules:

- Default `status` is `active`.
- Invalid `status` returns `400`.
- Sort order is `LOWER(full_name) ASC, id ASC`.

`status=active` response shape:

```json
[
  {
    "id": 1,
    "full_name": "Asha Singh",
    "email": "asha@example.com",
    "phone": "9876543210",
    "join_date": "2026-01-15",
    "status": "active",
    "active_subscription": {
      "id": 7,
      "package_id": 3,
      "service_type": "1:1 Personal Training",
      "start_date": "2026-04-01",
      "end_date": "2026-04-30",
      "total_sessions": 12,
      "attended_sessions": 4,
      "remaining_sessions": 8,
      "amount": 29500,
      "owner_completed": false,
      "lifecycle_state": "active"
    },
    "consistency": {
      "status": "consistent",
      "days": 14,
      "message": "You have been consistent for the last 14 days"
    },
    "marked_attendance_today": true
  }
]
```

`status=archived` response shape:

```json
[
  {
    "id": 8,
    "full_name": "Neha Rao",
    "email": "neha@example.com",
    "phone": "9876543210",
    "join_date": "2025-08-01",
    "status": "archived"
  }
]
```

#### `POST /api/members`

Request:

```json
{
  "full_name": "Riya Patel",
  "email": "riya@example.com",
  "phone": "9876543210"
}
```

Validation:

- `full_name`, `email`, and `phone` are required after trimming.
- `email` must pass a basic email-format check.
- `email` is stored lowercase.
- `phone` duplicates are allowed.

Success:

```json
{
  "id": 5,
  "full_name": "Riya Patel",
  "email": "riya@example.com",
  "phone": "9876543210",
  "join_date": "2026-04-07",
  "status": "active"
}
```

Failures:

- `400` -> missing required field / invalid email
- `409` -> `{"error":"A member with this email already exists"}`

#### `GET /api/members/:id`

```json
{
  "id": 1,
  "full_name": "Riya Patel",
  "email": "riya@example.com",
  "phone": "9876543210",
  "join_date": "2026-04-07",
  "status": "active",
  "active_subscription": {
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
  },
  "consistency": {
    "status": "consistent",
    "days": 14,
    "message": "You have been consistent for the last 14 days"
  },
  "renewal": null,
  "marked_attendance_today": false
}
```

Owner detail intentionally does not inline full subscription history. The page should call `/api/members/:id/subscriptions` separately.

If the member is archived, return:

- `active_subscription: null`
- `consistency: null`
- `renewal: null`

Archived status suppresses renewal messaging on the owner detail view.

#### `PATCH /api/members/:id`

Request must contain at least one of:

- `full_name`
- `phone`

Fields are trimmed before validation.

Success:

```json
{
  "id": 1,
  "full_name": "Riya Sharma",
  "email": "riya@example.com",
  "phone": "1111111111",
  "join_date": "2026-04-07",
  "status": "active"
}
```

Failures:

- `400` -> no editable field provided / invalid empty value
- `404` -> member not found

Changing `phone` changes future login credentials immediately, but does not revoke already-issued sessions.

#### `POST /api/members/:id/archive`

Success:

```json
{ "ok": true }
```

Failures:

- `409` -> `{"error":"Cannot archive member with active or upcoming subscriptions"}`
- `409` -> `{"error":"Member is already archived"}`

On success:

1. Update `members.status` to `archived`.
2. Delete all `user_sessions` rows for that member in the same transaction.

### 4.8 Subscription Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/members/:id/subscriptions` | Owner | Return that member's grouped subscriptions |
| `POST` | `/api/members/:id/subscriptions` | Owner | Create a subscription |
| `POST` | `/api/subscriptions/:id/complete` | Owner | Mark a subscription completed |

`GET /api/members/:id/subscriptions` has the same response shape and ordering as `GET /api/me/subscriptions`.

#### `POST /api/members/:id/subscriptions`

Request:

```json
{
  "package_id": 3,
  "start_date": "2026-04-10"
}
```

Rules:

- `start_date` must be today or future in IST.
- Compute `end_date` from `start_date` + package duration.
- Snapshot `total_sessions` and `amount` from the selected package row.
- Reject if the new subscription overlaps any active or upcoming subscription for the member.
- If the member is archived, set `status = 'active'` in the same transaction.

Success:

```json
{
  "id": 9,
  "package_id": 3,
  "service_type": "1:1 Personal Training",
  "start_date": "2026-04-10",
  "end_date": "2026-05-09",
  "total_sessions": 12,
  "attended_sessions": 0,
  "remaining_sessions": 12,
  "amount": 29500,
  "owner_completed": false,
  "lifecycle_state": "upcoming"
}
```

Failures:

- `400` -> invalid or past `start_date`
- `404` -> member or package not found
- `409` -> overlap with active/upcoming subscription

#### `POST /api/subscriptions/:id/complete`

Success:

```json
{ "ok": true }
```

Failures:

- `404` -> subscription not found
- `409` -> `{"error":"Subscription is already completed"}`

Completion means:

- set `owner_completed = 1`
- do not change `start_date`
- do not change `end_date`
- do not change counters
- do not delete attendance history

### 4.9 Attendance Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/me/sessions` | Member | Mark own attendance for today |
| `POST` | `/api/members/:id/sessions` | Owner | Mark attendance for a member for today |

Request body is empty. Attendance is always for the current IST date.

Success:

```json
{ "ok": true }
```

Failures:

- `400` -> `{"error":"No active subscription"}`
- `400` -> `{"error":"Cannot mark attendance for an archived member"}`
- `409` -> `{"error":"Attendance already marked for today"}`

### 4.10 Owner Dashboard

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/owner/dashboard` | Owner | Return owner home/renewal screen data |

Response:

```json
{
  "renewal_no_active": [
    {
      "member_id": 3,
      "full_name": "Asha Singh",
      "status": "active",
      "renewal": {
        "kind": "no_active",
        "message": "You have no active subscription, please activate."
      }
    }
  ],
  "renewal_nearing_end": [
    {
      "member_id": 4,
      "full_name": "Kabir Shah",
      "status": "active",
      "active_subscription": {
        "id": 7,
        "package_id": 3,
        "service_type": "1:1 Personal Training",
        "start_date": "2026-04-10",
        "end_date": "2026-05-09",
        "total_sessions": 12,
        "attended_sessions": 10,
        "remaining_sessions": 2,
        "amount": 29500,
        "owner_completed": false,
        "lifecycle_state": "active"
      },
      "renewal": {
        "kind": "ends_soon",
        "message": "Your subscription ends soon, please renew."
      }
    }
  ],
  "checked_in_today": [
    {
      "member_id": 4,
      "full_name": "Kabir Shah",
      "marked_attendance_today": true,
      "consistency": {
        "status": "consistent",
        "days": 14,
        "message": "You have been consistent for the last 14 days"
      }
    }
  ],
  "active_members": [
    {
      "member_id": 4,
      "full_name": "Kabir Shah",
      "status": "active",
      "active_subscription": {
        "id": 7,
        "package_id": 3,
        "service_type": "1:1 Personal Training",
        "start_date": "2026-04-10",
        "end_date": "2026-05-09",
        "total_sessions": 12,
        "attended_sessions": 10,
        "remaining_sessions": 2,
        "amount": 29500,
        "owner_completed": false,
        "lifecycle_state": "active"
      },
      "consistency": {
        "status": "consistent",
        "days": 14,
        "message": "You have been consistent for the last 14 days"
      },
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

Sorting:

- `renewal_no_active`: `LOWER(full_name) ASC, member_id ASC`
- `renewal_nearing_end`: `LOWER(full_name) ASC, member_id ASC`
- `checked_in_today`: latest `sessions.created_at DESC, member_id ASC`
- `active_members`: `LOWER(full_name) ASC, member_id ASC`
- `archived_members`: `LOWER(full_name) ASC, member_id ASC`

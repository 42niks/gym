# Business Logic

**Part of:** [Technical Spec Index](./README.md)
**PRD:** [../prd.md](../prd.md)

## 5. Core Business Logic

All business logic uses IST dates unless explicitly stated otherwise.

### 5.1 Canonical Date Helpers

`src/lib/date.ts` should expose:

- `get_ist_date(now?: Date): string`
- `parse_ymd(value: string): { year: number; month: number; day: number }`
- `add_months_clamped(ymd: string, months: number): string`
- `add_days(ymd: string, days: number): string`
- `diff_days(a: string, b: string): number`
- `format_human_date(ymd: string): string` -> `10 May 2026`

The entire app should use these helpers rather than hand-written date math inside routes.

### 5.2 Subscription End Date Calculation

Given `start_date` and `duration_months`:

1. Add `duration_months` calendar months.
2. If the target day does not exist, clamp to the last valid day of the target month.
3. Subtract one day.

Examples:

| Start | Duration | Target before subtract | End date |
|---|---|---|---|
| `2026-04-07` | `1` month | `2026-05-07` | `2026-05-06` |
| `2026-01-31` | `1` month | `2026-02-28` | `2026-02-27` |
| `2028-01-31` | `1` month | `2028-02-29` | `2028-02-28` |

### 5.3 Subscription Lifecycle

```text
remaining_sessions = total_sessions - attended_sessions

if owner_completed = 1                       -> completed
else if today > end_date                     -> completed
else if remaining_sessions = 0               -> completed
else if start_date > today                   -> upcoming
else                                         -> active
```

Implications:

- A subscription can become `completed` even if `end_date` is still in the future.
- A completed subscription is excluded from overlap checks.
- A new subscription may therefore start on the same date that an older subscription was manually completed.

### 5.4 Active and Upcoming Subscription Invariants

For a valid member state:

- there is at most one active subscription for any given IST date
- there may be multiple upcoming subscriptions
- upcoming subscriptions must not overlap each other
- the earliest upcoming subscription is the one with the smallest `start_date`

If the database ever contains multiple active subscriptions for the same member and date, the API should treat that as a server invariant break and return `500` rather than silently picking one.

### 5.5 Overlap Validation

When creating a new subscription:

- compare only against subscriptions currently derived as `active` or `upcoming`
- ignore derived `completed` subscriptions
- reject if date ranges overlap inclusively

Formal rule:

```text
new.start_date <= existing.end_date
AND
new.end_date >= existing.start_date
```

Boundary example:

- existing `end_date = 2026-05-09`
- new `start_date = 2026-05-09`
- result: reject

Same-day replacement example:

1. Owner completes an active subscription on `2026-05-09`.
2. That row becomes derived `completed`.
3. Owner creates a new subscription with `start_date = 2026-05-09`.
4. This is allowed because the older row is now excluded from overlap checks.

### 5.6 Attendance Write Semantics

Attendance creation is a single transaction.

Steps:

1. Resolve `today` in IST.
2. Load the member row.
3. Reject if the member is archived.
4. Load the member's active subscription for `today`.
5. Reject if none exists.
6. Insert `sessions(member_id, subscription_id, date=today)`.
7. Increment `subscriptions.attended_sessions` by `1`.
8. Commit.

Required protections:

- The insert relies on `UNIQUE(member_id, date)` to prevent double check-ins.
- The update must guard `attended_sessions < total_sessions`.
- If either write fails, the whole transaction rolls back.

This handles:

- double tap by a member
- owner and member both trying to mark attendance on the same day
- stale reads around `remaining_sessions`

### 5.7 Completion Semantics

Manual completion is irreversible in MVP.

On completion:

- set `owner_completed = 1`
- preserve `attended_sessions`
- preserve `total_sessions`
- preserve `start_date` and `end_date`
- preserve all linked attendance rows

If a member checked in earlier the same day and the owner later completes the subscription, `marked_attendance_today` stays `true` because it is tied to the session row, not to whether the subscription remains active.

### 5.8 Renewal Logic

Inputs:

- current active subscription, if any
- upcoming subscriptions ordered by `start_date ASC, id ASC`
- `today` in IST

Derived:

```text
remaining_sessions = total_sessions - attended_sessions
days_until_end = end_date - today
nearing_end = remaining_sessions < 3 OR days_until_end <= 4
```

Decision order:

```text
if active exists AND nearing_end AND no upcoming exists
  -> ends_soon
else if no active exists AND upcoming exists
  -> starts_on using earliest upcoming start_date
else if no active exists AND no upcoming exists
  -> no_active
else
  -> null
```

Important:

- If an active subscription is nearing end but an upcoming subscription already exists, return `null`.
- `renewal_no_active` on the owner dashboard includes both `starts_on` and `no_active`.

### 5.9 Consistency Logic

Consistency is evaluated only when the member has an active subscription.

Input data:

- all attendance dates for the member across all time
- the member's earliest ever subscription `start_date`
- the active package's `consistency_window_days`
- the active package's `consistency_min_days`
- `today` in IST

Algorithm:

```text
if no active subscription
  -> null

if (today - earliest_subscription_start) < window_days
  -> building

streak = 0
d = today
first_eligible_day = earliest_subscription_start + window_days

while d >= first_eligible_day:
  window_start = d - (window_days - 1)
  attended_in_window = count(attendance_dates in [window_start, d])

  if attended_in_window >= min_days
    streak += 1
    d -= 1 day
  else
    break

if streak >= window_days
  -> consistent(days = streak)
else
  -> building
```

Output copy:

- `consistent` -> `You have been consistent for the last {days} days`
- `building` -> `You are building your consistency, keep it up!`

Important clarifications:

- Consistency may continue to show `consistent` on a day when the member has not checked in, as long as the rolling window still satisfies the rule.
- Consistency may span multiple subscriptions.
- Consistency uses the rule of the currently active package, even when older attendance belongs to subscriptions with different package rules.
- Historical consistency is not stored.

### 5.10 Archive / Unarchive Rules

Archive is allowed only when the member has no active or upcoming subscriptions.

Unarchive happens implicitly when creating a new subscription for an archived member.

This unarchive occurs in the same transaction as subscription creation so the system never exposes:

- a newly created subscription attached to an archived member
- an active member state without the newly created subscription

### 5.11 Validation Rules

#### Shared Rules

- Path params like `:id` must parse to a positive integer.
- Empty strings after trimming are invalid.

#### Member Input

- `full_name`: required on create, optional on update, trimmed, max `120` chars
- `email`: required on create, trimmed, lowercased, max `254` chars, must look like an email
- `phone`: required on create, optional on update, trimmed, max `32` chars

#### Subscription Input

- `package_id`: required positive integer
- `start_date`: required `YYYY-MM-DD`, today or future in IST

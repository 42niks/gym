# Data Model

**Part of:** [Technical Spec Index](./README.md)
**PRD:** [../prd.md](../prd.md)
**Packages:** [../service-packages.md](../service-packages.md)

## 3. Data Model

### 3.1 Canonical Storage Rules

- All API JSON uses `snake_case`.
- All dates are stored as `TEXT` in `YYYY-MM-DD` and always represent IST dates.
- All datetimes are stored as UTC `TEXT` in SQLite `datetime('now')` format: `YYYY-MM-DD HH:MM:SS`.
- All money amounts are stored as integer INR values, not decimals.
- `email` is stored trimmed and lowercased.
- `phone` is stored trimmed but is otherwise not normalized.
- `full_name` is stored trimmed.

The app validates date format at the API layer. SQLite is not responsible for validating that a date string is semantically real beyond the application checks.

### 3.2 Schema

```sql
CREATE TABLE packages (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  service_type            TEXT    NOT NULL,
  sessions                INTEGER NOT NULL CHECK (sessions > 0),
  duration_months         INTEGER NOT NULL CHECK (duration_months > 0),
  price                   INTEGER NOT NULL CHECK (price > 0),
  consistency_window_days INTEGER NOT NULL CHECK (consistency_window_days > 0),
  consistency_min_days    INTEGER NOT NULL CHECK (
    consistency_min_days > 0 AND
    consistency_min_days <= consistency_window_days
  ),
  UNIQUE (service_type, sessions, duration_months, price)
);

CREATE TABLE members (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  role       TEXT    NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'owner')),
  full_name  TEXT    NOT NULL,
  email      TEXT    NOT NULL,
  phone      TEXT    NOT NULL,
  join_date  TEXT    NOT NULL,
  status     TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_members_email_ci ON members (LOWER(email));
CREATE UNIQUE INDEX idx_members_single_owner ON members(role) WHERE role = 'owner';
CREATE INDEX idx_members_status_name ON members (status, full_name, id);

CREATE TABLE subscriptions (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id         INTEGER NOT NULL REFERENCES members(id),
  package_id        INTEGER NOT NULL REFERENCES packages(id),
  start_date        TEXT    NOT NULL,
  end_date          TEXT    NOT NULL,
  total_sessions    INTEGER NOT NULL CHECK (total_sessions > 0),
  attended_sessions INTEGER NOT NULL DEFAULT 0 CHECK (
    attended_sessions >= 0 AND
    attended_sessions <= total_sessions
  ),
  amount            INTEGER NOT NULL CHECK (amount > 0),
  owner_completed   INTEGER NOT NULL DEFAULT 0 CHECK (owner_completed IN (0, 1)),
  created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  CHECK (start_date <= end_date)
);

CREATE INDEX idx_subscriptions_member_dates
  ON subscriptions (member_id, start_date, end_date, id);

CREATE TABLE sessions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id       INTEGER NOT NULL REFERENCES members(id),
  subscription_id INTEGER NOT NULL REFERENCES subscriptions(id),
  date            TEXT    NOT NULL,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (member_id, date)
);

CREATE INDEX idx_sessions_member_date ON sessions (member_id, date, created_at, id);
CREATE INDEX idx_sessions_subscription_id ON sessions (subscription_id);

CREATE TABLE user_sessions (
  id         TEXT    PRIMARY KEY,
  member_id  INTEGER NOT NULL REFERENCES members(id),
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT    NOT NULL
);

CREATE INDEX idx_user_sessions_member_id ON user_sessions (member_id);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions (expires_at);
```

### 3.3 Table Semantics

#### `packages`

- Seeded reference data only.
- UI-immutable in MVP.
- `price`, `duration_months`, `service_type`, and `sessions` are immutable in place.
- `consistency_window_days` and `consistency_min_days` may be edited directly outside the app and apply retroactively to current consistency evaluation.

#### `members`

- Contains both the owner and all members.
- Exactly one row may have `role = 'owner'`.
- Archived members remain in the table permanently.
- Email uniqueness is global across both active and archived members.

#### `subscriptions`

- Snapshot table for a member-specific package purchase.
- `total_sessions` and `amount` are snapshotted from `packages` at creation time.
- `service_type` is not duplicated; it is read via the `packages` join.
- Lifecycle state is derived at query time and is never stored.

#### `sessions`

- One row means one attended gym day.
- There is at most one row per member per IST calendar date.
- `subscription_id` always points to the subscription that was active when the session was recorded.

#### `user_sessions`

- Session tokens are UUIDs created with `crypto.randomUUID()`.
- Expiry is server authoritative.
- Browser cookie expiry and database expiry must always be refreshed together.

### 3.4 Derived Fields

The following are computed at read time and never persisted:

| Field | Derivation |
|---|---|
| `remaining_sessions` | `total_sessions - attended_sessions` |
| `lifecycle_state` | Current IST date + `owner_completed` + `remaining_sessions` |
| `consistency` | Attendance history + active package rule |
| `renewal` | Active subscription + upcoming subscriptions |
| `marked_attendance_today` | Existence of a `sessions` row for `member_id` and today's IST date |

### 3.5 Seed Data

`src/db/seed.sql` is committed, idempotent, and contains the authoritative package list from [service-packages.md](../service-packages.md).

```sql
INSERT OR IGNORE INTO packages (
  service_type,
  sessions,
  duration_months,
  price,
  consistency_window_days,
  consistency_min_days
) VALUES
  ('1:1 Personal Training',             8, 1, 19900, 7, 2),
  ('1:1 Personal Training',            12, 1, 29500, 7, 3),
  ('1:1 Personal Training',            24, 3, 59000, 7, 2),
  ('1:1 Personal Training',            36, 3, 85800, 7, 3),
  ('MMA/Kickboxing Personal Training',  4, 1,  9600, 7, 1),
  ('MMA/Kickboxing Personal Training',  8, 1, 18800, 7, 2),
  ('MMA/Kickboxing Personal Training', 12, 1, 26400, 7, 3),
  ('Group Personal Training',          12, 1, 14500, 7, 3),
  ('Group Personal Training',          16, 1, 18900, 7, 4),
  ('Group Personal Training',          36, 3, 42000, 7, 3),
  ('Group Personal Training',          48, 3, 54000, 7, 4),
  ('Group Personal Training',          16, 2, 22800, 7, 2),
  ('Group Personal Training',          30, 4, 42500, 7, 2),
  ('Group Personal Training',          40, 5, 56000, 7, 2);
```

`src/db/seed.credentials.sql` is uncommitted and should also be idempotent:

```sql
INSERT OR IGNORE INTO members (role, full_name, email, phone, join_date) VALUES
  ('owner',  '<owner name>',  LOWER('<owner email>'),  '<owner phone>',  '<today>'),
  ('member', '<member name>', LOWER('<member email>'), '<member phone>', '<today>');
```

`<today>` is replaced manually with an IST date before execution.

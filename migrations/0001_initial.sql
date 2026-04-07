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

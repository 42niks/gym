PRAGMA foreign_keys = OFF;

CREATE TABLE members_new (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  role       TEXT    NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'owner')),
  full_name  TEXT    NOT NULL,
  email      TEXT    NOT NULL,
  phone      TEXT    NOT NULL CHECK (phone GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'),
  join_date  TEXT    NOT NULL,
  status     TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO members_new (id, role, full_name, email, phone, join_date, status, created_at)
SELECT id, role, full_name, email, phone, join_date, status, created_at
FROM members;

DROP TABLE members;
ALTER TABLE members_new RENAME TO members;

CREATE UNIQUE INDEX idx_members_email_ci ON members (LOWER(email));
CREATE UNIQUE INDEX idx_members_single_owner ON members(role) WHERE role = 'owner';
CREATE INDEX idx_members_status_name ON members (status, full_name, id);

PRAGMA foreign_keys = ON;

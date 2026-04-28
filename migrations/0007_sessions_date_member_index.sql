CREATE INDEX IF NOT EXISTS idx_sessions_date_member_created
  ON sessions (date, member_id, created_at, id);

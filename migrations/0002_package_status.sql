ALTER TABLE packages
ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1));

CREATE INDEX idx_packages_active_listing
  ON packages (is_active, service_type, duration_months, sessions, price, id);

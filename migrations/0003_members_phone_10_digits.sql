-- D1-safe phone enforcement without rebuilding the members table.
-- Reject non-10-digit phone values at the database layer.
CREATE TRIGGER IF NOT EXISTS members_phone_validate_insert
BEFORE INSERT ON members
FOR EACH ROW
WHEN NEW.phone NOT GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
BEGIN
  SELECT RAISE(ABORT, 'phone must be exactly 10 digits');
END;

CREATE TRIGGER IF NOT EXISTS members_phone_validate_update
BEFORE UPDATE OF phone ON members
FOR EACH ROW
WHEN NEW.phone NOT GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
BEGIN
  SELECT RAISE(ABORT, 'phone must be exactly 10 digits');
END;

UPDATE members
SET archived_at = DATE(join_date, '+45 days')
WHERE status = 'archived' AND archived_at IS NULL;

CREATE TRIGGER members_archived_at_insert_check
BEFORE INSERT ON members
FOR EACH ROW
WHEN NEW.archived_at IS NOT NULL AND NEW.archived_at < NEW.join_date
BEGIN
  SELECT RAISE(ABORT, 'archived_at must be on or after join_date');
END;

CREATE TRIGGER members_archived_at_update_check
BEFORE UPDATE OF join_date, archived_at ON members
FOR EACH ROW
WHEN NEW.archived_at IS NOT NULL AND NEW.archived_at < NEW.join_date
BEGIN
  SELECT RAISE(ABORT, 'archived_at must be on or after join_date');
END;

ALTER TABLE packages
ADD COLUMN visibility_scope TEXT NOT NULL DEFAULT 'public' CHECK (visibility_scope IN ('public', 'private'));


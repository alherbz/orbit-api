-- Backfill existing tasks, then require an explicit owner for new rows.
ALTER TABLE tasks ADD COLUMN owner TEXT NOT NULL DEFAULT 'unassigned';
ALTER TABLE tasks ALTER COLUMN owner DROP DEFAULT;

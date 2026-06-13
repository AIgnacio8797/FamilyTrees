-- 003_trees_user_id.sql
-- Give every tree an owner. Nullable for now so the existing rows stay valid;
-- they'll be backfilled to the first account, and new trees set it on create.
-- ON DELETE CASCADE: deleting a user removes their trees. Safe to re-run.

ALTER TABLE trees ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS trees_user_id_idx ON trees(user_id);

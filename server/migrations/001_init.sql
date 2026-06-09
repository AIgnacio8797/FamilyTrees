-- 001_init.sql
-- Initial schema: captures the hand-created `trees` table as it existed in June 2026.
-- Written with IF NOT EXISTS so it is safe to run against the existing database
-- (it becomes a no-op there) and also recreates the table cleanly on a fresh DB.
--
-- gen_random_uuid() is built into Postgres 13+. The pgcrypto extension is enabled
-- as a portability safety net for older servers; it is harmless on modern ones.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS trees (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    title       text        NOT NULL,
    tree_data   jsonb       NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 004_session.sql
-- Session store for connect-pg-simple (Postgres-backed Express sessions).
-- Column shape is what connect-pg-simple expects (sid / sess / expire).
-- Safe to re-run (IF NOT EXISTS); PK defined inline so it's idempotent.

CREATE TABLE IF NOT EXISTS "session" (
    "sid"    varchar      NOT NULL PRIMARY KEY,
    "sess"   json         NOT NULL,
    "expire" timestamp(6) NOT NULL
);

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

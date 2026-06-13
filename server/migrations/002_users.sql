-- 002_users.sql
-- Accounts table. Google sign-in is the initial auth method, so google_id holds
-- the external identity; password_hash stays nullable to leave the door open for
-- a future email/password path. Safe to re-run (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS users (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    email         text        NOT NULL UNIQUE,
    google_id     text        UNIQUE,
    name          text,
    avatar_url    text,
    password_hash text,
    created_at    timestamptz NOT NULL DEFAULT now()
);

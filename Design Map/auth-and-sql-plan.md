# Authentication & SQL Plan

## Current Database State

Single `trees` table in PostgreSQL:

```
id          uuid        PRIMARY KEY
title       text        NOT NULL
tree_data   jsonb       NOT NULL
created_at  timestamptz
updated_at  timestamptz
```

Migration runner already exists at `server/src/migrate.js`. New migrations drop in as numbered `.sql` files under `server/migrations/`.

---

## Schema Additions Needed

### Migration 002 — users table

```sql
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,
  password_hash text,           -- nullable to support SSO-only accounts
  google_id     text UNIQUE,    -- null for email/password accounts
  avatar_url    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
```

### Migration 003 — link trees to users

```sql
ALTER TABLE trees ADD COLUMN user_id uuid REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX trees_user_id_idx ON trees(user_id);
```

The `tree_data` JSONB payload is untouched by these migrations.

---

## Authentication Options

### Option A — Passport.js + Google OAuth (recommended if self-hosting Postgres)

Packages: `passport`, `passport-google-oauth20`, `express-session`, `connect-pg-simple`

- Add `/auth/google` and `/auth/google/callback` Express routes (~80 lines)
- Sessions stored in Postgres via `connect-pg-simple`
- `SESSION_SECRET` env var already reserved in `.env.example`
- Frontend: a redirect link/button to `/auth/google`, no extra npm package needed
- Estimated effort: ~1 day

### Option B — Supabase Auth (recommended if switching Postgres host to Supabase)

- Google OAuth enabled via a toggle in the Supabase dashboard
- Frontend call: `supabase.auth.signInWithOAuth({ provider: 'google' })`
- No custom auth routes, no session middleware to write
- Supabase is still Postgres underneath — migration away is possible
- Trade-off: tighter vendor coupling
- Estimated effort: ~2 hours

### Option C — better-auth

- Modern Node.js auth library with Google OAuth built in
- Less boilerplate than Passport, TypeScript-friendly
- Newer, smaller community than Passport
- Estimated effort: ~4 hours

---

## Google OAuth Setup (all paths require this)

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/)
2. Enable OAuth 2.0 credentials
3. Add authorized redirect URIs:
   - Dev: `http://localhost:3001/auth/google/callback`
   - Prod: `https://yourdomain.com/auth/google/callback`
4. Copy `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to `.env`

No billing required. Basic profile + email scopes need no approval process.

---

## Deployment Options for Postgres

| Host | Free tier | Ops burden | Notes |
|---|---|---|---|
| Neon | Yes | Near-zero | Serverless Postgres, scales to zero, existing `pg` pool code works as-is |
| Supabase | Yes | Near-zero | Includes auth — best if going with Option B above |
| Railway | Small | Minimal | Simple managed Postgres |
| Render | Yes | Minimal | Simple managed Postgres |

No code changes needed to `server/src/db.js` — just update env vars.

---

## Implementation Order

1. Choose Postgres host and provision it
2. Run existing `001_init.sql` migration to confirm connectivity
3. Write and run `002_users.sql`
4. Write and run `003_trees_user_fk.sql`
5. Implement chosen auth option (A, B, or C)
6. Add auth middleware to tree routes — reject unauthenticated requests
7. Scope tree queries to `WHERE user_id = $1`
8. Add `GET /api/trees` route returning all trees for the current user

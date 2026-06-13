// Passport setup: Google OAuth strategy + session (de)serialization.
import 'dotenv/config';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import pool from '../db.js';

passport.use(new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
  },
  // Verify callback: upsert the user by google_id, return the row.
  async (accessToken, refreshToken, profile, done) => {
    try {
      const googleId = profile.id;
      const email = profile.emails?.[0]?.value || null;
      const name = profile.displayName || null;
      const avatarUrl = profile.photos?.[0]?.value || null;

      const { rows } = await pool.query(
        `INSERT INTO users (google_id, email, name, avatar_url)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (google_id) DO UPDATE
           SET email = EXCLUDED.email,
               name = EXCLUDED.name,
               avatar_url = EXCLUDED.avatar_url
         RETURNING *`,
        [googleId, email, name, avatarUrl],
      );

      return done(null, rows[0]);
    } catch (error) {
      return done(error);
    }
  },
));

// Only the user id lives in the session cookie.
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Rehydrate the full user from the id on each request.
passport.deserializeUser(async (id, done) => {
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    done(null, rows[0] || null);
  } catch (error) {
    done(error);
  }
});

export default passport;

// Auth routes: Google sign-in, OAuth callback, logout.
import { Router } from 'express';
import passport from '../auth/passport.js';

const router = Router();
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Kick off Google OAuth (full-page navigation from the frontend).
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Google redirects back here; on success a session is established.
router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: `${CLIENT_URL}/?auth=failed` }),
  (req, res) => {
    res.redirect(CLIENT_URL);
  },
);

// Log out: clear the passport login and destroy the session.
router.post('/logout', (req, res, next) => {
  req.logout((logoutErr) => {
    if (logoutErr) return next(logoutErr);

    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.json({ ok: true });
    });
  });
});

export default router;

// Reject requests that aren't from a signed-in user (req.user set by passport).
export const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'You must be signed in to do that.' });
  }

  next();
};

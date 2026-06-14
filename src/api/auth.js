// Frontend helpers for the current session / auth.

// Returns the signed-in user object, or null if logged out / on error.
export const getMe = async () => {
  try {
    const response = await fetch('/api/me');
    if (!response.ok) return null;
    const data = await response.json();
    return data.user;
  } catch {
    return null;
  }
};

export const logout = async () => {
  await fetch('/auth/logout', { method: 'POST' });
};

// Permanently deletes the current account and all its trees (cascade).
export const deleteAccount = async () => {
  const response = await fetch('/api/me', { method: 'DELETE' });
  return response.ok;
};

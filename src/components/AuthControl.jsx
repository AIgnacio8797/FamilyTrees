import { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronDown,
  faRightFromBracket,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';

// Top-right auth widget: "Sign in with Google" when logged out, or the user's
// name/avatar with a menu (sign out, delete account) when logged in.
export function AuthControl({ currentUser, onSignOut, onDeleteAccount }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;

    const onPointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setMenuOpen(false);
    };

    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [menuOpen]);

  if (!currentUser) {
    return (
      <a className="auth-control auth-signin" href="/auth/google">
        Sign in with Google
      </a>
    );
  }

  const confirmDelete = () => {
    setMenuOpen(false);
    const ok = window.confirm(
      'Permanently delete your account and ALL of your saved trees?\n\nThis cannot be undone.',
    );
    if (ok) onDeleteAccount();
  };

  return (
    <div className="auth-control" ref={containerRef}>
      <button
        type="button"
        className="auth-user"
        onClick={() => setMenuOpen((open) => !open)}
        aria-haspopup="true"
        aria-expanded={menuOpen}
      >
        {currentUser.avatar_url && (
          <img className="auth-avatar" src={currentUser.avatar_url} alt="" referrerPolicy="no-referrer" />
        )}
        <span className="auth-name">{currentUser.name || currentUser.email}</span>
        <FontAwesomeIcon icon={faChevronDown} className="auth-chevron" />
      </button>

      {menuOpen && (
        <div className="auth-menu" role="menu">
          <button
            type="button"
            className="auth-menu-item"
            role="menuitem"
            onClick={() => { setMenuOpen(false); onSignOut(); }}
          >
            <FontAwesomeIcon icon={faRightFromBracket} />
            Sign out
          </button>
          <button
            type="button"
            className="auth-menu-item danger"
            role="menuitem"
            onClick={confirmDelete}
          >
            <FontAwesomeIcon icon={faTriangleExclamation} />
            Delete my account
          </button>
        </div>
      )}
    </div>
  );
}

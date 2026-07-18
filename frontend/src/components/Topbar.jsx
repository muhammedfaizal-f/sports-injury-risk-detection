import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Topbar.css';

export default function Topbar({ activePage, userName }) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSignOut = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const links = [
    { key: 'overview', label: 'Overview', path: '/dashboard' },
    { key: 'videos', label: 'Videos', path: '/videos' },
    { key: 'analysis', label: 'Analysis', path: '/analysis' },
    { key: 'profile', label: 'My Profile', path: '/profile' },
  ];

  const go = (path, disabled) => {
    if (disabled) return;
    setMenuOpen(false);
    navigate(path);
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <span className="topbar-logo">
          <span className="logo-dot" />
          SIRD
        </span>
        <nav className="topbar-links topbar-links--desktop">
          {links.map((l) => (
            <button
              key={l.key}
              className={`topbar-link ${activePage === l.key ? 'active' : ''}`}
              onClick={() => go(l.path, l.disabled)}
              disabled={l.disabled}
            >
              {l.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="topbar-right topbar-right--desktop">
        <span className="topbar-user">{userName}</span>
        <button className="topbar-signout" onClick={handleSignOut}>Sign out</button>
      </div>

      <button
        className={`topbar-hamburger ${menuOpen ? 'open' : ''}`}
        onClick={() => setMenuOpen((v) => !v)}
        aria-label="Toggle menu"
      >
        <span /><span /><span />
      </button>

      <div className={`topbar-mobile-menu ${menuOpen ? 'open' : ''}`}>
        {links.map((l) => (
          <button
            key={l.key}
            className={`topbar-mobile-link ${activePage === l.key ? 'active' : ''}`}
            onClick={() => go(l.path, l.disabled)}
            disabled={l.disabled}
          >
            {l.label}
          </button>
        ))}
        <div className="topbar-mobile-footer">
          <span className="topbar-user">{userName}</span>
          <button className="topbar-signout" onClick={handleSignOut}>Sign out</button>
        </div>
      </div>
    </header>
  );
}

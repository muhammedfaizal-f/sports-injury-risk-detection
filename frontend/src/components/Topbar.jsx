import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import { decodeToken } from '../utils/auth';
import { getRoleConfig } from '../utils/roleConfig';
import './Topbar.css';

export default function Topbar({ activePage, userName }) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const token = localStorage.getItem('token');
  const decoded = token ? decodeToken(token) : null;
  const role = decoded?.role || 'athlete';
  const config = getRoleConfig(role);

  const handleSignOut = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const go = (path) => {
    setMenuOpen(false);
    navigate(path);
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <span className="topbar-logo">
          <span className="logo-dot" />
          SIRD
          <span className="topbar-role-tag">{config.label}</span>
        </span>
        <nav className="topbar-links topbar-links--desktop">
          {config.navLinks.map((l) => (
            <button
              key={l.key}
              className={`topbar-link ${activePage === l.key ? 'active' : ''}`}
              onClick={() => go(l.path)}
            >
              {l.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="topbar-right topbar-right--desktop">
        <ThemeToggle />
        <span className="topbar-user">{userName || config.label}</span>
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
        {config.navLinks.map((l) => (
          <button
            key={l.key}
            className={`topbar-mobile-link ${activePage === l.key ? 'active' : ''}`}
            onClick={() => go(l.path)}
          >
            {l.label}
          </button>
        ))}
        <div className="topbar-mobile-footer">
          <ThemeToggle />
          <span className="topbar-user">{userName || config.label}</span>
          <button className="topbar-signout" onClick={handleSignOut}>Sign out</button>
        </div>
      </div>
    </header>
  );
}
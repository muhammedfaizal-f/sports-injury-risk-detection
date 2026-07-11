import { useNavigate } from 'react-router-dom';
import './Topbar.css';

export default function Topbar({ activePage, userName }) {
  const navigate = useNavigate();

  const handleSignOut = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const links = [
    { key: 'overview', label: 'Overview', path: '/dashboard' },
    { key: 'videos', label: 'Videos', path: '/videos' },
    { key: 'profile', label: 'My Profile', path: '/profile' },
    { key: 'risk', label: 'Risk Reports', path: '/dashboard', disabled: true },
  ];

  return (
    <header className="topbar">
      <div className="topbar-left">
        <span className="topbar-logo">SIRD</span>
        <nav className="topbar-links">
          {links.map((l) => (
            <button
              key={l.key}
              className={`topbar-link ${activePage === l.key ? 'active' : ''}`}
              onClick={() => !l.disabled && navigate(l.path)}
              disabled={l.disabled}
            >
              {l.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="topbar-right">
        <span className="topbar-user">{userName}</span>
        <button className="topbar-signout" onClick={handleSignOut}>Sign out</button>
      </div>
    </header>
  );
}

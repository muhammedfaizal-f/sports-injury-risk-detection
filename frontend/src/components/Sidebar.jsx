import { useNavigate } from 'react-router-dom';
import './Sidebar.css';

export default function Sidebar({ activePage, userName }) {
  const navigate = useNavigate();

  const handleSignOut = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const navItems = [
    { key: 'dashboard', label: 'Dashboard', path: '/dashboard' },
    { key: 'risk', label: 'Injury Risk Analysis', path: '/dashboard', disabled: true },
    { key: 'athletes', label: 'Athletes & Profiles', path: '/profile' },
    { key: 'diagnostics', label: 'System Diagnostics', path: '/dashboard', disabled: true },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-mark">AG</span>
        <span className="brand-name">AthleteGuard <small>AI</small></span>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <button
            key={item.key}
            className={`sidebar-link ${activePage === item.key ? 'active' : ''}`}
            onClick={() => !item.disabled && navigate(item.path)}
            disabled={item.disabled}
            title={item.disabled ? 'Coming in a later milestone' : ''}
          >
            {item.label}
            {item.disabled && <span className="soon-tag">soon</span>}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <span className="user-avatar">{userName?.[0]?.toUpperCase() || 'U'}</span>
          <span className="user-name">{userName || 'User'}</span>
        </div>
        <button className="sidebar-signout" onClick={handleSignOut}>Sign Out</button>
      </div>
    </aside>
  );
}
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../components/Topbar';
import api from '../api';
import { useToast } from '../components/ToastContext';
import './RoleDashboards.css';

export default function JoinOrganization() {
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(null);
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleJoin = async (e) => {
    e.preventDefault();
    if (code.length !== 4) return showToast('Enter the 4-digit code', 'error');
    setJoining(true);
    try {
      const res = await api.post('/organizations/join', { code });
      setJoined(res.data);
      showToast(`Joined ${res.data.organization_name}`, 'success');
    } catch (err) {
      showToast(err.response?.data?.detail || 'Could not join', 'error');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="role-dashboard-page">
      <Topbar activePage="settings" userName="Athlete" />
      <main className="role-main" style={{ maxWidth: 420 }}>
        <div className="role-header fade-in-up">
          <h1>Join an Organization</h1>
          <p className="role-subtitle">Ask your admin for a 4-digit join code to connect with your team.</p>
        </div>

        <div className="role-panel fade-in-up stagger" style={{ '--delay': '0.05s' }}>
          {joined ? (
            <div className="join-success">
              <span className="join-success-icon">✓</span>
              <h3>You've joined {joined.organization_name}</h3>
              <p className="panel-hint">Your coach, physiotherapist, and sports scientist can now see your profile.</p>
              <button onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
            </div>
          ) : (
            <form onSubmit={handleJoin} className="join-code-form">
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                placeholder="0000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="join-code-input"
              />
              <button type="submit" disabled={joining}>
                {joining ? <span className="spinner" /> : 'Join'}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
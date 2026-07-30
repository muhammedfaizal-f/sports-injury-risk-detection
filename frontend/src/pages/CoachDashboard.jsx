import { useState, useEffect } from 'react';
import Topbar from '../components/Topbar';
import api from '../api';
import { useToast } from '../components/ToastContext';
import './RoleDashboards.css';

export default function CoachDashboard() {
  const [team, setTeam] = useState([]);
  const [sentInvites, setSentInvites] = useState([]);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  const loadTeam = () => api.get('/dashboard/coach/team').then((res) => setTeam(res.data)).catch(() => setTeam([]));
  const loadInvites = () => api.get('/invites/sent').then((res) => setSentInvites(res.data)).catch(() => setSentInvites([]));

  useEffect(() => {
    Promise.all([loadTeam(), loadInvites()]).finally(() => setLoading(false));
  }, []);

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!email) return;
    setSending(true);
    try {
      await api.post('/invites/send', { athlete_email: email });
      showToast(`Invite sent to ${email}`, 'success');
      setEmail('');
      loadInvites();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Could not send invite', 'error');
    } finally {
      setSending(false);
    }
  };

  const highRiskCount = team.filter((a) => ['high', 'critical'].includes(a.latest_risk_category)).length;

  return (
    <div className="role-dashboard-page">
      <Topbar activePage="overview" userName="Coach" />
      <main className="role-main">
        <div className="role-header fade-in-up">
          <h1>Team Risk Overview</h1>
          <p className="role-subtitle">Invite athletes by email and track their injury risk status.</p>
        </div>

        <div className="role-stat-strip fade-in-up stagger" style={{ '--delay': '0.05s' }}>
          <div className="role-stat-item">
            <span className="role-stat-value">{team.length}</span>
            <span className="role-stat-label">Athletes on Team</span>
          </div>
          <div className="role-stat-item">
            <span className="role-stat-value">{highRiskCount}</span>
            <span className="role-stat-label">High/Critical Risk</span>
          </div>
          <div className="role-stat-item">
            <span className="role-stat-value">{sentInvites.filter((i) => i.status === 'pending').length}</span>
            <span className="role-stat-label">Pending Invites</span>
          </div>
        </div>

        <div className="role-panel fade-in-up stagger" style={{ '--delay': '0.1s' }}>
          <h3>Invite an Athlete</h3>
          <form className="link-form" onSubmit={handleInvite}>
            <input
              type="email"
              placeholder="athlete@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button type="submit" disabled={sending}>
              {sending ? <span className="spinner" /> : 'Send Invite'}
            </button>
          </form>
        </div>

        <div className="role-panel fade-in-up stagger" style={{ '--delay': '0.15s' }}>
          <h3>Sent Invites</h3>
          {loading ? (
            <p className="role-empty">Loading...</p>
          ) : sentInvites.length === 0 ? (
            <p className="role-empty">No invites sent yet.</p>
          ) : (
            <table className="role-table">
              <thead><tr><th>Email</th><th>Status</th></tr></thead>
              <tbody>
                {sentInvites.map((inv) => (
                  <tr key={inv.id}>
                    <td>{inv.athlete_email}</td>
                    <td><span className={`invite-pill ${inv.status}`}>{inv.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="role-panel fade-in-up stagger" style={{ '--delay': '0.2s' }}>
          <h3>Team</h3>
          {loading ? (
            <p className="role-empty">Loading...</p>
          ) : team.length === 0 ? (
            <p className="role-empty">No athletes on your team yet. Send an invite above.</p>
          ) : (
            <table className="role-table">
              <thead>
                <tr><th>Athlete</th><th>Sport</th><th>Videos Analyzed</th><th>Latest Risk</th><th>Injury Type</th></tr>
              </thead>
              <tbody>
                {team.map((a) => (
                  <tr key={a.athlete_id}>
                    <td>{a.full_name}</td>
                    <td>{a.sport_type || '—'}</td>
                    <td>{a.videos_analyzed}</td>
                    <td><span className={`risk-pill ${a.latest_risk_category || 'none'}`}>{a.latest_risk_category || 'No data'}</span></td>
                    <td>{a.latest_injury_type || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
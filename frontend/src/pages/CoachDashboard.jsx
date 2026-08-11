import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../components/Topbar';
import EmptyState from '../components/EmptyState';
import AnimatedCounter from '../components/AnimatedCounter';
import api from '../api';
import { useToast } from '../components/ToastContext';
import './RoleDashboards.css';

const TREND_ICON = { up: '↑', down: '↓', flat: '→' };
const RISK_ORDER = { critical: 0, high: 1, moderate: 2, low: 3, none: 4 };

export default function CoachDashboard() {
  const [team, setTeam] = useState([]);
  const [sentInvites, setSentInvites] = useState([]);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('risk');
  const [filterRisk, setFilterRisk] = useState('all');
  const { showToast } = useToast();
  const navigate = useNavigate();

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
  const avgLoad = useMemo(() => {
    const loads = { Low: 1, Moderate: 2, High: 3 };
    const withLoad = team.filter((a) => a.training_load);
    if (!withLoad.length) return null;
    const sum = withLoad.reduce((s, a) => s + (loads[a.training_load] || 2), 0);
    const avg = sum / withLoad.length;
    return avg <= 1.5 ? 'Low' : avg <= 2.5 ? 'Moderate' : 'High';
  }, [team]);

  const visibleTeam = useMemo(() => {
    let list = [...team];
    if (filterRisk !== 'all') {
      list = list.filter((a) =>
        filterRisk === 'none' ? !a.latest_risk_category : a.latest_risk_category === filterRisk
      );
    }
    list.sort((a, b) => {
      if (sortBy === 'risk') {
        return (RISK_ORDER[a.latest_risk_category || 'none']) - (RISK_ORDER[b.latest_risk_category || 'none']);
      }
      if (sortBy === 'name') return a.full_name.localeCompare(b.full_name);
      if (sortBy === 'videos') return b.videos_analyzed - a.videos_analyzed;
      return 0;
    });
    return list;
  }, [team, sortBy, filterRisk]);

  return (
    <div className="role-dashboard-page">
      <Topbar activePage="overview" userName="Coach" />
      <main className="role-main">
        <div className="role-header fade-in-up">
          <h1>Team Risk Overview</h1>
          <p className="role-subtitle">Invite athletes by email and track their injury risk status.</p>
        </div>

        {loading ? (
          <div className="role-panel skeleton" style={{ height: 100 }} />
        ) : (
          <div className="role-stat-strip fade-in-up stagger" style={{ '--delay': '0.05s' }}>
            <div className="role-stat-item">
              <span className="role-stat-value"><AnimatedCounter value={team.length} /></span>
              <span className="role-stat-label">Athletes on Team</span>
            </div>
            <div className="role-stat-item">
              <span className="role-stat-value"><AnimatedCounter value={highRiskCount} /></span>
              <span className="role-stat-label">High/Critical Risk</span>
            </div>
            <div className="role-stat-item">
              <span className="role-stat-value"><AnimatedCounter value={sentInvites.filter((i) => i.status === 'pending').length} /></span>
              <span className="role-stat-label">Pending Invites</span>
            </div>
            <div className="role-stat-item">
              <span className="role-stat-value">{avgLoad || '—'}</span>
              <span className="role-stat-label">Avg Training Load</span>
            </div>
          </div>
        )}

        {highRiskCount > 0 && (
          <div className="team-alert-banner fade-in-up stagger" style={{ '--delay': '0.08s' }}>
            ⚠ {highRiskCount} athlete{highRiskCount > 1 ? 's' : ''} currently flagged high or critical risk — review below.
          </div>
        )}

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
            <EmptyState icon="✉️" title="No invites sent yet" description="Invite your first athlete above." />
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
          <div className="panel-header-row">
            <h3>Team</h3>
            <div className="team-controls">
              <select value={filterRisk} onChange={(e) => setFilterRisk(e.target.value)}>
                <option value="all">All risk levels</option>
                <option value="critical">Critical only</option>
                <option value="high">High only</option>
                <option value="moderate">Moderate only</option>
                <option value="low">Low only</option>
                <option value="none">No data yet</option>
              </select>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="risk">Sort: Highest risk first</option>
                <option value="name">Sort: Name</option>
                <option value="videos">Sort: Most analyzed</option>
              </select>
            </div>
          </div>

          {loading ? (
            <p className="role-empty">Loading...</p>
          ) : team.length === 0 ? (
            <EmptyState icon="🏃" title="No athletes on your team yet" description="Send an invite above to get started." />
          ) : visibleTeam.length === 0 ? (
            <p className="role-empty">No athletes match this filter.</p>
          ) : (
            <table className="role-table">
              <thead>
                <tr><th>Athlete</th><th>Sport</th><th>Load</th><th>Videos</th><th>Latest Risk</th><th>Trend</th><th>Injury Type</th><th></th></tr>
              </thead>
              <tbody>
                {visibleTeam.map((a) => (
                  <tr key={a.athlete_id} className="clickable-row" onClick={() => navigate(`/coach-dashboard/athlete/${a.athlete_id}`)}>
                    <td>{a.full_name}</td>
                    <td>{a.sport_type || '—'}</td>
                    <td>{a.training_load || '—'}</td>
                    <td>{a.videos_analyzed}</td>
                    <td><span className={`risk-pill ${a.latest_risk_category || 'none'}`}>{a.latest_risk_category || 'No data'}</span></td>
                    <td>
                      <span className={`trend-tag trend-${a.risk_trend}`}>
                        {TREND_ICON[a.risk_trend]}
                      </span>
                    </td>
                    <td>{a.latest_injury_type || '—'}</td>
                    <td className="row-arrow">→</td>
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
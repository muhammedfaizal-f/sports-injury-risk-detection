import { useState, useEffect } from 'react';
import Topbar from '../components/Topbar';
import AnimatedCounter from '../components/AnimatedCounter';
import { useToast } from '../components/ToastContext';
import api from '../api';
import './Dashboard.css';

export default function Dashboard() {
  const [hasProfile, setHasProfile] = useState(null);
  const [invites, setInvites] = useState([]);
  const { showToast } = useToast();


  const loadInvites = () => api.get('/invites/received').then((res) => setInvites(res.data)).catch(() => setInvites([]));

  useEffect(() => { loadInvites(); }, []);

  const respondToInvite = async (inviteId, accept) => {
    try {
      await api.post(`/invites/${inviteId}/respond`, { accept });
      showToast(accept ? 'Invite accepted — coach added' : 'Invite declined', accept ? 'success' : 'info');
      loadInvites();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Could not respond to invite', 'error');
    }
  };

  useEffect(() => {
    api.get('/athletes/me')
      .then(() => setHasProfile(true))
      .catch(() => setHasProfile(false));
  }, []);

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  const stats = [
    { label: 'Videos Uploaded', value: '—', note: 'Live once you upload clips' },
    { label: 'Videos Processed', value: '—', note: 'Frame extraction (Milestone 2)' },
    { label: 'Injury Risk Score', value: '—', note: 'Arrives in Milestone 3' },
  ];

  return (
    <div className="dashboard-page">
      <Topbar activePage="overview" userName="Athlete" />

      <main className="dashboard-main">
        <div className="dashboard-header fade-in-up">
          <h1>Welcome back</h1>
          <p className="dashboard-subtitle">{today}</p>
        </div>

        {hasProfile === false && (
          <div className="dashboard-alert fade-in-up stagger" style={{ '--delay': '0.05s' }}>
            You haven't set up your athlete profile yet.{' '}
            <a href="/profile">Complete it here</a> to start uploading videos.
          </div>
        )}
        {invites.length > 0 && (
          <div className="dashboard-panel fade-in-up stagger" style={{ '--delay': '0.12s' }}>
            <h3>Coach Invites</h3>
            <div className="invite-request-list">
              {invites.map((inv) => (
                <div className="invite-request-row" key={inv.id}>
                  <span>Coach (ID {inv.coach_id}) invited you to join their team</span>
                  <div className="invite-request-actions">
                    <button onClick={() => respondToInvite(inv.id, true)}>Accept</button>
                    <button className="btn-ghost" onClick={() => respondToInvite(inv.id, false)}>Decline</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="stat-strip fade-in-up stagger" style={{ '--delay': '0.1s' }}>
          {stats.map((s) => (
            <div className="stat-item" key={s.label}>
              <span className="stat-value">
                {typeof s.value === 'number' ? <AnimatedCounter value={s.value} suffix={s.suffix || ''} /> : s.value}
              </span>
              <span className="stat-label">{s.label}</span>
              <span className="stat-note">{s.note}</span>
            </div>
          ))}
        </div>

        <div className="dashboard-panel fade-in-up stagger" style={{ '--delay': '0.18s' }}>
          <h3>Recent Uploads</h3>
          <p className="panel-empty">
            Go to <a href="/videos">Videos</a> to upload and process a clip, then view
            results in <a href="/analysis">Analysis</a>.
          </p>
        </div>
      </main>
    </div>
  );
}

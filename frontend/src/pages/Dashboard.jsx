import { useState, useEffect } from 'react';
import Topbar from '../components/Topbar';
import api from '../api';
import './Dashboard.css';

export default function Dashboard() {
  const [hasProfile, setHasProfile] = useState(null);

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

        <div className="stat-strip fade-in-up stagger" style={{ '--delay': '0.1s' }}>
          {stats.map((s) => (
            <div className="stat-item" key={s.label}>
              <span className="stat-value">{s.value}</span>
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

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Topbar from '../components/Topbar';
import EmptyState from '../components/EmptyState';
import api from '../api';
import './RoleDashboards.css';

export default function CoachAthleteDetail() {
  const { athleteId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get(`/dashboard/coach/athlete/${athleteId}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.detail || 'Could not load athlete'));
  }, [athleteId]);

  if (error) {
    return (
      <div className="role-dashboard-page">
        <Topbar activePage="overview" userName="Coach" />
        <main className="role-main">
          <EmptyState icon="⚠️" title="Could not load athlete" description={error} actionLabel="Back to Team" onAction={() => navigate('/coach-dashboard')} />
        </main>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="role-dashboard-page">
        <Topbar activePage="overview" userName="Coach" />
        <main className="role-main"><div className="role-panel skeleton" style={{ height: 300 }} /></main>
      </div>
    );
  }

  return (
    <div className="role-dashboard-page">
      <Topbar activePage="overview" userName="Coach" />
      <main className="role-main">
        <button className="back-link" onClick={() => navigate('/coach-dashboard')}>← Back to Team</button>

        <div className="role-header fade-in-up">
          <h1>{data.full_name}</h1>
          <p className="role-subtitle">{data.sport_type || 'No sport set'} {data.position ? `· ${data.position}` : ''}</p>
        </div>

        <div className="role-stat-strip fade-in-up stagger" style={{ '--delay': '0.05s' }}>
          <div className="role-stat-item"><span className="role-stat-value">{data.age || '—'}</span><span className="role-stat-label">Age</span></div>
          <div className="role-stat-item"><span className="role-stat-value">{data.training_load || '—'}</span><span className="role-stat-label">Training Load</span></div>
          <div className="role-stat-item"><span className="role-stat-value">{data.videos_total}</span><span className="role-stat-label">Videos Uploaded</span></div>
        </div>

        <div className="role-panel fade-in-up stagger" style={{ '--delay': '0.1s' }}>
          <h3>Quality Score History</h3>
          {data.quality_history.length === 0 ? (
            <EmptyState icon="📈" title="No analyzed videos yet" />
          ) : (
            <table className="role-table">
              <thead><tr><th>Video</th><th>Quality Score</th></tr></thead>
              <tbody>
                {data.quality_history.map((q) => (
                  <tr key={q.video_id}><td>#{q.video_id}</td><td>{q.score} / 100</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="role-panel fade-in-up stagger" style={{ '--delay': '0.15s' }}>
          <h3>Injury Risk History</h3>
          {data.risk_history.length === 0 ? (
            <EmptyState icon="⚠️" title="No risk predictions yet" />
          ) : (
            <table className="role-table">
              <thead><tr><th>Video</th><th>Score</th><th>Category</th><th>Injury Type</th></tr></thead>
              <tbody>
                {data.risk_history.map((r) => (
                  <tr key={r.video_id}>
                    <td>#{r.video_id}</td>
                    <td>{r.score}</td>
                    <td><span className={`risk-pill ${r.category}`}>{r.category}</span></td>
                    <td>{r.injury_type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="role-panel fade-in-up stagger" style={{ '--delay': '0.2s' }}>
          <h3>Injury History (self-reported)</h3>
          <p className="role-empty">{data.injury_history || 'None reported.'}</p>
        </div>
      </main>
    </div>
  );
}
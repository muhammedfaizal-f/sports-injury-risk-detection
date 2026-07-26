import { useState } from 'react';
import Topbar from '../components/Topbar';
import api from '../api';
import './RoleDashboards.css';

export default function PhysioDashboard() {
  const [athleteId, setAthleteId] = useState('');
  const [data, setData] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!athleteId) return;
    setLoading(true);
    setMessage('');
    try {
      const res = await api.get(`/dashboard/physio/athlete/${athleteId}`);
      setData(res.data);
    } catch (err) {
      setData(null);
      setMessage(err.response?.data?.detail || 'Athlete not found');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="role-dashboard-page">
      <Topbar activePage="overview" userName="Physiotherapist" />
      <main className="role-main">
        <div className="role-header fade-in-up">
          <h1>Rehabilitation Tracking</h1>
          <p className="role-subtitle">Look up an athlete by ID to review their quality and risk trend.</p>
        </div>

        <div className="role-panel fade-in-up stagger" style={{ '--delay': '0.05s' }}>
          <form className="link-form" onSubmit={handleSearch}>
            <input
              type="number"
              placeholder="Athlete ID"
              value={athleteId}
              onChange={(e) => setAthleteId(e.target.value)}
            />
            <button type="submit" disabled={loading}>{loading ? 'Searching...' : 'View Athlete'}</button>
          </form>
          {message && <p className="error-text">{message}</p>}
        </div>

        {data && (
          <>
            <div className="role-stat-strip fade-in-up stagger" style={{ '--delay': '0.1s' }}>
              <div className="role-stat-item">
                <span className="role-stat-value">{data.full_name}</span>
                <span className="role-stat-label">Athlete</span>
              </div>
              <div className="role-stat-item">
                <span className="role-stat-value">{data.videos_total}</span>
                <span className="role-stat-label">Videos Uploaded</span>
              </div>
              <div className="role-stat-item">
                <span className="role-stat-value">{data.training_load || '—'}</span>
                <span className="role-stat-label">Training Load</span>
              </div>
            </div>

            <div className="role-panel fade-in-up stagger" style={{ '--delay': '0.15s' }}>
              <h3>Quality Score Trend</h3>
              {data.quality_score_trend.length === 0 ? (
                <p className="role-empty">No analyzed videos yet.</p>
              ) : (
                <table className="role-table">
                  <thead><tr><th>Video</th><th>Quality Score</th></tr></thead>
                  <tbody>
                    {data.quality_score_trend.map((q) => (
                      <tr key={q.video_id}><td>#{q.video_id}</td><td>{q.score} / 100</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="role-panel fade-in-up stagger" style={{ '--delay': '0.2s' }}>
              <h3>Injury Risk Trend</h3>
              {data.risk_trend.length === 0 ? (
                <p className="role-empty">No risk predictions yet.</p>
              ) : (
                <table className="role-table">
                  <thead><tr><th>Video</th><th>Risk Score</th><th>Category</th><th>Injury Type</th></tr></thead>
                  <tbody>
                    {data.risk_trend.map((r) => (
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

            <div className="role-panel fade-in-up stagger" style={{ '--delay': '0.25s' }}>
              <h3>Injury History (self-reported)</h3>
              <p className="role-empty">{data.injury_history || 'None reported.'}</p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
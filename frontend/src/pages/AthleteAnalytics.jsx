import { useState, useEffect } from 'react';
import Topbar from '../components/Topbar';
import EmptyState from '../components/EmptyState';
import api from '../api';
import './RoleDashboards.css';

const HEALTH_LABELS = { excellent: 'Excellent', good: 'Good', at_risk: 'At Risk', critical: 'Critical' };

export default function AthleteAnalytics() {
  const [data, setData] = useState(null);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/athletes/me/analytics'),
      api.get('/videos/mine'),
    ])
      .then(([analyticsRes, videosRes]) => {
        setData(analyticsRes.data);
        setVideos(videosRes.data);
      })
      .catch(() => {
        setData(null);
        setVideos([]);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="role-dashboard-page">
        <Topbar activePage="analytics" userName="Athlete" />
        <main className="role-main"><div className="role-panel skeleton" style={{ height: 300 }} /></main>
      </div>
    );
  }

  if (!data || data.videos_analyzed === 0) {
    return (
      <div className="role-dashboard-page">
        <Topbar activePage="analytics" userName="Athlete" />
        <main className="role-main">
          <div className="role-panel fade-in-up">
            <EmptyState icon="📊" title="No analytics yet" description="Analyze at least one video to see your health analytics." />
          </div>
        </main>
      </div>
    );
  }

  const maxJoint = Math.max(...Object.values(data.joint_deviation_frequency || {}), 1);

  const getDisplayVideoNumber = (videoId) => {
    const index = videos.findIndex(
      (video) => Number(video.id) === Number(videoId)
    );

    return index !== -1 ? index + 1 : videoId;
  };

  return (
    <div className="role-dashboard-page">
      <Topbar activePage="analytics" userName="Athlete" />
      <main className="role-main">
        <div className="role-header fade-in-up">
          <h1>Your Analytics</h1>
          <p className="role-subtitle">Aggregate health index and biomechanical patterns across all your analyzed videos.</p>
        </div>

        <div className="role-stat-strip fade-in-up stagger" style={{ '--delay': '0.05s' }}>
          <div className="role-stat-item"><span className="role-stat-value">{data.avg_quality_score ?? '—'}</span><span className="role-stat-label">Avg Quality</span></div>
          <div className="role-stat-item"><span className="role-stat-value">{data.avg_risk_score ?? '—'}</span><span className="role-stat-label">Avg Risk</span></div>
          <div className="role-stat-item"><span className="role-stat-value">{data.health_score}</span><span className="role-stat-label">Health Score</span></div>
          <div className="role-stat-item">
            <span className={`health-pill health-${data.health_category}`}>{HEALTH_LABELS[data.health_category]}</span>
            <span className="role-stat-label">Status</span>
          </div>
        </div>

        <div className="role-panel fade-in-up stagger" style={{ '--delay': '0.1s' }}>
          <h3>Risk Score Trend</h3>
          {data.risk_trend.length === 0 ? (
            <EmptyState icon="📈" title="No risk predictions yet" />
          ) : (
            <table className="role-table">
              <thead><tr><th>Video</th><th>Risk Score</th><th>Category</th></tr></thead>
              <tbody>
                {data.risk_trend.map((r) => (
                  <tr key={r.video_id}>
                    <td>#{getDisplayVideoNumber(r.video_id)}</td>
                    <td>{r.score}</td>
                    <td><span className={`risk-pill ${r.category}`}>{r.category}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="role-panel fade-in-up stagger" style={{ '--delay': '0.15s' }}>
          <h3>Biomechanical Deviation Frequency</h3>
          {Object.keys(data.joint_deviation_frequency || {}).length === 0 ? (
            <EmptyState icon="📐" title="No deviations flagged" description="Your joint angles have stayed within expected ranges." />
          ) : (
            Object.entries(data.joint_deviation_frequency).map(([joint, count]) => (
              <div className="distribution-bar-row" key={joint}>
                <span className="distribution-bar-label">{joint}</span>
                <div className="distribution-bar-track">
                  <div className="distribution-bar-fill" style={{ width: `${(count / maxJoint) * 100}%` }} />
                </div>
                <span className="distribution-bar-count">{count}</span>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
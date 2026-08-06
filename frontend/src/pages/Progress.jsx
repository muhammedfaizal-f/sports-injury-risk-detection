import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../components/Topbar';
import EmptyState from '../components/EmptyState';
import api from '../api';
import './Progress.css';

export default function Progress() {
  const [points, setPoints] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/athletes/me/progress')
      .then((res) => setPoints(res.data))
      .catch((err) => {
        setPoints(null);
        setError(err.response?.data?.detail || 'Could not load progress data');
      })
      .finally(() => setLoading(false));
  }, []);

  const withQuality = points?.filter((p) => p.quality_score !== null) || [];
  const withRisk = points?.filter((p) => p.risk_score !== null) || [];

  const trend = (() => {
    if (withQuality.length < 2) return null;
    const mid = Math.ceil(withQuality.length / 2);
    const firstHalf = withQuality.slice(0, mid);
    const secondHalf = withQuality.slice(mid);
    const avg = (arr) => arr.reduce((sum, p) => sum + p.quality_score, 0) / arr.length;
    const firstAvg = avg(firstHalf);
    const secondAvg = avg(secondHalf.length ? secondHalf : firstHalf);
    const diff = secondAvg - firstAvg;

    if (Math.abs(diff) < 2) return { label: 'Holding steady', direction: 'flat', diff };
    return diff > 0
      ? { label: 'Improving', direction: 'up', diff }
      : { label: 'Declining', direction: 'down', diff };
  })();

  return (
    <div className="progress-page">
      <Topbar activePage="progress" userName="Athlete" />

      <main className="progress-main">
        <div className="progress-header fade-in-up">
          <h1>Progress Trend</h1>
          <p className="progress-subtitle">
            Movement quality and injury risk across all your analyzed sessions.
          </p>
        </div>

        {loading && <div className="role-panel skeleton" style={{ height: 320 }} />}

        {!loading && error && (
          <div className="role-panel fade-in-up">
            <EmptyState icon="⚠️" title="Could not load progress" description={error} />
          </div>
        )}

        {!loading && !error && points && points.length < 2 && (
          <div className="role-panel fade-in-up">
            <EmptyState
              icon="📈"
              title="Not enough sessions yet"
              description={
                points.length === 0
                  ? 'Upload and analyze a video to start building your progress trend.'
                  : 'You have one analyzed session — analyze at least one more to see a trend over time.'
              }
              actionLabel="Go to Videos"
              onAction={() => navigate('/videos')}
            />
          </div>
        )}

        {!loading && !error && points && points.length >= 2 && (
          <>
            {trend && (
              <div className={`trend-banner fade-in-up trend-${trend.direction}`} style={{ '--delay': '0.05s' }}>
                <span className="trend-icon">
                  {trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '→'}
                </span>
                <span>
                  <strong>{trend.label}</strong> — movement quality score changed by{' '}
                  {trend.diff > 0 ? '+' : ''}{trend.diff.toFixed(1)} points on average across your recent sessions.
                </span>
              </div>
            )}

            <div className="role-panel fade-in-up stagger" style={{ '--delay': '0.1s' }}>
              <h3>Quality Score &amp; Risk Score Over Time</h3>
              <ProgressChart points={points} />
              <div className="chart-legend">
                <span className="legend-item"><span className="legend-dot quality" /> Quality Score</span>
                <span className="legend-item"><span className="legend-dot risk" /> Risk Score</span>
              </div>
            </div>

            <div className="role-panel fade-in-up stagger" style={{ '--delay': '0.15s' }}>
              <h3>Session History</h3>
              <table className="role-table">
                <thead>
                  <tr><th>Date</th><th>Video</th><th>Quality</th><th>Risk</th><th>Category</th></tr>
                </thead>
                <tbody>
                  {points.map((p) => (
                    <tr key={p.video_id}>
                      <td>{p.date}</td>
                      <td>#{p.video_id}</td>
                      <td>{p.quality_score ?? '—'}</td>
                      <td>{p.risk_score ?? '—'}</td>
                      <td>
                        {p.risk_category ? (
                          <span className={`risk-pill ${p.risk_category}`}>{p.risk_category}</span>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function ProgressChart({ points }) {
  const width = 640;
  const height = 220;
  const padding = 32;

  const validQuality = points.filter((p) => p.quality_score !== null);
  const validRisk = points.filter((p) => p.risk_score !== null);

  if (validQuality.length === 0 && validRisk.length === 0) {
    return <p className="role-empty">No score data to plot.</p>;
  }

  const xFor = (i) => padding + (i / Math.max(points.length - 1, 1)) * (width - padding * 2);
  const yFor = (value) => height - padding - (value / 100) * (height - padding * 2);

  const buildPath = (data, key) =>
    data
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(points.indexOf(p))} ${yFor(p[key])}`)
      .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="progress-svg">
      {[0, 25, 50, 75, 100].map((v) => (
        <line
          key={v}
          x1={padding} x2={width - padding}
          y1={yFor(v)} y2={yFor(v)}
          className="chart-gridline"
        />
      ))}

      <path d={buildPath(validQuality, 'quality_score')} className="chart-line quality-line" />
      <path d={buildPath(validRisk, 'risk_score')} className="chart-line risk-line" />

      {validQuality.map((p, i) => (
        <circle key={`q-${i}`} cx={xFor(points.indexOf(p))} cy={yFor(p.quality_score)} r="4" className="chart-dot quality-dot" />
      ))}
      {validRisk.map((p, i) => (
        <circle key={`r-${i}`} cx={xFor(points.indexOf(p))} cy={yFor(p.risk_score)} r="4" className="chart-dot risk-dot" />
      ))}
    </svg>
  );
}
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../components/Topbar';
import EmptyState from '../components/EmptyState';
import AnimatedCounter from '../components/AnimatedCounter';
import api from '../api';
import { useToast } from '../components/ToastContext';
import './Dashboard.css';

const STATUS_STYLES = {
  uploaded: 'status-pending',
  processing: 'status-processing',
  processed: 'status-processing',
  pose_estimated: 'status-processing',
  biomechanics_analyzed: 'status-processing',
  analyzed: 'status-done',
  risk_predicted: 'status-done',
  invalid: 'status-error',
};

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function Dashboard() {
  const [hasProfile, setHasProfile] = useState(null);
  const [userName, setUserName] = useState('');
  const [videos, setVideos] = useState([]);
  const [progress, setProgress] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { showToast } = useToast();

  const loadAll = () => {
    Promise.allSettled([
      api.get('/athletes/me'),
      api.get('/videos/mine'),
      api.get('/invites/received'),
      api.get('/athletes/me/progress'),
    ]).then(([profileRes, videosRes, invitesRes, progressRes]) => {
      setHasProfile(profileRes.status === 'fulfilled');
      if (profileRes.status === 'fulfilled') {
        setUserName(profileRes.value.data?.sport_type ? 'Athlete' : 'Athlete');
      }
      setVideos(videosRes.status === 'fulfilled' ? videosRes.value.data : []);
      setInvites(invitesRes.status === 'fulfilled' ? invitesRes.value.data : []);
      setProgress(progressRes.status === 'fulfilled' ? progressRes.value.data : []);
      setLoading(false);
    });
  };

  useEffect(() => { loadAll(); }, []);

  const respondToInvite = async (inviteId, accept) => {
    try {
      await api.post(`/invites/${inviteId}/respond`, { accept });
      showToast(accept ? 'Invite accepted — coach added' : 'Invite declined', accept ? 'success' : 'info');
      loadAll();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Could not respond to invite', 'error');
    }
  };

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  const analyzedVideos = videos.filter((v) => ['analyzed', 'risk_predicted'].includes(v.status));
  const latestProgress = progress[progress.length - 1];
  const bestQuality = progress.length ? Math.max(...progress.map((p) => p.quality_score || 0)) : null;
  const recentVideos = [...videos].sort((a, b) => b.id - a.id).slice(0, 5);

  const trend = (() => {
    if (progress.length < 2) return null;
    const mid = Math.ceil(progress.length / 2);
    const avg = (arr) => arr.reduce((s, p) => s + (p.quality_score || 0), 0) / arr.length;
    const diff = avg(progress.slice(mid)) - avg(progress.slice(0, mid));
    if (Math.abs(diff) < 2) return { direction: 'flat', label: 'steady' };
    return diff > 0 ? { direction: 'up', label: 'improving' } : { direction: 'down', label: 'declining' };
  })();

  const quickActions = [
  { icon: '🎥', label: 'Upload Video', path: '/videos' },
  { icon: '📈', label: 'View Progress', path: '/progress' },
  { icon: '⚠️', label: 'Latest Risk Report', path: analyzedVideos.length ? `/risk?video=${analyzedVideos[analyzedVideos.length - 1].id}` : '/videos' },
  { icon: '🔑', label: 'Join Organization', path: '/join' },
];

  return (
    <div className="dashboard-page">
      <Topbar activePage="overview" userName="Athlete" />

      <main className="dashboard-main">
        <div className="dashboard-header fade-in-up">
          <div>
            <h1>{getGreeting()}</h1>
            <p className="dashboard-subtitle">{today}</p>
          </div>
        </div>

        {hasProfile === false && (
          <div className="dashboard-alert fade-in-up stagger" style={{ '--delay': '0.05s' }}>
            You haven't set up your athlete profile yet.{' '}
            <a href="/profile">Complete it here</a> to start uploading videos.
          </div>
        )}

        {invites.length > 0 && (
          <div className="dashboard-panel fade-in-up stagger" style={{ '--delay': '0.08s' }}>
            <h3>Coach Invites</h3>
            <div className="invite-request-list">
              {invites.map((inv) => (
                <div className="invite-request-row" key={inv.id}>
                  <span>A coach invited you to join their team</span>
                  <div className="invite-request-actions">
                    <button onClick={() => respondToInvite(inv.id, true)}>Accept</button>
                    <button className="btn-ghost" onClick={() => respondToInvite(inv.id, false)}>Decline</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="role-panel skeleton" style={{ height: 100 }} />
        ) : (
          <div className="stat-strip fade-in-up stagger" style={{ '--delay': '0.1s' }}>
            <div className="stat-item">
              <span className="stat-value"><AnimatedCounter value={videos.length} /></span>
              <span className="stat-label">Videos Uploaded</span>
            </div>
            <div className="stat-item">
              <span className="stat-value"><AnimatedCounter value={analyzedVideos.length} /></span>
              <span className="stat-label">Fully Analyzed</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">
                {latestProgress?.risk_score != null ? <AnimatedCounter value={latestProgress.risk_score} decimals={1} /> : '—'}
              </span>
              <span className="stat-label">Latest Risk Score</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">
                {bestQuality != null ? <AnimatedCounter value={bestQuality} decimals={1} /> : '—'}
              </span>
              <span className="stat-label">Best Quality Score</span>
            </div>
          </div>
        )}

        <div className="quick-actions fade-in-up stagger" style={{ '--delay': '0.15s' }}>
          {quickActions.map((qa) => (
            <button key={qa.label} className="quick-action-card hover-lift ripple-btn" onClick={() => navigate(qa.path)}>
              <span className="quick-action-icon">{qa.icon}</span>
              <span className="quick-action-label">{qa.label}</span>
            </button>
          ))}
        </div>

        <div className="dashboard-panel fade-in-up stagger" style={{ '--delay': '0.2s' }}>
          <div className="panel-header-row">
            <h3>Recent Videos</h3>
            {videos.length > 0 && <a href="/videos" className="panel-link">View all</a>}
          </div>

          {!loading && recentVideos.length === 0 && (
            <EmptyState
              icon="🎬"
              title="No videos yet"
              description="Upload your first movement clip to start getting analysis."
              actionLabel="Upload Video"
              onAction={() => navigate('/videos')}
            />
          )}

          {recentVideos.length > 0 && (
            <div className="recent-video-list">
              {recentVideos.map((v) => (
                <div className="recent-video-row" key={v.id}>
                  <div className="recent-video-info">
                    <span className="recent-video-activity">{v.activity_type}</span>
                    <span className={`video-status ${STATUS_STYLES[v.status] || ''}`}>{v.status}</span>
                  </div>
                  <div className="recent-video-actions">
                    {['analyzed', 'risk_predicted'].includes(v.status) ? (
                      <>
                        <button className="link-btn" onClick={() => navigate(`/analysis?video=${v.id}`)}>Analysis</button>
                        <button className="link-btn" onClick={() => navigate(`/risk?video=${v.id}`)}>Risk</button>
                      </>
                    ) : (
                      <button className="link-btn" onClick={() => navigate('/videos')}>Continue</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="dashboard-panel fade-in-up stagger" style={{ '--delay': '0.25s' }}>
          <div className="panel-header-row">
            <h3>Progress Snapshot</h3>
            {progress.length > 0 && <a href="/progress" className="panel-link">Full trend</a>}
          </div>

          {progress.length < 2 ? (
            <EmptyState
              icon="📈"
              title="Not enough data yet"
              description="Analyze at least 2 videos to see your progress trend here."
            />
          ) : (
            <>
              {trend && (
                <p className={`trend-inline trend-${trend.direction}`}>
                  {trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '→'}{' '}
                  Your movement quality is <strong>{trend.label}</strong> across your last {progress.length} sessions.
                </p>
              )}
              <MiniSparkline points={progress} />
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function MiniSparkline({ points }) {
  const width = 600;
  const height = 80;
  const padding = 8;

  const xFor = (i) => padding + (i / Math.max(points.length - 1, 1)) * (width - padding * 2);
  const yFor = (value) => height - padding - ((value || 0) / 100) * (height - padding * 2);

  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(p.quality_score)}`)
    .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="sparkline-svg">
      <path d={path} className="sparkline-path" />
      {points.map((p, i) => (
        <circle key={i} cx={xFor(i)} cy={yFor(p.quality_score)} r="3" className="sparkline-dot" />
      ))}
    </svg>
  );
}
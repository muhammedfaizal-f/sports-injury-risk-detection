import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Topbar from '../components/Topbar';
import EmptyState from '../components/EmptyState';
import api from '../api';
import { useToast } from '../components/ToastContext';
import './Analysis.css';

const RISK_LABELS = {
  low: 'Low Risk',
  moderate: 'Moderate Risk',
  high: 'High Risk',
  critical: 'Critical Risk',
};

export default function Analysis() {
  const [params] = useSearchParams();

  // REAL DATABASE ID
  const videoId = params.get('video');

  const navigate = useNavigate();
  const { showToast } = useToast();

  const [data, setData] = useState(null);
  const [videos, setVideos] = useState([]);
  const [displayVideoNumber, setDisplayVideoNumber] = useState(videoId);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [running, setRunning] = useState(false);

  /*
   * Find the video's position inside THIS ATHLETE'S videos.
   *
   * Example:
   *
   * Database:
   * 11
   * 14
   *
   * UI:
   * Video #1
   * Video #2
   */
  const loadVideos = async () => {
    try {
      const res = await api.get('/videos/mine');

      setVideos(res.data);

      const index = res.data.findIndex(
        (video) =>
          Number(video.id) === Number(videoId)
      );

      if (index !== -1) {
        setDisplayVideoNumber(index + 1);
      } else {
        setDisplayVideoNumber(videoId);
      }
    } catch (err) {
      // If videos cannot load, keep database ID as fallback
      setDisplayVideoNumber(videoId);
    }
  };

  const loadReport = () => {
    if (!videoId) {
      setLoading(false);
      setError('no-video');
      return;
    }

    setLoading(true);
    setError(null);

    api
      .get(`/videos/${videoId}/report`)
      .then((res) => setData(res.data))
      .catch((err) => {
        setData(null);

        setError(
          err.response?.status === 404
            ? 'not-run'
            : 'failed'
        );
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadVideos();
    loadReport();
  }, [videoId]);

  const runFullPipeline = async () => {
    setRunning(true);

    try {
      await api.post(
        `/videos/${videoId}/analyze-full`
      );

      showToast(
        'Analysis complete',
        'success'
      );

      loadReport();
    } catch (err) {
      const detail =
        err.response?.data?.detail;

      showToast(
        detail?.issues
          ? detail.issues.join('; ')
          : detail || 'Analysis failed',
        'error'
      );
    } finally {
      setRunning(false);
    }
  };

  const circumference =
    2 * Math.PI * 60;

  const scoreOffset = data
    ? circumference -
      (data.quality_score / 100) *
        circumference
    : circumference;

  return (
    <div className="analysis-page">
      <Topbar
        activePage="analysis"
        userName="Athlete"
      />

      <main className="analysis-main">

        <div className="analysis-header fade-in-up">
          <div>

            <h1>
              Movement Analysis{' '}
              {videoId
                ? `— Video #${displayVideoNumber}`
                : ''}
            </h1>

            <p className="analysis-subtitle">
              Biomechanical breakdown of joint angles,
              symmetry, and movement quality.
            </p>

          </div>
        </div>

        {loading && (
          <div className="analysis-grid">

            <div
              className="score-card skeleton"
              style={{ height: 260 }}
            />

            <div className="analysis-panels">

              <div
                className="panel skeleton"
                style={{ height: 180 }}
              />

              <div
                className="panel skeleton"
                style={{ height: 140 }}
              />

            </div>

          </div>
        )}

        {!loading && error === 'no-video' && (
          <div className="panel fade-in-up">
            <EmptyState
              icon="🎬"
              title="No video selected"
              description="Open this page from a video on your Videos page to see its analysis."
              actionLabel="Go to Videos"
              onAction={() => navigate('/videos')}
            />
          </div>
        )}

        {!loading && error === 'not-run' && (
          <div className="panel fade-in-up">
            <EmptyState
              icon="⏳"
              title="Analysis not run yet"
              description="This video hasn't been through pose estimation and biomechanical analysis yet."
              actionLabel={
                running
                  ? 'Analyzing...'
                  : 'Run Full Analysis'
              }
              onAction={runFullPipeline}
            />
          </div>
        )}

        {!loading && error === 'failed' && (
          <div className="panel fade-in-up">
            <EmptyState
              icon="⚠️"
              title="Could not load analysis"
              description="Something went wrong fetching this report. Try again in a moment."
              actionLabel="Retry"
              onAction={loadReport}
            />
          </div>
        )}

        {!loading && data && (
          <div
            className="analysis-grid fade-in-up stagger"
            style={{ '--delay': '0.05s' }}
          >

            <div className="score-card">

              <div className="score-ring">

                <svg
                  width="140"
                  height="140"
                >
                  <circle
                    className="score-ring-bg"
                    cx="70"
                    cy="70"
                    r="60"
                  />

                  <circle
                    className="score-ring-fill"
                    cx="70"
                    cy="70"
                    r="60"
                    strokeDasharray={circumference}
                    strokeDashoffset={scoreOffset}
                  />
                </svg>

                <div className="score-ring-label">

                  <span className="score-ring-value">
                    {data.quality_score}
                  </span>

                  <span className="score-ring-unit">
                    / 100
                  </span>

                </div>

              </div>

              <span
                className={`risk-badge risk-${data.risk_category}`}
              >
                {RISK_LABELS[data.risk_category]}
              </span>

              <p className="score-note">
                Movement quality score, based on
                joint angles and symmetry
              </p>

            </div>

            <div className="analysis-panels">

              <div className="panel">

                <h3>Joint Angles</h3>

                {data.joint_angles.length === 0 ? (
                  <p className="role-empty">
                    No joint angle data available
                    for this video.
                  </p>
                ) : (
                  data.joint_angles.map((j) => (
                    <div
                      className="angle-row"
                      key={j.joint}
                    >

                      <div className="angle-row-labels">

                        <span className="joint-name">
                          {j.joint}
                        </span>

                        <span className="joint-value">
                          {j.value}° / {j.max}°
                        </span>

                      </div>

                      <div className="angle-track">

                        <div
                          className="angle-fill"
                          style={{
                            width: `${Math.min(
                              (j.value / j.max) *
                                100,
                              100
                            )}%`,
                          }}
                        />

                      </div>

                    </div>
                  ))
                )}

              </div>

              <div className="panel">

                <h3>
                  Left / Right Symmetry
                </h3>

                {data.symmetry.left.length === 0 &&
                data.symmetry.right.length === 0 ? (
                  <p className="role-empty">
                    Not enough data to compute
                    symmetry for this video.
                  </p>
                ) : (
                  <div className="symmetry-compare">

                    <div className="symmetry-side">

                      <span className="symmetry-side-label">
                        Left
                      </span>

                      {data.symmetry.left.map((s) => (
                        <div
                          className="angle-row-labels"
                          key={s.label}
                        >
                          <span className="joint-name">
                            {s.label}
                          </span>

                          <span className="joint-value">
                            {s.value}
                          </span>
                        </div>
                      ))}

                    </div>

                    <div className="symmetry-side">

                      <span className="symmetry-side-label">
                        Right
                      </span>

                      {data.symmetry.right.map((s) => (
                        <div
                          className="angle-row-labels"
                          key={s.label}
                        >
                          <span className="joint-name">
                            {s.label}
                          </span>

                          <span className="joint-value">
                            {s.value}
                          </span>
                        </div>
                      ))}

                    </div>

                  </div>
                )}

              </div>

              <div className="panel">

                <h3>Recommendations</h3>

                {data.recommendations.length === 0 ? (
                  <p className="role-empty">
                    No recommendations generated
                    for this video.
                  </p>
                ) : (
                  <ul className="recommendation-list">

                    {data.recommendations.map(
                      (r, i) => (
                        <li
                          className="recommendation-item"
                          key={i}
                        >
                          {r}
                        </li>
                      )
                    )}

                  </ul>
                )}

              </div>

              <div className="panel">

                <h3>Next Step</h3>

                <p className="role-empty">

                  See the full{' '}

                  <a
                    href={`/risk?video=${videoId}`}
                  >
                    Injury Risk Report
                  </a>

                  {' '}for this video.

                </p>

              </div>

            </div>

          </div>
        )}

      </main>
    </div>
  );
}
import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Topbar from '../components/Topbar';
import EmptyState from '../components/EmptyState';
import api from '../api';
import { useToast } from '../components/ToastContext';
import './RiskReport.css';

const FACTOR_LABELS = {
  biomechanical_deviation: 'Biomechanical Deviations',
  historical_injury: 'Historical Injury Factors',
  movement_asymmetry: 'Movement Asymmetry',
  training_load: 'Training Load Indicators',
  fatigue: 'Fatigue Indicators',
};

const RISK_LABELS = { low: 'Low Risk', moderate: 'Moderate Risk', high: 'High Risk', critical: 'Critical Risk' };

export default function RiskReport() {
  const [params] = useSearchParams();
  const videoId = params.get('video');
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [running, setRunning] = useState(false);

  const loadRisk = () => {
    if (!videoId) {
      setLoading(false);
      setError('no-video');
      return;
    }
    setLoading(true);
    setError(null);
    api.get(`/videos/${videoId}/risk`)
      .then((res) => setData(res.data))
      .catch((err) => {
        setData(null);
        setError(err.response?.status === 404 ? 'not-run' : 'failed');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadRisk(); }, [videoId]);

  const runPrediction = async () => {
    setRunning(true);
    try {
      const res = await api.post(`/videos/${videoId}/predict-risk`);
      setData(res.data);
      setError(null);
      showToast('Risk prediction complete', 'success');
    } catch (err) {
      showToast(err.response?.data?.detail || 'Could not run risk prediction', 'error');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="risk-page">
      <Topbar activePage="risk" userName="Athlete" />

      <main className="risk-main">
        <div className="risk-header fade-in-up">
          <div>
            <h1>Injury Risk Report {videoId ? `— Video #${videoId}` : ''}</h1>
            <p className="risk-subtitle">
              Weighted score across biomechanics, history, asymmetry, training load, and fatigue.
            </p>
          </div>
        </div>

        {loading && (
          <>
            <div className="risk-score-card skeleton" style={{ height: 140 }} />
            <div className="panel skeleton" style={{ height: 220 }} />
          </>
        )}

        {!loading && error === 'no-video' && (
          <div className="panel fade-in-up">
            <EmptyState
              icon="🎯"
              title="No video selected"
              description="Open this page from a processed video on your Videos page to see its risk report."
              actionLabel="Go to Videos"
              onAction={() => navigate('/videos')}
            />
          </div>
        )}

        {!loading && error === 'not-run' && (
          <div className="panel fade-in-up">
            <EmptyState
              icon="⏳"
              title="Risk prediction not run yet"
              description="This video has completed Milestone 2 analysis but hasn't been scored for injury risk yet."
              actionLabel={running ? 'Running...' : 'Run Risk Prediction'}
              onAction={runPrediction}
            />
          </div>
        )}

        {!loading && error === 'failed' && (
          <div className="panel fade-in-up">
            <EmptyState
              icon="⚠️"
              title="Could not load risk report"
              description="Something went wrong fetching this report. Try again in a moment."
              actionLabel="Retry"
              onAction={loadRisk}
            />
          </div>
        )}

        {!loading && data && (
          <>
            <div
              className={`risk-score-card fade-in-up stagger risk-border-${data.risk_category}`}
              style={{ '--delay': '0.05s' }}
            >
              <div className="risk-score-main">
                <span className="risk-score-value">{data.risk_score}</span>
                <span className="risk-score-unit">/ 100</span>
              </div>
              <span className={`risk-badge risk-${data.risk_category}`}>
                {RISK_LABELS[data.risk_category]}
              </span>
              <span className="injury-type-tag">{data.injury_type}</span>
            </div>

            <div className="panel fade-in-up stagger" style={{ '--delay': '0.1s' }}>
              <h3>Factor Breakdown</h3>
              <p className="panel-hint">
                Weighted Scoring Model — Biomech 35% · History 20% · Asymmetry 20% · Load 15% · Fatigue 10%
              </p>
              {Object.entries(data.factors_json?.factor_breakdown || {}).map(([key, f]) => {
                const maxContribution = Math.max(
                  ...Object.values(data.factors_json.factor_breakdown).map((x) => x.contribution),
                  1
                );
                return (
                  <div className="factor-row" key={key}>
                    <div className="factor-row-labels">
                      <span className="factor-name">{FACTOR_LABELS[key] || key}</span>
                      <span className="factor-value">
                        {f.score} × {Math.round(f.weight * 100)}% = {f.contribution}
                      </span>
                    </div>
                    <div className="factor-track">
                      <div
                        className="factor-fill"
                        style={{ width: `${(f.contribution / maxContribution) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="panel fade-in-up stagger" style={{ '--delay': '0.15s' }}>
              <h3>Why This Score</h3>
              {data.factors_json?.explanation?.length > 0 ? (
                <ul className="explanation-list">
                  {data.factors_json.explanation.map((e, i) => (
                    <li key={i} className="explanation-item">{e}</li>
                  ))}
                </ul>
              ) : (
                <p className="role-empty">No specific risk factors were flagged for this video.</p>
              )}
            </div>

            <div className="panel fade-in-up stagger" style={{ '--delay': '0.2s' }}>
              <h3>Export</h3>
              <p className="panel-hint" style={{ marginBottom: '0.75rem' }}>
                Download this report as PDF or Excel from the Reports page.
              </p>
              <button onClick={() => navigate(`/reports?video=${videoId}`)}>Go to Reports</button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
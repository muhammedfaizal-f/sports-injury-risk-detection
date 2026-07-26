import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Topbar from '../components/Topbar';
import api from '../api';
import './RiskReport.css';

const mockRisk = {
  risk_score: 62.5,
  risk_category: 'high',
  injury_type: 'ACL Injury Risk',
  factors_json: {
    factor_breakdown: {
      biomechanical_deviation: { score: 68, weight: 0.35, contribution: 23.8 },
      historical_injury: { score: 60, weight: 0.20, contribution: 12.0 },
      movement_asymmetry: { score: 40, weight: 0.20, contribution: 8.0 },
      training_load: { score: 90, weight: 0.15, contribution: 13.5 },
      fatigue: { score: 52, weight: 0.10, contribution: 5.2 },
    },
    explanation: [
      'Left knee minimum angle (58°) below expected range — possible excessive flexion/collapse',
      'Left/right movement asymmetry detected (12.4% deviation)',
      'Prior injury history noted: Knee',
      'High training load reported — elevated overuse risk',
    ],
  },
};

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
  const [data, setData] = useState(null);
  const [isMock, setIsMock] = useState(false);

  useEffect(() => {
    if (!videoId) {
      setData(mockRisk);
      setIsMock(true);
      return;
    }
    api.get(`/videos/${videoId}/risk`)
      .then((res) => { setData(res.data); setIsMock(false); })
      .catch(() => { setData(mockRisk); setIsMock(true); });
  }, [videoId]);

  if (!data) {
    return (
      <div className="risk-page">
        <Topbar activePage="analysis" userName="Athlete" />
        <main className="risk-main">
          <div className="risk-score-card skeleton" style={{ height: 200 }} />
          <div className="panel skeleton" style={{ height: 240 }} />
        </main>
      </div>
    );
  }

  const factors = data.factors_json?.factor_breakdown || {};
  const explanation = data.factors_json?.explanation || [];
  const maxContribution = Math.max(...Object.values(factors).map((f) => f.contribution), 1);

  return (
    <div className="risk-page">
      <Topbar activePage="analysis" userName="Athlete" />

      <main className="risk-main">
        <div className="risk-header fade-in-up">
          <div>
            <h1>Injury Risk Report {videoId ? `— Video #${videoId}` : ''}</h1>
            <p className="risk-subtitle">
              Weighted score across biomechanics, history, asymmetry, training load, and fatigue.
            </p>
          </div>
        </div>

        {isMock && (
          <div className="mock-banner fade-in-up stagger" style={{ '--delay': '0.05s' }}>
            Showing placeholder data — pass a real ?video= id that has completed risk prediction to see live results.
          </div>
        )}

        <div className={`risk-score-card fade-in-up stagger risk-border-${data.risk_category}`} style={{ '--delay': '0.1s' }}>
          <div className="risk-score-main">
            <span className="risk-score-value">{data.risk_score}</span>
            <span className="risk-score-unit">/ 100</span>
          </div>
          <span className={`risk-badge risk-${data.risk_category}`}>{RISK_LABELS[data.risk_category]}</span>
          <span className="injury-type-tag">{data.injury_type}</span>
        </div>

        <div className="panel fade-in-up stagger" style={{ '--delay': '0.15s' }}>
          <h3>Factor Breakdown</h3>
          <p className="panel-hint">Weighted Scoring Model — Biomech 35% · History 20% · Asymmetry 20% · Load 15% · Fatigue 10%</p>
          {Object.entries(factors).map(([key, f]) => (
            <div className="factor-row" key={key}>
              <div className="factor-row-labels">
                <span className="factor-name">{FACTOR_LABELS[key] || key}</span>
                <span className="factor-value">{f.score} × {Math.round(f.weight * 100)}% = {f.contribution}</span>
              </div>
              <div className="factor-track">
                <div className="factor-fill" style={{ width: `${(f.contribution / maxContribution) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>

        <div className="panel fade-in-up stagger" style={{ '--delay': '0.2s' }}>
          <h3>Why This Score</h3>
          <ul className="explanation-list">
            {explanation.map((e, i) => (<li key={i} className="explanation-item">{e}</li>))}
          </ul>
        </div>
      </main>
    </div>
  );
}
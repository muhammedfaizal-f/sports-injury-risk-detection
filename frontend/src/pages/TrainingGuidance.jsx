import { useState, useEffect } from 'react';
import Topbar from '../components/Topbar';
import EmptyState from '../components/EmptyState';
import api from '../api';
import './RoleDashboards.css';

export default function TrainingGuidance() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/athletes/me/training-guidance')
      .then((res) => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="role-dashboard-page">
      <Topbar activePage="training" userName="Athlete" />
      <main className="role-main">
        <div className="role-header fade-in-up">
          <h1>Training Guidance</h1>
          <p className="role-subtitle">
            AI-generated training adjustments based on your latest injury risk analysis.
            Review with your coach before making changes.
          </p>
        </div>

        {loading && <div className="role-panel skeleton" style={{ height: 220 }} />}

        {!loading && !data?.has_risk_data && (
          <div className="role-panel fade-in-up">
            <EmptyState
              icon="🎯"
              title="No guidance yet"
              description="Upload and analyze a video with a risk prediction to see training guidance here."
            />
          </div>
        )}

        {!loading && data?.has_risk_data && (
          <div className="role-panel fade-in-up stagger" style={{ '--delay': '0.05s' }}>
            <div className="training-context">
              <span className={`risk-pill ${data.training_suggestions.risk_category}`}>
                {data.training_suggestions.risk_category}
              </span>
              <span className="training-injury-tag">{data.training_suggestions.injury_type}</span>
            </div>
            <p className="panel-hint">{data.training_suggestions.risk_note}</p>
            <p className="panel-hint">{data.training_suggestions.load_note}</p>

            <ul className="recommendation-list" style={{ marginTop: '0.75rem' }}>
              {data.training_suggestions.suggestions.map((s, i) => (
                <li className="recommendation-item" key={i}>{s}</li>
              ))}
            </ul>

            <p className="ai-disclaimer">
              These are AI-generated suggestions for review, not a substitute for your coach's judgment.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
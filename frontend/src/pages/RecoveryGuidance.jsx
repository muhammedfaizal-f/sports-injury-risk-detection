import { useState, useEffect } from 'react';
import Topbar from '../components/Topbar';
import EmptyState from '../components/EmptyState';
import api from '../api';
import './RoleDashboards.css';

export default function RecoveryGuidance() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/athletes/me/recovery-guidance')
      .then((res) => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="role-dashboard-page">
      <Topbar activePage="recovery" userName="Athlete" />
      <main className="role-main">
        <div className="role-header fade-in-up">
          <h1>Recovery Guidance</h1>
          <p className="role-subtitle">
            AI-suggested recovery exercises based on movement patterns detected in your latest video.
          </p>
        </div>

        {loading && <div className="role-panel skeleton" style={{ height: 220 }} />}

        {!loading && (!data || data.suggested_exercises.length === 0) && (
          <div className="role-panel fade-in-up">
            <EmptyState
              icon="🏋️"
              title="No suggestions yet"
              description="Analyze a video to get personalized recovery exercise suggestions."
            />
          </div>
        )}

        {!loading && data && data.suggested_exercises.length > 0 && (
          <div className="role-panel fade-in-up stagger" style={{ '--delay': '0.05s' }}>
            <div className="exercise-list">
              {data.suggested_exercises.map((ex) => (
                <div className="exercise-item" key={ex.name} style={{ cursor: 'default' }}>
                  <div className="exercise-info">
                    <span className="exercise-name">{ex.name}</span>
                    <span className="exercise-meta">{ex.sets} sets × {ex.reps} — {ex.target}</span>
                    <span className="exercise-source">From: "{ex.matched_from}"</span>
                  </div>
                </div>
              ))}
            </div>

            <p className="ai-disclaimer">
              These are AI-generated suggestions for professional review — not medical treatment
              or a diagnosis. Consult a physiotherapist for a full assessment.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
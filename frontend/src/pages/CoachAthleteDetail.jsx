import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Topbar from '../components/Topbar';
import EmptyState from '../components/EmptyState';
import api from '../api';
import { useToast } from '../components/ToastContext';
import './RoleDashboards.css';

const STATUS_LABELS = { proposed: 'Proposed', applied: 'Applied', reviewed: 'Reviewed' };
const STATUS_ORDER = ['proposed', 'applied', 'reviewed'];

export default function CoachAthleteDetail() {
  const { athleteId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [data, setData] = useState(null);
  const [training, setTraining] = useState(null);
  const [plans, setPlans] = useState([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState([]);
  const [notes, setNotes] = useState('');
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [error, setError] = useState(null);

  const loadPlans = () => {
    api.get(`/dashboard/coach/athlete/${athleteId}/training-plans`)
      .then((res) => setPlans(res.data))
      .catch(() => setPlans([]));
  };

  useEffect(() => {
    Promise.all([
      api.get(`/dashboard/coach/athlete/${athleteId}`),
      api.get(`/dashboard/coach/athlete/${athleteId}/suggested-training`),
    ])
      .then(([detailRes, trainingRes]) => {
        setData(detailRes.data);
        setTraining(trainingRes.data);
        loadPlans();
      })
      .catch((err) => setError(err.response?.data?.detail || 'Could not load athlete'));
  }, [athleteId]);

  const toggleSuggestion = (s) => {
    setSelectedSuggestions((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  const handleCreatePlan = async () => {
    if (selectedSuggestions.length === 0) return showToast('Select at least one suggestion', 'error');
    setCreatingPlan(true);
    try {
      await api.post('/dashboard/coach/training-plan', {
        athlete_id: Number(athleteId),
        suggestions: selectedSuggestions,
        notes: notes || null,
      });
      showToast('Training plan created', 'success');
      setSelectedSuggestions([]);
      setNotes('');
      loadPlans();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Could not create plan', 'error');
    } finally {
      setCreatingPlan(false);
    }
  };

  const advanceStatus = async (plan) => {
    const idx = STATUS_ORDER.indexOf(plan.status);
    if (idx === STATUS_ORDER.length - 1) return;
    const nextStatus = STATUS_ORDER[idx + 1];
    try {
      await api.put(`/dashboard/coach/training-plan/${plan.id}`, { status: nextStatus });
      showToast(`Plan marked as ${STATUS_LABELS[nextStatus]}`, 'success');
      loadPlans();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Could not update plan', 'error');
    }
  };

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
          <h3>Injury-Free Training Suggestions</h3>
          {!training?.has_risk_data ? (
            <EmptyState icon="🎯" title="No risk data yet" description="This athlete needs at least one analyzed video with a risk prediction." />
          ) : (
            <>
              <div className="training-context">
                <span className={`risk-pill ${training.training_suggestions.risk_category}`}>
                  {training.training_suggestions.risk_category}
                </span>
                <span className="training-injury-tag">{training.training_suggestions.injury_type}</span>
              </div>
              <p className="panel-hint">{training.training_suggestions.risk_note}</p>
              <p className="panel-hint">{training.training_suggestions.load_note}</p>

              <div className="exercise-list" style={{ marginTop: '0.75rem' }}>
                {training.training_suggestions.suggestions.map((s) => {
                  const checked = selectedSuggestions.includes(s);
                  return (
                    <label className={`exercise-item ${checked ? 'checked' : ''}`} key={s}>
                      <input type="checkbox" checked={checked} onChange={() => toggleSuggestion(s)} />
                      <div className="exercise-info">
                        <span className="exercise-name">{s}</span>
                      </div>
                    </label>
                  );
                })}
              </div>

              <div className="settings-field" style={{ marginTop: '1rem' }}>
                <label>Coach Notes (optional)</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Discussed with athlete at today's session..." />
              </div>

              <button onClick={handleCreatePlan} disabled={creatingPlan}>
                {creatingPlan ? <span className="spinner" /> : `Create Training Plan (${selectedSuggestions.length} selected)`}
              </button>
            </>
          )}
        </div>

        <div className="role-panel fade-in-up stagger" style={{ '--delay': '0.15s' }}>
          <h3>Training Plan History</h3>
          {plans.length === 0 ? (
            <EmptyState icon="📋" title="No training plans yet" description="Create one above using the suggestions." />
          ) : (
            <div className="plan-list">
              {plans.map((plan) => (
                <div className="plan-card" key={plan.id}>
                  <div className="plan-card-header">
                    <span className={`plan-status plan-status-${plan.status === 'proposed' ? 'not_started' : plan.status === 'applied' ? 'in_progress' : 'completed'}`}>
                      {STATUS_LABELS[plan.status]}
                    </span>
                    <span className="plan-date">{new Date(plan.created_at).toLocaleDateString()}</span>
                  </div>
                  <ul className="plan-exercise-list">
                    {(plan.suggestions_json || []).map((s, i) => (<li key={i}>{s}</li>))}
                  </ul>
                  {plan.notes && <p className="plan-notes">"{plan.notes}"</p>}
                  {plan.status !== 'reviewed' && (
                    <button className="link-btn" onClick={() => advanceStatus(plan)}>
                      Mark as {STATUS_LABELS[STATUS_ORDER[STATUS_ORDER.indexOf(plan.status) + 1]]}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="role-panel fade-in-up stagger" style={{ '--delay': '0.2s' }}>
          <h3>Quality Score History</h3>
          {data.quality_history.length === 0 ? (
            <EmptyState icon="📈" title="No analyzed videos yet" />
          ) : (
            <table className="role-table">
              <thead><tr><th>Video</th><th>Quality Score</th></tr></thead>
              <tbody>
                {data.quality_history.map((q, index) => (
                  <tr key={q.video_id}>
                    <td>#{index + 1}</td>
                    <td>{q.score} / 100</td>
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
      </main>
    </div>
  );
}
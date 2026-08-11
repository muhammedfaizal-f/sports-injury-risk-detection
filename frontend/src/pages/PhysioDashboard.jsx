import { useState } from 'react';
import Topbar from '../components/Topbar';
import EmptyState from '../components/EmptyState';
import api from '../api';
import { useToast } from '../components/ToastContext';
import './RoleDashboards.css';

const STATUS_LABELS = { not_started: 'Not Started', in_progress: 'In Progress', completed: 'Completed' };
const STATUS_ORDER = ['not_started', 'in_progress', 'completed'];

export default function PhysioDashboard() {
  const [athleteId, setAthleteId] = useState('');
  const [data, setData] = useState(null);
  const [suggested, setSuggested] = useState(null);
  const [plans, setPlans] = useState([]);
  const [selectedExercises, setSelectedExercises] = useState([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [creatingPlan, setCreatingPlan] = useState(false);
  const { showToast } = useToast();

  const loadPlans = (id) => {
    api.get(`/dashboard/physio/athlete/${id}/recovery-plans`)
      .then((res) => setPlans(res.data))
      .catch(() => setPlans([]));
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!athleteId) return;
    setLoading(true);
    setData(null);
    setSuggested(null);
    setSelectedExercises([]);
    setNotes('');
    try {
      const [athleteRes, suggestedRes] = await Promise.all([
        api.get(`/dashboard/physio/athlete/${athleteId}`),
        api.get(`/dashboard/physio/athlete/${athleteId}/suggested-exercises`),
      ]);
      setData(athleteRes.data);
      setSuggested(suggestedRes.data);
      loadPlans(athleteId);
    } catch (err) {
      showToast(err.response?.data?.detail || 'Athlete not found', 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleExercise = (exercise) => {
    setSelectedExercises((prev) =>
      prev.some((e) => e.name === exercise.name)
        ? prev.filter((e) => e.name !== exercise.name)
        : [...prev, exercise]
    );
  };

  const handleCreatePlan = async () => {
    if (selectedExercises.length === 0) {
      return showToast('Select at least one exercise', 'error');
    }
    setCreatingPlan(true);
    try {
      await api.post('/dashboard/physio/recovery-plan', {
        athlete_id: Number(athleteId),
        exercises: selectedExercises,
        notes: notes || null,
      });
      showToast('Recovery plan created', 'success');
      setSelectedExercises([]);
      setNotes('');
      loadPlans(athleteId);
    } catch (err) {
      showToast(err.response?.data?.detail || 'Could not create plan', 'error');
    } finally {
      setCreatingPlan(false);
    }
  };

  const advanceStatus = async (plan) => {
    const currentIndex = STATUS_ORDER.indexOf(plan.status);
    if (currentIndex === STATUS_ORDER.length - 1) return;
    const nextStatus = STATUS_ORDER[currentIndex + 1];
    try {
      await api.put(`/dashboard/physio/recovery-plan/${plan.id}`, { status: nextStatus });
      showToast(`Plan marked as ${STATUS_LABELS[nextStatus]}`, 'success');
      loadPlans(athleteId);
    } catch (err) {
      showToast(err.response?.data?.detail || 'Could not update plan', 'error');
    }
  };

  return (
    <div className="role-dashboard-page">
      <Topbar activePage="overview" userName="Physiotherapist" />
      <main className="role-main">
        <div className="role-header fade-in-up">
          <h1>Rehabilitation Tracking</h1>
          <p className="role-subtitle">Look up an athlete, review their movement data, and assign a recovery plan.</p>
        </div>

        <div className="role-panel fade-in-up stagger" style={{ '--delay': '0.05s' }}>
          <form className="link-form" onSubmit={handleSearch}>
            <input
              type="number"
              placeholder="Athlete ID"
              value={athleteId}
              onChange={(e) => setAthleteId(e.target.value)}
            />
            <button type="submit" disabled={loading}>
              {loading ? <span className="spinner" /> : 'View Athlete'}
            </button>
          </form>
        </div>

        {data && (
          <>
            <div className="role-stat-strip fade-in-up stagger" style={{ '--delay': '0.1s' }}>
              <div className="role-stat-item"><span className="role-stat-value">{data.full_name}</span><span className="role-stat-label">Athlete</span></div>
              <div className="role-stat-item"><span className="role-stat-value">{data.videos_total}</span><span className="role-stat-label">Videos Uploaded</span></div>
              <div className="role-stat-item"><span className="role-stat-value">{data.training_load || '—'}</span><span className="role-stat-label">Training Load</span></div>
            </div>

            <div className="role-panel fade-in-up stagger" style={{ '--delay': '0.15s' }}>
              <h3>Suggested Exercises</h3>
              {!suggested || suggested.suggested_exercises.length === 0 ? (
                <EmptyState icon="🏋️" title="No suggestions yet" description="This athlete has no analyzed videos with recommendations yet." />
              ) : (
                <>
                  <p className="panel-hint">Based on their latest movement analysis recommendations — select exercises to add to a new recovery plan.</p>
                  <div className="exercise-list">
                    {suggested.suggested_exercises.map((ex) => {
                      const checked = selectedExercises.some((e) => e.name === ex.name);
                      return (
                        <label className={`exercise-item ${checked ? 'checked' : ''}`} key={ex.name}>
                          <input type="checkbox" checked={checked} onChange={() => toggleExercise(ex)} />
                          <div className="exercise-info">
                            <span className="exercise-name">{ex.name}</span>
                            <span className="exercise-meta">{ex.sets} sets × {ex.reps} — {ex.target}</span>
                            <span className="exercise-source">From: "{ex.matched_from}"</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  <div className="settings-field" style={{ marginTop: '1rem' }}>
                    <label>Recovery Notes (optional)</label>
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Reassess in 2 weeks, monitor knee pain during squats..." />
                  </div>

                  <button onClick={handleCreatePlan} disabled={creatingPlan}>
                    {creatingPlan ? <span className="spinner" /> : `Create Recovery Plan (${selectedExercises.length} selected)`}
                  </button>
                </>
              )}
            </div>

            <div className="role-panel fade-in-up stagger" style={{ '--delay': '0.2s' }}>
              <h3>Recovery Plan History</h3>
              {plans.length === 0 ? (
                <EmptyState icon="📋" title="No recovery plans yet" description="Create one above using suggested exercises." />
              ) : (
                <div className="plan-list">
                  {plans.map((plan) => (
                    <div className="plan-card" key={plan.id}>
                      <div className="plan-card-header">
                        <span className={`plan-status plan-status-${plan.status}`}>{STATUS_LABELS[plan.status]}</span>
                        <span className="plan-date">{new Date(plan.created_at).toLocaleDateString()}</span>
                      </div>
                      <ul className="plan-exercise-list">
                        {(plan.exercises_json || []).map((ex, i) => (
                          <li key={i}>{ex.name} — {ex.sets}×{ex.reps}</li>
                        ))}
                      </ul>
                      {plan.notes && <p className="plan-notes">"{plan.notes}"</p>}
                      {plan.status !== 'completed' && (
                        <button className="link-btn" onClick={() => advanceStatus(plan)}>
                          Mark as {STATUS_LABELS[STATUS_ORDER[STATUS_ORDER.indexOf(plan.status) + 1]]}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
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
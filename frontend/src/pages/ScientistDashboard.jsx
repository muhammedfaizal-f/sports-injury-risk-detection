import { useState, useEffect } from 'react';
import Topbar from '../components/Topbar';
import EmptyState from '../components/EmptyState';
import AnimatedCounter from '../components/AnimatedCounter';
import api from '../api';
import { useToast } from '../components/ToastContext';
import './RoleDashboards.css';

const RISK_ORDER = ['low', 'moderate', 'high', 'critical'];
const HEALTH_LABELS = { excellent: 'Excellent', good: 'Good', at_risk: 'At Risk', critical: 'Critical' };

export default function ScientistDashboard() {
  const [overview, setOverview] = useState(null);
  const [healthIndex, setHealthIndex] = useState([]);
  const [biomech, setBiomech] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState('');
  const { showToast } = useToast();

  useEffect(() => {
    Promise.all([
      api.get('/dashboard/sports-scientist/overview'),
      api.get('/dashboard/sports-scientist/health-index'),
      api.get('/dashboard/sports-scientist/biomechanics-analytics'),
    ])
      .then(([ov, hi, bio]) => {
        setOverview(ov.data);
        setHealthIndex(hi.data);
        setBiomech(bio.data);
      })
      .catch(() => showToast('Could not load research data', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const handleExport = async (format) => {
    setExporting(format);
    try {
      const res = await api.get(`/dashboard/sports-scientist/export/${format}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `research_report.${format === 'excel' ? 'xlsx' : 'pdf'}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      showToast('Could not generate report', 'error');
    } finally {
      setExporting('');
    }
  };

  if (loading) {
    return (
      <div className="role-dashboard-page">
        <Topbar activePage="overview" userName="Sports Scientist" />
        <main className="role-main"><div className="role-panel skeleton" style={{ height: 300 }} /></main>
      </div>
    );
  }

  const maxRisk = Math.max(...Object.values(overview?.risk_distribution || {}), 1);
  const maxInjury = Math.max(...Object.values(overview?.injury_type_distribution || {}), 1);
  const maxJoint = Math.max(...(biomech?.joint_deviation_frequency || []).map((j) => j.flagged_count), 1);
  const atRiskCount = healthIndex.filter((a) => ['at_risk', 'critical'].includes(a.health_category)).length;

  return (
    <div className="role-dashboard-page">
      <Topbar activePage="overview" userName="Sports Scientist" />
      <main className="role-main">
        <div className="role-header fade-in-up">
          <div>
            <h1>Athlete Health Research</h1>
            <p className="role-subtitle">Aggregate health index, biomechanical patterns, and injury trends across all athletes.</p>
          </div>
          <div className="export-buttons">
            <button onClick={() => handleExport('pdf')} disabled={exporting === 'pdf'}>
              {exporting === 'pdf' ? <span className="spinner" /> : 'Export PDF'}
            </button>
            <button className="btn-ghost" onClick={() => handleExport('excel')} disabled={exporting === 'excel'}>
              {exporting === 'excel' ? <span className="spinner" /> : 'Export Excel'}
            </button>
          </div>
        </div>

        <div className="role-stat-strip fade-in-up stagger" style={{ '--delay': '0.05s' }}>
          <div className="role-stat-item"><span className="role-stat-value"><AnimatedCounter value={overview.total_athletes} /></span><span className="role-stat-label">Total Athletes</span></div>
          <div className="role-stat-item"><span className="role-stat-value"><AnimatedCounter value={overview.total_risk_assessments} /></span><span className="role-stat-label">Risk Assessments</span></div>
          <div className="role-stat-item"><span className="role-stat-value"><AnimatedCounter value={atRiskCount} /></span><span className="role-stat-label">Athletes At Risk</span></div>
          <div className="role-stat-item"><span className="role-stat-value"><AnimatedCounter value={biomech?.total_videos_analyzed || 0} /></span><span className="role-stat-label">Videos Analyzed</span></div>
        </div>

        <div className="role-panel fade-in-up stagger" style={{ '--delay': '0.1s' }}>
          <h3>Overall Athlete Health Index</h3>
          <p className="panel-hint">Combines average movement quality and injury risk into one score. Sorted worst-first.</p>
          {healthIndex.length === 0 ? (
            <EmptyState icon="🩺" title="No health data yet" description="Athletes need at least one analyzed video." />
          ) : (
            <table className="role-table">
              <thead><tr><th>Athlete</th><th>Sport</th><th>Avg Quality</th><th>Avg Risk</th><th>Health Score</th><th>Status</th></tr></thead>
              <tbody>
                {healthIndex.map((a) => (
                  <tr key={a.athlete_id}>
                    <td>{a.full_name}</td>
                    <td>{a.sport_type || '—'}</td>
                    <td>{a.avg_quality_score ?? '—'}</td>
                    <td>{a.avg_risk_score ?? '—'}</td>
                    <td>{a.health_score}</td>
                    <td><span className={`health-pill health-${a.health_category}`}>{HEALTH_LABELS[a.health_category]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="role-panel fade-in-up stagger" style={{ '--delay': '0.15s' }}>
          <h3>Biomechanical Deviation Frequency</h3>
          <p className="panel-hint">How often each joint's angle fell outside the expected reference range, across all analyzed videos.</p>
          {!biomech || biomech.joint_deviation_frequency.length === 0 ? (
            <EmptyState icon="📐" title="No deviation data yet" />
          ) : (
            biomech.joint_deviation_frequency.map((j) => (
              <div className="distribution-bar-row" key={j.joint}>
                <span className="distribution-bar-label">{j.joint}</span>
                <div className="distribution-bar-track">
                  <div className="distribution-bar-fill" style={{ width: `${(j.flagged_count / maxJoint) * 100}%` }} />
                </div>
                <span className="distribution-bar-count">{j.flagged_count} ({j.flagged_rate}%)</span>
              </div>
            ))
          )}
        </div>

        <div className="role-panel fade-in-up stagger" style={{ '--delay': '0.2s' }}>
          <h3>Risk Category Distribution</h3>
          {RISK_ORDER.map((cat) => (
            <div className="distribution-bar-row" key={cat}>
              <span className="distribution-bar-label" style={{ textTransform: 'capitalize' }}>{cat}</span>
              <div className="distribution-bar-track">
                <div className="distribution-bar-fill" style={{ width: `${((overview.risk_distribution[cat] || 0) / maxRisk) * 100}%` }} />
              </div>
              <span className="distribution-bar-count">{overview.risk_distribution[cat] || 0}</span>
            </div>
          ))}
        </div>

        <div className="role-panel fade-in-up stagger" style={{ '--delay': '0.25s' }}>
          <h3>Injury Type Distribution</h3>
          {Object.keys(overview.injury_type_distribution || {}).length === 0 ? (
            <EmptyState icon="🏥" title="No risk predictions recorded yet" />
          ) : (
            Object.entries(overview.injury_type_distribution).map(([type, count]) => (
              <div className="distribution-bar-row" key={type}>
                <span className="distribution-bar-label">{type}</span>
                <div className="distribution-bar-track">
                  <div className="distribution-bar-fill" style={{ width: `${(count / maxInjury) * 100}%` }} />
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
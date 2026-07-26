import { useState, useEffect } from 'react';
import Topbar from '../components/Topbar';
import api from '../api';
import './RoleDashboards.css';

const RISK_ORDER = ['low', 'moderate', 'high', 'critical'];

export default function ScientistDashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/dashboard/sports-scientist/overview')
      .then((res) => setData(res.data))
      .catch(() => setData(null));
  }, []);

  if (!data) {
    return (
      <div className="role-dashboard-page">
        <Topbar activePage="overview" userName="Sports Scientist" />
        <main className="role-main"><div className="role-panel skeleton" style={{ height: 200 }} /></main>
      </div>
    );
  }

  const maxRisk = Math.max(...Object.values(data.risk_distribution), 1);
  const maxInjury = Math.max(...Object.values(data.injury_type_distribution || {}), 1);

  return (
    <div className="role-dashboard-page">
      <Topbar activePage="overview" userName="Sports Scientist" />
      <main className="role-main">
        <div className="role-header fade-in-up">
          <h1>Research Overview</h1>
          <p className="role-subtitle">Aggregate risk and injury-type patterns across all athletes.</p>
        </div>

        <div className="role-stat-strip fade-in-up stagger" style={{ '--delay': '0.05s' }}>
          <div className="role-stat-item">
            <span className="role-stat-value">{data.total_athletes}</span>
            <span className="role-stat-label">Total Athletes</span>
          </div>
          <div className="role-stat-item">
            <span className="role-stat-value">{data.total_risk_assessments}</span>
            <span className="role-stat-label">Risk Assessments Run</span>
          </div>
        </div>

        <div className="role-panel fade-in-up stagger" style={{ '--delay': '0.1s' }}>
          <h3>Risk Category Distribution</h3>
          {RISK_ORDER.map((cat) => (
            <div className="distribution-bar-row" key={cat}>
              <span className="distribution-bar-label" style={{ textTransform: 'capitalize' }}>{cat}</span>
              <div className="distribution-bar-track">
                <div className="distribution-bar-fill" style={{ width: `${((data.risk_distribution[cat] || 0) / maxRisk) * 100}%` }} />
              </div>
              <span className="distribution-bar-count">{data.risk_distribution[cat] || 0}</span>
            </div>
          ))}
        </div>

        <div className="role-panel fade-in-up stagger" style={{ '--delay': '0.15s' }}>
          <h3>Injury Type Distribution</h3>
          {Object.keys(data.injury_type_distribution || {}).length === 0 ? (
            <p className="role-empty">No risk predictions recorded yet.</p>
          ) : (
            Object.entries(data.injury_type_distribution).map(([type, count]) => (
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
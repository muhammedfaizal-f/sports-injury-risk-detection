import { useState, useEffect } from 'react';
import Topbar from '../components/Topbar';
import api from '../api';
import './RoleDashboards.css';

export default function AdminDashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/dashboard/admin/overview')
      .then((res) => setData(res.data))
      .catch(() => setData(null));
  }, []);

  if (!data) {
    return (
      <div className="role-dashboard-page">
        <Topbar activePage="overview" userName="Admin" />
        <main className="role-main"><div className="role-panel skeleton" style={{ height: 200 }} /></main>
      </div>
    );
  }

  return (
    <div className="role-dashboard-page">
      <Topbar activePage="overview" userName="Admin" />
      <main className="role-main">
        <div className="role-header fade-in-up">
          <h1>System Overview</h1>
          <p className="role-subtitle">Platform-wide user and video pipeline status.</p>
        </div>

        <div className="role-panel fade-in-up stagger" style={{ '--delay': '0.05s' }}>
          <h3>Users by Role</h3>
          <table className="role-table">
            <thead><tr><th>Role</th><th>Count</th></tr></thead>
            <tbody>
              {Object.entries(data.users_by_role).map(([role, count]) => (
                <tr key={role}><td style={{ textTransform: 'capitalize' }}>{role.replace('_', ' ')}</td><td>{count}</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="role-panel fade-in-up stagger" style={{ '--delay': '0.1s' }}>
          <h3>Videos by Pipeline Status</h3>
          <p className="role-empty" style={{ marginBottom: '0.75rem' }}>Total videos: {data.total_videos}</p>
          <table className="role-table">
            <thead><tr><th>Status</th><th>Count</th></tr></thead>
            <tbody>
              {Object.entries(data.videos_by_status).map(([status, count]) => (
                <tr key={status}><td>{status}</td><td>{count}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
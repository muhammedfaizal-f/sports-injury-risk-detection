import { useState, useEffect, useMemo } from 'react';
import Topbar from '../components/Topbar';
import EmptyState from '../components/EmptyState';
import AnimatedCounter from '../components/AnimatedCounter';
import api from '../api';
import { useToast } from '../components/ToastContext';
import './RoleDashboards.css';

const ROLES = ['athlete', 'coach', 'physiotherapist', 'sports_scientist', 'admin'];

export default function AdminDashboard() {
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [editingUser, setEditingUser] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const { showToast } = useToast();
  const [organizations, setOrganizations] = useState([]);
  const [joinCodes, setJoinCodes] = useState([]);
  const [monitoring, setMonitoring] = useState(null);
  const [activity, setActivity] = useState([]);
  const [orgName, setOrgName] = useState('');
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [selectedRole, setSelectedRole] = useState('athlete');
  const [generatingCode, setGeneratingCode] = useState(false);

  const loadOrgData = () => {
    Promise.all([
      api.get('/organizations'),
      api.get('/organizations/join-codes'),
      api.get('/dashboard/admin/system-monitoring'),
      api.get('/dashboard/admin/activity'),
    ]).then(([orgsRes, codesRes, monRes, actRes]) => {
      setOrganizations(orgsRes.data);
      setJoinCodes(codesRes.data);
      setMonitoring(monRes.data);
      setActivity(actRes.data);
    }).catch(() => { });
  };

  const loadOverview = () => api.get('/dashboard/admin/overview').then((res) => setOverview(res.data)).catch(() => setOverview(null));

  const loadUsers = () => {
    const params = {};
    if (roleFilter !== 'all') params.role = roleFilter;
    if (search) params.search = search;
    return api.get('/dashboard/admin/users', { params }).then((res) => setUsers(res.data)).catch(() => setUsers([]));
  };

  useEffect(() => {
    Promise.all([loadOverview(), loadUsers()]).finally(() => setLoading(false));
    loadOrgData();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { loadUsers(); }, 300); // debounce search typing
    return () => clearTimeout(timer);
  }, [search, roleFilter]);

  const handleToggleActive = async (user) => {
    try {
      await api.put(`/dashboard/admin/users/${user.id}`, { is_active: !user.is_active });
      showToast(`${user.full_name} ${user.is_active ? 'deactivated' : 'activated'}`, 'success');
      loadUsers();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Could not update user', 'error');
    }
  };

  const handleCreateOrg = async (e) => {
    e.preventDefault();
    if (!orgName) return;
    setCreatingOrg(true);
    try {
      await api.post('/organizations', { name: orgName });
      showToast('Organization created', 'success');
      setOrgName('');
      loadOrgData();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Could not create organization', 'error');
    } finally {
      setCreatingOrg(false);
    }
  };

  const handleGenerateCode = async () => {
    if (!selectedOrgId) return showToast('Select an organization first', 'error');
    setGeneratingCode(true);
    try {
      await api.post('/organizations/join-codes', {
        organization_id: Number(selectedOrgId),
        role: selectedRole,
      });
      showToast('Join code generated', 'success');
      loadOrgData();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Could not generate code', 'error');
    } finally {
      setGeneratingCode(false);
    }
  };

 const getExpiryDate = (value) => {
  if (!value) return null;

  // Backend stores UTC datetime without timezone information
  return new Date(
    value.endsWith('Z') ? value : `${value}Z`
  );
};

const codeStatus = (code) => {
  if (code.used) return 'used';

  const expiryDate = getExpiryDate(code.expires_at);

  if (expiryDate && expiryDate < new Date()) {
    return 'expired';
  }

  return 'active';
};

  const handleRoleChange = async (user, newRole) => {
    try {
      await api.put(`/dashboard/admin/users/${user.id}`, { role: newRole });
      showToast(`${user.full_name}'s role changed to ${newRole}`, 'success');
      loadUsers();
      setEditingUser(null);
    } catch (err) {
      showToast(err.response?.data?.detail || 'Could not update role', 'error');
    }
  };

  const handleDelete = async (userId) => {
    try {
      await api.delete(`/dashboard/admin/users/${userId}`);
      showToast('User deleted', 'success');
      setConfirmDeleteId(null);
      loadUsers();
      loadOverview();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Could not delete user', 'error');
    }
  };

  const totalUsers = useMemo(() => Object.values(overview?.users_by_role || {}).reduce((a, b) => a + b, 0), [overview]);

  return (
    <div className="role-dashboard-page">
      <Topbar activePage="overview" userName="Admin" />
      <main className="role-main">
        <div className="role-header fade-in-up">
          <h1>System Overview</h1>
          <p className="role-subtitle">Manage all platform users and monitor pipeline status.</p>
        </div>

        {loading ? (
          <div className="role-panel skeleton" style={{ height: 100 }} />
        ) : overview && (
          <div className="role-stat-strip fade-in-up stagger" style={{ '--delay': '0.05s' }}>
            <div className="role-stat-item"><span className="role-stat-value"><AnimatedCounter value={totalUsers} /></span><span className="role-stat-label">Total Users</span></div>
            <div className="role-stat-item"><span className="role-stat-value"><AnimatedCounter value={overview.total_videos} /></span><span className="role-stat-label">Total Videos</span></div>
            <div className="role-stat-item"><span className="role-stat-value">{overview.users_by_role.athlete || 0}</span><span className="role-stat-label">Athletes</span></div>
            <div className="role-stat-item"><span className="role-stat-value">{overview.users_by_role.coach || 0}</span><span className="role-stat-label">Coaches</span></div>
          </div>
        )}

        <div className="role-panel fade-in-up stagger" style={{ '--delay': '0.1s' }}>
          <div className="panel-header-row">
            <h3>User Management</h3>
            <div className="team-controls">
              <input
                type="text"
                placeholder="Search name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ maxWidth: 220 }}
              />
              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                <option value="all">All roles</option>
                {ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
              </select>
            </div>
          </div>

          {users.length === 0 ? (
            <EmptyState icon="👤" title="No users match this search" />
          ) : (
            <table className="role-table">
              <thead>
                <tr><th>Name</th><th>Email</th><th>Role</th><th>Login</th><th>Organization</th><th>Videos</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.full_name}</td>
                    <td>{u.email}</td>
                    <td>
                      {editingUser === u.id ? (
                        <select
                          defaultValue={u.role}
                          onChange={(e) => handleRoleChange(u, e.target.value)}
                          onBlur={() => setEditingUser(null)}
                          autoFocus
                        >
                          {ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                        </select>
                      ) : (
                        <button className="role-edit-btn" onClick={() => setEditingUser(u.id)}>
                          {u.role.replace('_', ' ')}
                        </button>
                      )}
                    </td>
                    <td>
                      {u.is_google_linked && <span className="login-tag">Google</span>}
                      {u.has_password && <span className="login-tag">Password</span>}
                    </td>
                    <td>
                      {u.organization_name ? (
                        <div className="org-cell">
                          <span className="org-name">{u.organization_name}</span>
                          {u.joined_via_code && <span className="org-code">via {u.joined_via_code}</span>}
                        </div>
                      ) : (
                        <span className="role-empty" style={{ fontSize: '0.8rem' }}>—</span>
                      )}
                    </td>
                    <td>{u.videos_uploaded ?? '—'}</td>
                    <td>
                      <button
                        className={`status-toggle ${u.is_active ? 'active' : 'inactive'}`}
                        onClick={() => handleToggleActive(u)}
                      >
                        {u.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td>
                      {confirmDeleteId === u.id ? (
                        <div className="inline-confirm">
                          <button className="confirm-yes" onClick={() => handleDelete(u.id)}>Confirm</button>
                          <button className="confirm-no" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                        </div>
                      ) : (
                        <button className="delete-btn" onClick={() => setConfirmDeleteId(u.id)}>🗑</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {overview && (
          <div className="role-panel fade-in-up stagger" style={{ '--delay': '0.15s' }}>
            <h3>Videos by Pipeline Status</h3>
            <table className="role-table">
              <thead><tr><th>Status</th><th>Count</th></tr></thead>
              <tbody>
                {Object.entries(overview.videos_by_status).map(([status, count]) => (
                  <tr key={status}><td>{status}</td><td>{count}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="role-panel fade-in-up stagger" style={{ '--delay': '0.15s' }}>
          <h3>Organizations</h3>
          <form className="link-form" onSubmit={handleCreateOrg}>
            <input
              type="text"
              placeholder="Organization name (e.g. Falcon Sports Academy)"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
            />
            <button type="submit" disabled={creatingOrg}>
              {creatingOrg ? <span className="spinner" /> : 'Create Organization'}
            </button>
          </form>

          {organizations.length === 0 ? (
            <EmptyState icon="🏢" title="No organizations yet" description="Create one above to start generating join codes." />
          ) : (
            <table className="role-table" style={{ marginTop: '1rem' }}>
              <thead><tr><th>Name</th><th>Created</th></tr></thead>
              <tbody>
                {organizations.map((org) => (
                  <tr key={org.id}>
                    <td>{org.name}</td>
                    <td>{new Date(org.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="role-panel fade-in-up stagger" style={{ '--delay': '0.2s' }}>
          <h3>Generate Join Code</h3>
          <p className="panel-hint">Codes expire after 15 minutes and can only be used once.</p>
          <div className="link-form">
            <select value={selectedOrgId} onChange={(e) => setSelectedOrgId(e.target.value)}>
              <option value="">Select organization...</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
            <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
              <option value="athlete">Athlete</option>
              <option value="coach">Coach</option>
              <option value="physiotherapist">Physiotherapist</option>
              <option value="sports_scientist">Sports Scientist</option>
            </select>
            <button onClick={handleGenerateCode} disabled={generatingCode}>
              {generatingCode ? <span className="spinner" /> : 'Generate Code'}
            </button>
          </div>

          {joinCodes.length === 0 ? (
            <EmptyState icon="🔑" title="No codes generated yet" />
          ) : (
            <table className="role-table" style={{ marginTop: '1rem' }}>
              <thead><tr><th>Code</th><th>Expires</th><th>Status</th></tr></thead>
              <tbody>
                {joinCodes.map((c) => (
                  <tr key={c.id}>
                    <td className="join-code-cell">{c.code}</td>
                  <td>{getExpiryDate(c.expires_at)?.toLocaleTimeString()}</td>
                    <td><span className={`code-status code-status-${codeStatus(c)}`}>{codeStatus(c)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {monitoring && (
          <div className="role-panel fade-in-up stagger" style={{ '--delay': '0.25s' }}>
            <h3>System Monitoring — Pipeline Funnel</h3>
            <div className="funnel-list">
              {Object.entries(monitoring.videos_by_status).map(([stage, count]) => (
                <div className="funnel-row" key={stage}>
                  <span className="funnel-label">{stage.replace('_', ' ')}</span>
                  <div className="funnel-track">
                    <div
                      className="funnel-fill"
                      style={{ width: `${monitoring.total_videos ? (count / monitoring.total_videos) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="funnel-count">{count}</span>
                </div>
              ))}
            </div>
            <div className="funnel-summary">
              <span>Pose estimations: <strong>{monitoring.pose_estimations_completed}</strong></span>
              <span>Biomechanics: <strong>{monitoring.biomechanics_completed}</strong></span>
              <span>Risk predictions: <strong>{monitoring.risk_predictions_completed}</strong></span>
              <span className="funnel-failed">Failed: <strong>{monitoring.failed_analyses}</strong></span>
            </div>
          </div>
        )}

        <div className="role-panel fade-in-up stagger" style={{ '--delay': '0.3s' }}>
          <h3>Activity Log</h3>
          {activity.length === 0 ? (
            <EmptyState icon="📜" title="No activity recorded yet" />
          ) : (
            <div className="activity-list">
              {activity.map((a) => (
                <div className="activity-row" key={a.id}>
                  <span className="activity-action">{a.action}</span>
                  <span className="activity-time">{new Date(a.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
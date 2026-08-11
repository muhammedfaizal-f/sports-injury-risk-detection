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

  const loadOverview = () => api.get('/dashboard/admin/overview').then((res) => setOverview(res.data)).catch(() => setOverview(null));

  const loadUsers = () => {
    const params = {};
    if (roleFilter !== 'all') params.role = roleFilter;
    if (search) params.search = search;
    return api.get('/dashboard/admin/users', { params }).then((res) => setUsers(res.data)).catch(() => setUsers([]));
  };

  useEffect(() => {
    Promise.all([loadOverview(), loadUsers()]).finally(() => setLoading(false));
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
                <tr><th>Name</th><th>Email</th><th>Role</th><th>Login</th><th>Videos</th><th>Status</th><th></th></tr>
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
      </main>
    </div>
  );
}
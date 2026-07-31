import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useToast } from '../components/ToastContext';
import PasswordInput from '../components/PasswordInput';
import AuthVisualPanel from '../components/AuthVisualPanel';
import GoogleLoginButton from '../components/GoogleLoginButton';
import './AuthPage.css';

export default function Register() {
  const [form, setForm] = useState({ full_name: '', email: '', password: '', role: 'athlete' });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { showToast } = useToast();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/register', form);
      showToast('Account created — please log in', 'success');
      navigate('/login');
    } catch (err) {
      showToast(err.response?.data?.detail || 'Registration failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <AuthVisualPanel />

      <div className="auth-form-side">
        <form className="auth-card fade-in-up" onSubmit={handleSubmit}>
          <h2>Register</h2>

          <div className="auth-field">
            <label>Full Name</label>
            <input name="full_name" value={form.full_name} onChange={handleChange} autoComplete="name" />
          </div>

          <div className="auth-field">
            <label>Email</label>
            <input name="email" type="email" value={form.email} onChange={handleChange} autoComplete="email" />
          </div>

          <div className="auth-field">
            <label>Password</label>
            <PasswordInput
              name="password"
              value={form.password}
              onChange={handleChange}
              autoComplete="new-password"
            />
          </div>

          <div className="auth-field">
            <label>Role</label>
            <select name="role" value={form.role} onChange={handleChange}>
              <option value="athlete">Athlete</option>
              <option value="coach">Coach</option>
              <option value="physiotherapist">Physiotherapist</option>
              <option value="sports_scientist">Sports Scientist</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? <span className="spinner" /> : 'Register'}
          </button>

          <div className="auth-divider"><span>or</span></div>
          <GoogleLoginButton role={form.role} />

          <p className="auth-footer">
            Already have an account? <a href="/login">Login</a>
          </p>
        </form>
      </div>
    </div>
  );
}
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { decodeToken } from '../utils/auth';
import { useToast } from '../components/ToastContext';
import PasswordInput from '../components/PasswordInput';
import AuthVisualPanel from '../components/AuthVisualPanel';
import GoogleLoginButton from '../components/GoogleLoginButton';
import { getRoleConfig } from '../utils/roleConfig';
import './AuthPage.css';


export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { showToast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const form = new URLSearchParams();
      form.append('username', email);
      form.append('password', password);

      const res = await api.post('/auth/login', form, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      localStorage.setItem('token', res.data.access_token);
      const decoded = decodeToken(res.data.access_token);
      showToast('Welcome back', 'success');
       navigate(getRoleConfig(decoded?.role).homePath);
    } catch (err) {
      showToast('Invalid email or password', 'error');
    } finally {
      setLoading(false);
    }
  };

 return (
  <div className="auth-page">
    <AuthVisualPanel />

    <form className="auth-card fade-in-up" onSubmit={handleSubmit}>
      <h2>Login</h2>

      <div className="auth-field">
        <label>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      </div>

      <div className="auth-field">
        <label>Password</label>
        <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
      </div>

      <button type="submit" className="auth-submit" disabled={loading}>
        {loading ? <span className="spinner" /> : 'Login'}
      </button>

      <div className="auth-divider"><span>or</span></div>
      <GoogleLoginButton />

      <p className="auth-footer">
        New user? <a href="/register">Register</a>
      </p>
    </form>
  </div>
);
}
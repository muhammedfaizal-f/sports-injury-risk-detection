import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { decodeToken } from '../utils/auth';
import { useToast } from '../components/ToastContext';
import GoogleLoginButton from '../components/GoogleLoginButton';
import './AuthPage.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { showToast } = useToast();


  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const form = new URLSearchParams();
      form.append("username", email);
      form.append("password", password);

      const res = await api.post("/auth/login", form, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      // Save JWT token
      localStorage.setItem("token", res.data.access_token);

      // instead of setMessage('Uploaded successfully'):
      showToast('Video uploaded successfully', 'success');

      // Decode JWT
      const decoded = decodeToken(res.data.access_token);

      // Redirect based on role
      const roleRoutes = {
        athlete: "/dashboard",
        coach: "/coach-dashboard",
        physiotherapist: "/physio-dashboard",
        sports_scientist: "/scientist-dashboard",
        admin: "/admin-dashboard",
      };

      navigate(roleRoutes[decoded?.role] || "/dashboard");
    } catch (err) {
      console.error(err);

      // instead of setMessage(err.response?.data?.detail || 'Upload failed'):
      showToast(err.response?.data?.detail || 'Upload failed', 'error');


      setError("Invalid email or password");
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h2>Login</h2>

        <div className="auth-field">
          <label>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        <div className="auth-field">
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        {error && <p className="error-text">{error}</p>}

        <button type="submit" className="auth-submit">Login</button>

        <p className="auth-footer">
          New user? <a href="/register">Register</a>
        </p>
        <div className="auth-divider"><span>or</span></div>
        <GoogleLoginButton />
      </form>
    </div>
  );
}

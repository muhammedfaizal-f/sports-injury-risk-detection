import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import './AuthPage.css';

export default function Register() {
  const [form, setForm] = useState({ full_name: '', email: '', password: '', role: 'athlete' });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/auth/register', form);
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed');
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h2>Register</h2>

        <div className="auth-field">
          <label>Full Name</label>
          <input name="full_name" onChange={handleChange} />
        </div>

        <div className="auth-field">
          <label>Email</label>
          <input name="email" onChange={handleChange} />
        </div>

        <div className="auth-field">
          <label>Password</label>
          <input name="password" type="password" onChange={handleChange} />
        </div>

        <div className="auth-field">
          <label>Role</label>
          <select name="role" onChange={handleChange}>
            <option value="athlete">Athlete</option>
            <option value="coach">Coach</option>
            <option value="physiotherapist">Physiotherapist</option>
            <option value="sports_scientist">Sports Scientist</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        {error && <p className="error-text">{error}</p>}

        <button type="submit" className="auth-submit">Register</button>

        <p className="auth-footer">
          Already have an account? <a href="/login">Login</a>
        </p>
      </form>
    </div>
  );
}
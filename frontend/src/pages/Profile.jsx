import { useState, useEffect } from 'react';
import Topbar from '../components/Topbar';
import api from '../api';
import './Profile.css';

export default function Profile() {
  const [form, setForm] = useState({
    sport_type: '', position: '', age: '', height_cm: '', weight_kg: '',
    injury_history: '', training_load: '',
  });
  const [exists, setExists] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.get('/athletes/me')
      .then(res => {
        setForm(res.data);
        setExists(true);
      })
      .catch(() => setExists(false));
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (exists) {
        await api.put('/athletes/me', form);
        setMessage('Profile updated!');
      } else {
        await api.post('/athletes/me', form);
        setMessage('Profile created!');
        setExists(true);
      }
    } catch (err) {
      setMessage(err.response?.data?.detail || 'Something went wrong');
    }
  };

  return (
    <div className="profile-wrapper">
      <Topbar activePage="profile" userName="Athlete" />
      <div className="profile-page">
        <form className="profile-card" onSubmit={handleSubmit}>
          <h2>Athlete Profile</h2>

          <div className="profile-row">
            <div className="profile-field">
              <label>Sport Type</label>
              <input name="sport_type" value={form.sport_type || ''} onChange={handleChange} />
            </div>
            <div className="profile-field">
              <label>Position</label>
              <input name="position" value={form.position || ''} onChange={handleChange} />
            </div>
          </div>

          <div className="profile-row">
            <div className="profile-field">
              <label>Age</label>
              <input name="age" type="number" value={form.age || ''} onChange={handleChange} />
            </div>
            <div className="profile-field">
              <label>Height (cm)</label>
              <input name="height_cm" type="number" value={form.height_cm || ''} onChange={handleChange} />
            </div>
            <div className="profile-field">
              <label>Weight (kg)</label>
              <input name="weight_kg" type="number" value={form.weight_kg || ''} onChange={handleChange} />
            </div>
          </div>

          <div className="profile-field">
            <label>Injury History</label>
            <textarea name="injury_history" value={form.injury_history || ''} onChange={handleChange} />
          </div>

          <div className="profile-field">
            <label>Training Load</label>
            <select name="training_load" value={form.training_load || ''} onChange={handleChange}>
              <option value="">Select</option>
              <option value="Low">Low</option>
              <option value="Moderate">Moderate</option>
              <option value="High">High</option>
            </select>
          </div>

          <button type="submit" className="profile-submit">
            {exists ? 'Update Profile' : 'Create Profile'}
          </button>

          {message && <p className="success-text">{message}</p>}
        </form>
      </div>
    </div>
  );
}

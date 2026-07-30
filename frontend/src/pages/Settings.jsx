import { useState, useEffect, useRef } from 'react';
import Topbar from '../components/Topbar';
import api, { API_BASE_URL } from '../api';
import { useToast } from '../components/ToastContext';
import './Settings.css';

export default function Settings() {
  const [user, setUser] = useState(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const fileInputRef = useRef(null);
  const { showToast } = useToast();

  const loadUser = () => {
    api.get('/users/me').then((res) => {
      setUser(res.data);
      setFullName(res.data.full_name);
      setEmail(res.data.email);
    });
  };

  useEffect(() => { loadUser(); }, []);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await api.put('/users/me', { full_name: fullName, email });
      setUser(res.data);
      showToast('Profile updated', 'success');
    } catch (err) {
      showToast(err.response?.data?.detail || 'Could not update profile', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarPick = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAvatarPreview(URL.createObjectURL(file));
    uploadAvatar(file);
  };

  const uploadAvatar = async (file) => {
    setUploadingAvatar(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.post('/users/me/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUser(res.data);
      showToast('Profile photo updated', 'success');
    } catch (err) {
      showToast(err.response?.data?.detail || 'Could not upload image', 'error');
      setAvatarPreview(null);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handlePasswordSave = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      return showToast('New passwords do not match', 'error');
    }
    if (newPassword.length < 8) {
      return showToast('Password must be at least 8 characters', 'error');
    }

    setSavingPassword(true);
    try {
      await api.put('/users/me/password', {
        current_password: currentPassword || undefined,
        new_password: newPassword,
      });
      showToast(user.has_password ? 'Password changed' : 'Password set — you can now log in without Google', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      loadUser();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Could not update password', 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  if (!user) {
    return (
      <div className="settings-page">
        <Topbar activePage="profile" userName="Loading..." />
        <main className="settings-main"><div className="settings-card skeleton" style={{ height: 300 }} /></main>
      </div>
    );
  }

  const avatarSrc = avatarPreview || (user.avatar_url ? `${API_BASE_URL}${user.avatar_url}` : null);

  return (
    <div className="settings-page">
      <Topbar activePage="profile" userName={user.full_name} />

      <main className="settings-main">
        <div className="settings-header fade-in-up">
          <h1>Settings</h1>
          <p className="settings-subtitle">Manage your profile photo, details, and password.</p>
        </div>

        <div className="settings-card fade-in-up stagger" style={{ '--delay': '0.05s' }}>
          <h3>Profile Photo</h3>
          <div className="avatar-row">
            <div className="avatar-preview" onClick={() => fileInputRef.current?.click()}>
              {avatarSrc ? (
                <img src={avatarSrc} alt="Profile" />
              ) : (
                <span className="avatar-initial">{user.full_name?.[0]?.toUpperCase()}</span>
              )}
              <div className="avatar-overlay">{uploadingAvatar ? <span className="spinner" /> : 'Change'}</div>
            </div>
            <div>
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingAvatar}>
                Upload new photo
              </button>
              <p className="avatar-hint">JPG, PNG, or WEBP. Max 5MB.</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleAvatarPick}
              hidden
            />
          </div>
        </div>

        <form className="settings-card fade-in-up stagger" style={{ '--delay': '0.1s' }} onSubmit={handleProfileSave}>
          <h3>Profile Details</h3>
          <div className="settings-field">
            <label>Full Name</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="settings-field">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <button type="submit" disabled={savingProfile}>
            {savingProfile ? <span className="spinner" /> : 'Save Changes'}
          </button>
        </form>

        <form className="settings-card fade-in-up stagger" style={{ '--delay': '0.15s' }} onSubmit={handlePasswordSave}>
          <h3>{user.has_password ? 'Change Password' : 'Set a Password'}</h3>
          {!user.has_password && (
            <p className="settings-hint">
              Your account was created with Google — set a password to also allow signing in with email.
            </p>
          )}

          {user.has_password && (
            <div className="settings-field">
              <label>Current Password</label>
              <div className="password-input-wrapper">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
                <button type="button" className="eye-toggle" onClick={() => setShowCurrent((v) => !v)}>
                  {showCurrent ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
          )}

          <div className="settings-field">
            <label>New Password</label>
            <div className="password-input-wrapper">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <button type="button" className="eye-toggle" onClick={() => setShowNew((v) => !v)}>
                {showNew ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <div className="settings-field">
            <label>Confirm New Password</label>
            <input
              type={showNew ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <button type="submit" disabled={savingPassword}>
            {savingPassword ? <span className="spinner" /> : user.has_password ? 'Update Password' : 'Set Password'}
          </button>
        </form>
      </main>
    </div>
  );
}
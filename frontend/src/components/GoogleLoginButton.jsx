import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { decodeToken } from '../utils/auth';
import { getRoleConfig } from '../utils/roleConfig';
import { useToast } from './ToastContext';

export default function GoogleLoginButton({ role = 'athlete' }) {
  const buttonRef = useRef(null);
  const navigate = useNavigate();
  const { showToast } = useToast();

  useEffect(() => {
    if (!window.google || !buttonRef.current) return;

    window.google.accounts.id.initialize({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      callback: async (response) => {
        try {
          const res = await api.post('/auth/google', {
            id_token: response.credential,
            role,
          });
          localStorage.setItem('token', res.data.access_token);
          const decoded = decodeToken(res.data.access_token);
          showToast('Signed in with Google', 'success');
          navigate(getRoleConfig(decoded?.role).homePath);
        } catch (err) {
          showToast('Google sign-in failed', 'error');
        }
      },
    });

    window.google.accounts.id.renderButton(buttonRef.current, {
      theme: 'filled_black',
      size: 'large',
      width: 320,
      shape: 'pill',
    });
  }, [role, navigate, showToast]);

  return <div ref={buttonRef} className="google-btn-wrapper" />;
}
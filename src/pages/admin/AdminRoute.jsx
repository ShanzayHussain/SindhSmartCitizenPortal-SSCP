import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { apiFetch } from '../../lib/api';

export default function AdminRoute({ children }) {
  const [state, setState] = useState({ loading: true, allowed: false });

  useEffect(() => {
    apiFetch('/auth/me')
      .then((res) => {
        if (!res.ok) throw new Error('Unauthorized');
        return res.json();
      })
      .then((me) => {
        setState({ loading: false, allowed: String(me?.role || '').toLowerCase() === 'admin' });
      })
      .catch(() => {
        setState({ loading: false, allowed: false });
      });
  }, []);

  if (state.loading) {
    return <div style={{ padding: '24px', fontFamily: "'Segoe UI', sans-serif" }}>Checking access...</div>;
  }

  if (!state.allowed) return <Navigate to="/dashboard" replace />;
  return children;
}

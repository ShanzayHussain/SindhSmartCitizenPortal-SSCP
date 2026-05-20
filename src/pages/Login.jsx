
import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import logo from '../assets/logo.png';
import Button from '../components/ui/Button';
import AuthShell from '../components/ui/AuthShell';
import { FormField, TextInput } from '../components/ui/FormField';

function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const role = String(searchParams.get('role') || 'citizen').toLowerCase();
  const isAdminLogin = role === 'admin';

  const onChange = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!form.email || !form.password) {
      setError('Please enter email and password.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Email: form.email,
          Password: form.password,
        }),
      });

      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        const baseMessage = data?.message || `Login failed (HTTP ${res.status})`;
        const details = data?.details ? `: ${data.details}` : '';
        throw new Error(`${baseMessage}${details}`);
      }

      // Save auth + user payload
      if (data?.token) {
        localStorage.setItem('token', data.token);
      }
      localStorage.setItem('user', JSON.stringify(data));

      setSuccess(`Welcome, ${data.full_name || 'user'}!`);
      const role = String(data?.role || '').toLowerCase();
      navigate(role === 'admin' ? '/admin/dashboard' : '/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      logo={logo}
      title="Sindh Smart Citizen Portal"
      subtitle={isAdminLogin ? 'Admin Login' : 'Citizen Login'}
    >
      <div className="mt-5 rounded-lg border border-[#c2d0e0] bg-[#eef2f7] px-3 py-2 text-sm font-semibold text-[#2E4A6F]">
        {isAdminLogin ? 'Use an account with admin role to access the admin dashboard.' : 'Use your citizen account to file and track complaints.'}
      </div>
      <form onSubmit={onSubmit} className="mt-6">
        <FormField label="Email Address" htmlFor="email">
          <TextInput
            id="email"
            type="email"
            placeholder="e.g. janedoe@gmail.com"
            value={form.email}
            onChange={onChange('email')}
            required
          />
        </FormField>
        <FormField label="Password" htmlFor="password">
          <div className="relative">
            <TextInput
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="********"
              className="pr-11"
              value={form.password}
              onChange={onChange('password')}
              required
            />
            <button
              type="button"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 transition hover:text-surface-800"
              onClick={() => setShowPassword((prev) => !prev)}
            >
              {showPassword ? (
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 3l18 18" />
                  <path d="M10.6 10.6a2.5 2.5 0 0 0 3.5 3.5" />
                  <path d="M9.9 5.1A10.5 10.5 0 0 1 12 5c5 0 9.3 3.1 11 7-0.6 1.4-1.5 2.7-2.6 3.7" />
                  <path d="M6.2 6.2C4 7.5 2.3 9.5 1 12c1.7 3.9 6 7 11 7 1.2 0 2.4-0.2 3.4-0.6" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </FormField>

        {error ? <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        {success ? <div className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div> : null}

        <Button type="submit" fullWidth size="lg" disabled={submitting} className="rounded-lg bg-[#2E4A6F] font-extrabold text-white hover:bg-[#3a5c8a] disabled:opacity-60">
          {submitting ? 'Logging in...' : 'Login'}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-[#64748b]">
        Don&apos;t have an account?{' '}
        <a href="/register" className="font-bold text-[#2E4A6F] underline">Register here</a>
      </p>
      <p className="mt-3 text-center text-sm text-[#64748b]">
        {isAdminLogin ? (
          <a href="/login?role=citizen" className="font-bold text-[#2E4A6F] underline">Switch to citizen login</a>
        ) : (
          <a href="/login?role=admin" className="font-bold text-[#2E4A6F] underline">Switch to admin login</a>
        )}
      </p>
      <p className="mt-3 text-center text-sm text-[#64748b]">
        <a href="/" className="font-bold text-[#2E4A6F] underline">Go back to home</a>
      </p>
    </AuthShell>
  );
}

export default Login;

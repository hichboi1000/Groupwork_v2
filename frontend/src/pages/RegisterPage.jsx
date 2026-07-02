import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../api/client';

const ROLES = [
  { value: 'student', label: 'Student — Join a group and complete tasks' },
  { value: 'leader', label: 'Leader — Create and manage a group' },
  { value: 'rep', label: 'Class Representative — Oversee all groups' },
  { value: 'lecturer', label: 'Lecturer — Post assignments' },
];

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    username: '', email: '', first_name: '', last_name: '',
    password: '', role: 'student',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await register(form);
      navigate('/login');
    } catch (err) {
      const data = err.response?.data;
      if (data) {
        const msgs = Object.values(data).flat().join(' ');
        setError(msgs);
      } else {
        setError('Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 460 }}>
        <div className="auth-logo">
          <div className="logo-big">G</div>
          <h1>GroupWork</h1>
          <p>Create your account</p>
        </div>

        <div className="card">
          {error && <div className="alert alert-error">{error}</div>}
          <form onSubmit={submit}>
            <div className="row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">First Name</label>
                <input className="form-input" name="first_name" value={form.first_name} onChange={handle} required />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Last Name</label>
                <input className="form-input" name="last_name" value={form.last_name} onChange={handle} required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input className="form-input" name="username" value={form.username} onChange={handle} required />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" name="email" type="email" value={form.email} onChange={handle} />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-input" name="password" type="password" value={form.password} onChange={handle} required />
            </div>
            <div className="form-group">
              <label className="form-label">I am a…</label>
              <select className="form-select" name="role" value={form.role} onChange={handle}>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <button className="btn btn-primary w-full" type="submit" disabled={loading}>
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>
          <p className="text-muted text-sm mt-16" style={{ textAlign: 'center' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--accent-light)' }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

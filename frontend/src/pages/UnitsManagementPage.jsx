import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getMyUnits, createUnit, getUnitOfferings, getUnitOfferingsHistory } from '../api/client';

export default function UnitsManagementPage() {
  const { user } = useAuth();
  const [units, setUnits] = useState([]);
  const [offerings, setOfferings] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tab, setTab] = useState('units');

  const [form, setForm] = useState({ code: '', name: '' });
  const [pendingConfirm, setPendingConfirm] = useState(null); // { message, payload }

  useEffect(() => { loadAll(); }, []);

  const loadAll = () => {
    setLoading(true);
    Promise.all([
      getMyUnits().catch(() => ({ data: [] })),
      getUnitOfferings().catch(() => ({ data: [] })),
      getUnitOfferingsHistory().catch(() => ({ data: [] })),
    ]).then(([u, o, h]) => { setUnits(u.data); setOfferings(o.data); setHistory(h.data); })
      .finally(() => setLoading(false));
  };

  const submitCreate = async (payload) => {
    setError(''); setSuccess('');
    try {
      const r = await createUnit(payload);
      if (r.data.created_new) {
        setSuccess(`Unit "${r.data.unit.code}" created. Share this code with your class reps.`);
      } else if (r.data.joined_existing) {
        setSuccess(`You've joined "${r.data.unit.code}" as a co-lecturer alongside the existing team.`);
      }
      setForm({ code: '', name: '' });
      setPendingConfirm(null);
      loadAll();
    } catch (err) {
      if (err.response?.status === 409 && err.response.data?.needs_confirmation) {
        setPendingConfirm({
          message: err.response.data.message,
          payload: { ...payload, confirm_join: true },
        });
      } else {
        setError(err.response?.data?.error || 'Could not create or join unit.');
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    submitCreate({ code: form.code.toUpperCase(), name: form.name });
  };

  if (user.role !== 'lecturer') {
    return (
      <div className="empty-state">
        <div className="empty-icon">🚫</div>
        <p>Unit management is only available to lecturers.</p>
      </div>
    );
  }

  if (loading) return <div className="text-muted">Loading…</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Units Management</h1>
        <p>Create units you teach, or join one as a co-lecturer using its code.</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="tabs">
        <button className={`tab-btn ${tab === 'units' ? 'active' : ''}`} onClick={() => setTab('units')}>
          📖 My Units ({units.length})
        </button>
        <button className={`tab-btn ${tab === 'create' ? 'active' : ''}`} onClick={() => setTab('create')}>
          ➕ Create / Join Unit
        </button>
        <button className={`tab-btn ${tab === 'classes' ? 'active' : ''}`} onClick={() => setTab('classes')}>
          🏫 Active Classes ({offerings.length})
        </button>
        <button className={`tab-btn ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>
          🗄 Past Offerings ({history.length})
        </button>
      </div>

      {/* My units */}
      {tab === 'units' && (
        units.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📖</div>
            <p>You don't teach any units yet.</p>
            <button className="btn btn-primary mt-16" style={{ marginTop: 16 }} onClick={() => setTab('create')}>
              Create your first unit
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            {units.map(u => (
              <div key={u.id} className="card">
                <div className="row-between mb-16" style={{ marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{u.code}</div>
                    <div className="text-sm text-muted">{u.name}</div>
                  </div>
                  <span className="code-badge" style={{ fontSize: 13, padding: '5px 10px' }}>{u.code}</span>
                </div>
                {u.lecturers?.length > 1 && (
                  <div>
                    <div className="text-sm text-muted" style={{ marginBottom: 6 }}>Co-taught with</div>
                    <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                      {u.lecturers.filter(l => l.id !== user.id).map(l => (
                        <span key={l.id} className="badge badge-accent">{l.full_name}</span>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-muted text-sm mt-8" style={{ marginTop: 10 }}>
                  Share code <strong style={{ color: 'var(--accent)' }}>{u.code}</strong> with
                  a class rep so they can attach their class to this unit.
                </p>
              </div>
            ))}
          </div>
        )
      )}

      {/* Create/join */}
      {tab === 'create' && (
        <div className="card" style={{ maxWidth: 480 }}>
          <div className="card-title">Create or Join a Unit</div>
          <p className="text-muted text-sm mb-16" style={{ marginBottom: 16 }}>
            Enter your university's real unit code. If this code doesn't
            exist yet, it creates a new unit. If another lecturer already
            registered this code, you'll join as a co-lecturer automatically.
          </p>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Unit Code *</label>
              <input className="form-input" placeholder="e.g. CS302" value={form.code}
                onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                style={{ fontFamily: 'monospace', letterSpacing: 2 }} required />
            </div>
            <div className="form-group">
              <label className="form-label">Unit Name *</label>
              <input className="form-input" placeholder="e.g. Database Systems" value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })} required />
            </div>
            <button className="btn btn-primary w-full" type="submit">Continue</button>
          </form>
        </div>
      )}

      {/* Active classes (offerings) */}
      {tab === 'classes' && (
        offerings.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🏫</div>
            <p>No classes are currently attached to your units.</p>
            <p className="text-sm mt-8" style={{ marginTop: 8 }}>
              Share your unit code with a class rep to get started — they
              control attaching their class, not you.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {offerings.map(o => (
              <div key={o.id} className="card">
                <div className="row-between">
                  <div>
                    <div style={{ fontWeight: 600 }}>{o.class_detail?.name}</div>
                    <div className="text-sm text-muted">
                      Doing {o.unit_detail?.code} · {o.class_detail?.group_count} group(s)
                    </div>
                  </div>
                  <span className="badge badge-done">Active</span>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* History */}
      {tab === 'history' && (
        history.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🗄</div>
            <p>No past offerings yet.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {history.map(o => (
              <div key={o.id} className="card">
                <div className="row-between">
                  <div>
                    <div style={{ fontWeight: 600 }}>{o.class_detail?.name}</div>
                    <div className="text-sm text-muted">{o.unit_detail?.code} — {o.unit_detail?.name}</div>
                  </div>
                  <span className="badge badge-todo">Closed</span>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {pendingConfirm && (
        <div className="modal-overlay" onClick={() => setPendingConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Confirm Co-Lecturer Join</div>
            <p className="text-sm">{pendingConfirm.message}</p>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setPendingConfirm(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => submitCreate(pendingConfirm.payload)}>
                Join Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

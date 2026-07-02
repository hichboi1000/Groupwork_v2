import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getClasses, createClass, getAllGroups,
  getUnitOfferings, getUnitOfferingsHistory,
  attachClassToUnit, detachClass,
} from '../api/client';

const STAGES = [
  ['1.1', 'Year 1, Sem 1'], ['1.2', 'Year 1, Sem 2'],
  ['2.1', 'Year 2, Sem 1'], ['2.2', 'Year 2, Sem 2'],
  ['3.1', 'Year 3, Sem 1'], ['3.2', 'Year 3, Sem 2'],
  ['4.1', 'Year 4, Sem 1'], ['4.2', 'Year 4, Sem 2'],
];

function CopyCode({ code }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <span className="row" style={{ gap: 8 }}>
      <span className="code-badge" style={{ fontSize: 14, padding: '6px 12px' }}>{code}</span>
      <button className="btn btn-sm btn-outline" onClick={copy}>{copied ? '✓' : '📋'}</button>
    </span>
  );
}

export default function ClassManagementPage() {
  const { user } = useAuth();
  const [classes, setClasses] = useState([]);
  const [groups, setGroups] = useState([]);
  const [offerings, setOfferings] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tab, setTab] = useState('classes');

  const [createForm, setCreateForm] = useState({ name: '', program: '', stage: '3.1', cohort_year: new Date().getFullYear() });
  const [attachForm, setAttachForm] = useState({ unit_code: '', class_id: '' });
  const [pendingDetach, setPendingDetach] = useState(null); // offering needing confirmation

  useEffect(() => { loadAll(); }, []);

  const loadAll = () => {
    setLoading(true);
    Promise.all([
      getClasses().catch(() => ({ data: [] })),
      getAllGroups().catch(() => ({ data: [] })),
      getUnitOfferings().catch(() => ({ data: [] })),
      getUnitOfferingsHistory().catch(() => ({ data: [] })),
    ]).then(([c, g, o, h]) => {
      setClasses(c.data); setGroups(g.data); setOfferings(o.data); setHistory(h.data);
    }).finally(() => setLoading(false));
  };

  const handleCreateClass = async (e) => {
    e.preventDefault(); setError(''); setSuccess('');
    try {
      const r = await createClass(createForm);
      setClasses([r.data, ...classes]);
      setSuccess(`Class "${r.data.name}" created. Share code ${r.data.code} with your group leaders.`);
      setCreateForm({ name: '', program: '', stage: '3.1', cohort_year: new Date().getFullYear() });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create class.');
    }
  };

  const handleAttach = async (e) => {
    e.preventDefault(); setError(''); setSuccess('');
    try {
      await attachClassToUnit({
        unit_code: attachForm.unit_code.toUpperCase(),
        class_id: attachForm.class_id,
      });
      setSuccess('Class attached to unit successfully!');
      setAttachForm({ unit_code: '', class_id: '' });
      loadAll();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not attach — check the unit code.');
    }
  };

  const handleDetach = async (offering, confirm = false) => {
    setError(''); setSuccess('');
    try {
      await detachClass(offering.id, confirm);
      setSuccess(`Detached ${offering.class_detail?.name} from ${offering.unit_detail?.code}.`);
      setPendingDetach(null);
      loadAll();
    } catch (err) {
      if (err.response?.status === 409 && err.response.data?.needs_confirmation) {
        setPendingDetach({ offering, message: err.response.data.message });
      } else {
        setError(err.response?.data?.error || 'Could not detach.');
      }
    }
  };

  if (user.role !== 'rep') {
    return (
      <div className="empty-state">
        <div className="empty-icon">🚫</div>
        <p>Class management is only available to class representatives.</p>
      </div>
    );
  }

  if (loading) return <div className="text-muted">Loading…</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Class Management</h1>
        <p>Create your class, attach it to units, and manage its groups.</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="tabs">
        <button className={`tab-btn ${tab === 'classes' ? 'active' : ''}`} onClick={() => setTab('classes')}>
          📚 My Classes ({classes.length})
        </button>
        <button className={`tab-btn ${tab === 'create' ? 'active' : ''}`} onClick={() => setTab('create')}>
          ➕ Create Class
        </button>
        <button className={`tab-btn ${tab === 'attach' ? 'active' : ''}`} onClick={() => setTab('attach')}>
          🔗 Attach to Unit
        </button>
        <button className={`tab-btn ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>
          🗄 Past Offerings ({history.length})
        </button>
      </div>

      {/* My classes */}
      {tab === 'classes' && (
        classes.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📚</div>
            <p>You haven't created a class yet.</p>
            <button className="btn btn-primary mt-16" style={{ marginTop: 16 }} onClick={() => setTab('create')}>
              Create your first class
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {classes.map(cls => {
              const classGroups = groups.filter(g => g.class_name === cls.name);
              return (
                <div key={cls.id} className="card">
                  <div className="row-between mb-16" style={{ marginBottom: 14 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{cls.name}</div>
                      <div className="text-sm text-muted">{cls.cohort_year} intake · {cls.group_count} group(s)</div>
                    </div>
                    <CopyCode code={cls.code} />
                  </div>

                  {cls.active_offering ? (
                    <div className="alert alert-info" style={{ marginBottom: 12 }}>
                      Currently attached to <strong>{cls.active_offering.unit_code}</strong> — {cls.active_offering.unit_name}
                    </div>
                  ) : (
                    <div className="text-sm text-muted mb-16" style={{ marginBottom: 12 }}>
                      Not attached to any unit right now.
                    </div>
                  )}

                  {classGroups.length > 0 && (
                    <div>
                      <div className="text-sm text-muted mb-16" style={{ marginBottom: 8 }}>Groups in this class</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {classGroups.map(g => (
                          <span key={g.id} className="badge badge-accent">{g.name} ({g.member_count})</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Create class */}
      {tab === 'create' && (
        <div className="card" style={{ maxWidth: 480 }}>
          <div className="card-title">Create a New Class</div>
          <form onSubmit={handleCreateClass}>
            <div className="form-group">
              <label className="form-label">Display Name *</label>
              <input className="form-input" placeholder="e.g. BBIT 3.2" value={createForm.name}
                onChange={e => setCreateForm({ ...createForm, name: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Program *</label>
              <input className="form-input" placeholder="e.g. BBIT" value={createForm.program}
                onChange={e => setCreateForm({ ...createForm, program: e.target.value })} required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Stage *</label>
                <select className="form-select" value={createForm.stage}
                  onChange={e => setCreateForm({ ...createForm, stage: e.target.value })}>
                  {STAGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Cohort Intake Year *</label>
                <input className="form-input" type="number" value={createForm.cohort_year}
                  onChange={e => setCreateForm({ ...createForm, cohort_year: e.target.value })} required />
              </div>
            </div>
            <p className="text-muted text-sm mb-16" style={{ marginBottom: 16 }}>
              This represents one specific cohort, not a reusable label —
              next year's "BBIT 3.2" will be a separate class with a
              different intake year.
            </p>
            <button className="btn btn-primary w-full" type="submit">Create Class</button>
          </form>
        </div>
      )}

      {/* Attach to unit */}
      {tab === 'attach' && (
        <div className="card" style={{ maxWidth: 480 }}>
          <div className="card-title">Attach a Class to a Unit</div>
          <p className="text-muted text-sm mb-16" style={{ marginBottom: 16 }}>
            Enter the unit code your lecturer shared with you (e.g. CS302).
            Your class's groups will then be able to do assignments under
            that unit for this semester.
          </p>
          <form onSubmit={handleAttach}>
            <div className="form-group">
              <label className="form-label">Class *</label>
              <select className="form-select" value={attachForm.class_id}
                onChange={e => setAttachForm({ ...attachForm, class_id: e.target.value })} required>
                <option value="">— Select your class —</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name} ({c.cohort_year})</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Unit Code *</label>
              <input className="form-input" placeholder="e.g. CS302" value={attachForm.unit_code}
                onChange={e => setAttachForm({ ...attachForm, unit_code: e.target.value.toUpperCase() })}
                style={{ fontFamily: 'monospace', letterSpacing: 2 }} required />
            </div>
            <button className="btn btn-primary w-full" type="submit">Attach</button>
          </form>

          {offerings.length > 0 && (
            <div className="mt-24" style={{ marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
              <div className="card-title" style={{ fontSize: 14 }}>Currently Active Offerings</div>
              <div style={{ display: 'grid', gap: 10 }}>
                {offerings.map(o => (
                  <div key={o.id} style={{ background: 'var(--surface2)', borderRadius: 8, padding: 12 }}>
                    <div className="row-between">
                      <div>
                        <div style={{ fontWeight: 600 }}>{o.class_detail?.name} → {o.unit_detail?.code}</div>
                        <div className="text-sm text-muted">{o.unit_detail?.name}</div>
                      </div>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDetach(o)}>Detach</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pendingDetach && (
            <div className="modal-overlay" onClick={() => setPendingDetach(null)}>
              <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-title">Confirm Detach</div>
                <p className="text-sm">{pendingDetach.message}</p>
                <div className="modal-actions">
                  <button className="btn btn-outline" onClick={() => setPendingDetach(null)}>Cancel</button>
                  <button className="btn btn-danger" onClick={() => handleDetach(pendingDetach.offering, true)}>
                    Detach Anyway
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* History */}
      {tab === 'history' && (
        history.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🗄</div>
            <p>No past offerings yet. Detached classes will show up here.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {history.map(o => (
              <div key={o.id} className="card">
                <div className="row-between">
                  <div>
                    <div style={{ fontWeight: 600 }}>{o.class_detail?.name} → {o.unit_detail?.code}</div>
                    <div className="text-sm text-muted">{o.unit_detail?.name}</div>
                  </div>
                  <span className="badge badge-todo">Closed</span>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

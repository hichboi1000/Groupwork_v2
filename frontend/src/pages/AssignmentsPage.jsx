import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getAssignments, createAssignment, getUnits, createUnit,
  getGroupAssignments, createGroupAssignment, getAllGroups,
  getSubmissions, createSubmission, getMyGroup,
} from '../api/client';

function DeadlineBadge({ assignment }) {
  if (assignment.is_overdue) return <span className="badge badge-overdue">Overdue</span>;
  if (assignment.days_remaining <= 2) return <span className="badge badge-progress">{assignment.days_remaining}d left</span>;
  return <span className="badge badge-done">{assignment.days_remaining}d left</span>;
}

export default function AssignmentsPage() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [units, setUnits] = useState([]);
  const [groups, setGroups] = useState([]);
  const [groupAssignments, setGroupAssignments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [myGroup, setMyGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('assignments');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Forms
  const [aForm, setAForm] = useState({ title: '', description: '', unit: '', deadline: '' });
  const [uForm, setUForm] = useState({ name: '', code: '' });
  const [gaForm, setGaForm] = useState({ group: '', assignment: '' });
  const [subForm, setSubForm] = useState({ assignment: '', content: '', file: null });

  const isLecturerOrRep = ['lecturer', 'rep'].includes(user?.role);
  const isLeader = user?.role === 'leader';

  useEffect(() => {
    const promises = [
      getAssignments().catch(() => ({ data: [] })),
      getUnits().catch(() => ({ data: [] })),
      getGroupAssignments().catch(() => ({ data: [] })),
    ];
    if (isLecturerOrRep) promises.push(getAllGroups().catch(() => ({ data: [] })));
    if (isLeader) {
      promises.push(getSubmissions().catch(() => ({ data: [] })));
      promises.push(getMyGroup().catch(() => ({ data: null })));
    }

    Promise.all(promises).then(results => {
      setAssignments(results[0].data);
      setUnits(results[1].data);
      setGroupAssignments(results[2].data);
      if (isLecturerOrRep) setGroups(results[3].data);
      if (isLeader) {
        setSubmissions(results[3]?.data || []);
        setMyGroup(results[4]?.data || null);
      }
    }).finally(() => setLoading(false));
  }, []);

  const postAssignment = async (e) => {
    e.preventDefault(); setError(''); setSuccess('');
    try {
      const r = await createAssignment(aForm);
      setAssignments([r.data, ...assignments]);
      setAForm({ title: '', description: '', unit: '', deadline: '' });
      setSuccess('Assignment posted!');
    } catch (err) {
      setError(err.response?.data ? Object.values(err.response.data).flat().join(' ') : 'Failed.');
    }
  };

  const postUnit = async (e) => {
    e.preventDefault(); setError(''); setSuccess('');
    try {
      const r = await createUnit(uForm);
      setUnits([...units, r.data]);
      setUForm({ name: '', code: '' });
      setSuccess('Unit created!');
    } catch (err) {
      setError(err.response?.data ? Object.values(err.response.data).flat().join(' ') : 'Failed.');
    }
  };

  const linkGroup = async (e) => {
    e.preventDefault(); setError(''); setSuccess('');
    try {
      const r = await createGroupAssignment(gaForm);
      setGroupAssignments([...groupAssignments, r.data]);
      setGaForm({ group: '', assignment: '' });
      setSuccess('Assignment linked to group! All members have been notified.');
    } catch (err) {
      setError(err.response?.data ? Object.values(err.response.data).flat().join(' ') : 'Failed.');
    }
  };

  const submitWork = async (e) => {
    e.preventDefault(); setError(''); setSuccess('');
    if (!myGroup) { setError('You need to be in a group first.'); return; }
    try {
      const payload = { ...subForm, group: myGroup.id };
      if (!payload.file) delete payload.file;
      await createSubmission(payload);
      setSubForm({ assignment: '', content: '', file: null });
      setSuccess('Submission made!');
    } catch (err) {
      setError(err.response?.data ? Object.values(err.response.data).flat().join(' ') : 'Failed.');
    }
  };

  if (loading) return <div className="text-muted">Loading…</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Assignments</h1>
        <p>{assignments.length} assignment{assignments.length !== 1 ? 's' : ''} total</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="tabs">
        <button className={`tab-btn ${tab === 'assignments' ? 'active' : ''}`} onClick={() => setTab('assignments')}>
          📋 Assignments ({assignments.length})
        </button>
        {isLecturerOrRep && (
          <>
            <button className={`tab-btn ${tab === 'post' ? 'active' : ''}`} onClick={() => setTab('post')}>
              ➕ Post Assignment
            </button>
            <button className={`tab-btn ${tab === 'units' ? 'active' : ''}`} onClick={() => setTab('units')}>
              📚 Units
            </button>
            <button className={`tab-btn ${tab === 'link' ? 'active' : ''}`} onClick={() => setTab('link')}>
              🔗 Link to Group
            </button>
          </>
        )}
        {isLeader && (
          <button className={`tab-btn ${tab === 'submit' ? 'active' : ''}`} onClick={() => setTab('submit')}>
            📤 Submit Work
          </button>
        )}
      </div>

      {/* Assignments list */}
      {tab === 'assignments' && (
        assignments.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <p>No assignments yet.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            {assignments.map(a => (
              <div key={a.id} className="card">
                <div className="row-between">
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{a.title}</div>
                    <div className="text-sm text-muted mt-8" style={{ marginTop: 4 }}>
                      {a.unit_detail?.code} — {a.unit_detail?.name}
                    </div>
                  </div>
                  <DeadlineBadge assignment={a} />
                </div>
                <p className="text-sm text-muted mt-8" style={{ marginTop: 10 }}>{a.description}</p>
                <div className="row mt-8" style={{ marginTop: 10, gap: 16 }}>
                  <span className="text-sm text-muted">
                    📅 Deadline: {new Date(a.deadline).toLocaleString('en-KE', {
                      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </span>
                  <span className="text-sm text-muted">Posted by {a.created_by?.full_name}</span>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Post assignment (lecturer/rep) */}
      {tab === 'post' && (
        <div className="card" style={{ maxWidth: 540 }}>
          <div className="card-title">Post New Assignment</div>
          <form onSubmit={postAssignment}>
            <div className="form-group">
              <label className="form-label">Title *</label>
              <input className="form-input" value={aForm.title} onChange={e => setAForm({ ...aForm, title: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Description *</label>
              <textarea className="form-textarea" value={aForm.description} onChange={e => setAForm({ ...aForm, description: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Unit *</label>
              <select className="form-select" value={aForm.unit} onChange={e => setAForm({ ...aForm, unit: e.target.value })} required>
                <option value="">— Select unit —</option>
                {units.map(u => <option key={u.id} value={u.id}>{u.code} — {u.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Deadline *</label>
              <input className="form-input" type="datetime-local" value={aForm.deadline}
                onChange={e => setAForm({ ...aForm, deadline: e.target.value })} required />
            </div>
            <button className="btn btn-primary" type="submit">Post Assignment</button>
          </form>
        </div>
      )}

      {/* Units (lecturer/rep) */}
      {tab === 'units' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div className="card">
            <div className="card-title">Create Unit</div>
            <form onSubmit={postUnit}>
              <div className="form-group">
                <label className="form-label">Unit Code *</label>
                <input className="form-input" placeholder="e.g. CS301" value={uForm.code}
                  onChange={e => setUForm({ ...uForm, code: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Unit Name *</label>
                <input className="form-input" placeholder="e.g. Operations Research" value={uForm.name}
                  onChange={e => setUForm({ ...uForm, name: e.target.value })} required />
              </div>
              <button className="btn btn-primary" type="submit">Create Unit</button>
            </form>
          </div>
          <div className="card">
            <div className="card-title">Existing Units ({units.length})</div>
            {units.length === 0 ? <p className="text-muted text-sm">No units yet.</p> : (
              <div style={{ display: 'grid', gap: 8 }}>
                {units.map(u => (
                  <div key={u.id} style={{ background: 'var(--surface2)', borderRadius: 6, padding: '8px 12px' }}>
                    <span className="badge badge-accent" style={{ marginRight: 8 }}>{u.code}</span>
                    {u.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Link assignment to group (lecturer/rep) */}
      {tab === 'link' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div className="card">
            <div className="card-title">Link Assignment to a Group</div>
            <p className="text-sm text-muted mb-16" style={{ marginBottom: 16 }}>
              This notifies all group members and makes the assignment visible to them.
            </p>
            <form onSubmit={linkGroup}>
              <div className="form-group">
                <label className="form-label">Group *</label>
                <select className="form-select" value={gaForm.group} onChange={e => setGaForm({ ...gaForm, group: e.target.value })} required>
                  <option value="">— Select group —</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name} (Leader: {g.leader?.full_name})</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Assignment *</label>
                <select className="form-select" value={gaForm.assignment} onChange={e => setGaForm({ ...gaForm, assignment: e.target.value })} required>
                  <option value="">— Select assignment —</option>
                  {assignments.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
                </select>
              </div>
              <button className="btn btn-primary" type="submit">Link & Notify</button>
            </form>
          </div>
          <div className="card">
            <div className="card-title">Linked Assignments ({groupAssignments.length})</div>
            {groupAssignments.length === 0 ? <p className="text-muted text-sm">None yet.</p> : (
              <div style={{ display: 'grid', gap: 8 }}>
                {groupAssignments.map(ga => (
                  <div key={ga.id} style={{ background: 'var(--surface2)', borderRadius: 6, padding: '10px 12px' }}>
                    <div style={{ fontWeight: 500 }}>{ga.assignment_detail?.title}</div>
                    <div className="text-sm text-muted">{ga.group_name}</div>
                    <span className={`badge ${ga.status === 'submitted' ? 'badge-done' : 'badge-progress'}`} style={{ marginTop: 6 }}>
                      {ga.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Submit work (leader) */}
      {tab === 'submit' && (
        <div className="card" style={{ maxWidth: 540 }}>
          <div className="card-title">📤 Submit Assignment Work</div>
          {!myGroup && <div className="alert alert-error">You need to be in a group to submit.</div>}
          {submissions.length > 0 && (
            <div className="alert alert-info" style={{ marginBottom: 16 }}>
              You have {submissions.length} existing submission(s).
            </div>
          )}
          <form onSubmit={submitWork}>
            <div className="form-group">
              <label className="form-label">Assignment *</label>
              <select className="form-select" value={subForm.assignment}
                onChange={e => setSubForm({ ...subForm, assignment: e.target.value })} required>
                <option value="">— Select assignment —</option>
                {assignments.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Notes / Comments</label>
              <textarea className="form-textarea" value={subForm.content}
                onChange={e => setSubForm({ ...subForm, content: e.target.value })}
                placeholder="Any notes for the lecturer..." />
            </div>
            <div className="form-group">
              <label className="form-label">Upload File (optional)</label>
              <input className="form-input" type="file"
                onChange={e => setSubForm({ ...subForm, file: e.target.files[0] })} />
            </div>
            <button className="btn btn-primary" type="submit" disabled={!myGroup}>Submit</button>
          </form>
        </div>
      )}
    </div>
  );
}

import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getTasks, createTask, updateTask, deleteTask, getMyGroup, getAssignments } from '../api/client';

const STATUS_META = {
  todo:     { label: 'To Do',       cls: 'badge-todo',     color: 'var(--muted)' },
  progress: { label: 'In Progress', cls: 'badge-progress', color: 'var(--amber)' },
  done:     { label: 'Done',        cls: 'badge-done',     color: 'var(--green)' },
};

function StatusBadge({ status, overdue }) {
  if (overdue && status !== 'done')
    return <span className="badge badge-overdue">Overdue</span>;
  const m = STATUS_META[status] || STATUS_META.todo;
  return <span className={`badge ${m.cls}`}>{m.label}</span>;
}

/* ── Evidence Modal ── shown when a student tries to mark a task done ── */
function EvidenceModal({ task, onClose, onSaved }) {
  const [text, setText] = useState(task.submission_text || '');
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef();

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim() && !file) {
      setErr('You must attach a written note or upload a file before marking this done.');
      return;
    }
    setSaving(true); setErr('');
    try {
      const payload = { status: 'done', submission_text: text };
      if (file) payload.submission_file = file;
      const r = await updateTask(task.id, payload);
      onSaved(r.data);
      onClose();
    } catch (e) {
      setErr(e.response?.data?.status?.[0] || e.response?.data?.detail || 'Could not save.');
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
        <div className="modal-title">Mark Task as Done</div>
        <p className="text-sm text-muted mb-16" style={{ marginBottom: 18, lineHeight: 1.7 }}>
          Before this task is marked <strong>Done</strong>, you need to show
          what you actually did. Add a written summary, upload your file, or
          both — your group leader will see this.
        </p>

        {err && <div className="alert alert-error">{err}</div>}

        <div style={{ background: 'var(--surface-sunken)', borderRadius: 8, padding: '12px 14px', marginBottom: 18 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{task.title}</div>
          {task.description && <div className="text-sm text-muted" style={{ marginTop: 3 }}>{task.description}</div>}
        </div>

        <form onSubmit={submit}>
          <div className="form-group">
            <label className="form-label">Written Summary</label>
            <textarea className="form-textarea" value={text}
              onChange={e => setText(e.target.value)} rows={4}
              placeholder="Describe what you did, key findings, or notes for the leader…" />
          </div>

          <div className="form-group">
            <label className="form-label">Upload File (optional)</label>
            {file ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface-sunken)', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 20 }}>📎</span>
                <span style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                <button type="button" className="btn btn-sm btn-danger" onClick={() => { setFile(null); fileRef.current.value = ''; }}>✕</button>
              </div>
            ) : (
              <div style={{ border: '2px dashed var(--border-strong)', borderRadius: 8, padding: '22px 16px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s' }}
                onClick={() => fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>📂</div>
                <div className="text-sm" style={{ color: 'var(--navy)', fontWeight: 600 }}>Click to browse or drag a file here</div>
                <div className="text-sm text-muted" style={{ marginTop: 4 }}>PDF, Word, images — any format</div>
              </div>
            )}
            <input ref={fileRef} type="file" style={{ display: 'none' }}
              onChange={e => setFile(e.target.files[0])} />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : '✓ Mark as Done'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Create / Edit Task Modal ── leader-facing ── */
function TaskModal({ task, group, assignments, onClose, onSave }) {
  const [form, setForm] = useState(task || {
    title: '', description: '', assigned_to: '', status: 'todo',
    due_date: '', assignment: '', group: group?.id || '',
  });
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const h = e => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.assignment) delete payload.assignment;
      if (!payload.due_date)   delete payload.due_date;
      const r = task?.id ? await updateTask(task.id, payload) : await createTask(payload);
      onSave(r.data); onClose();
    } catch (err) {
      const d = err.response?.data;
      setErr(d ? Object.values(d).flat().join(' ') : 'Failed to save task.');
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">{task?.id ? 'Edit Task' : 'Create New Task'}</div>
        {err && <div className="alert alert-error">{err}</div>}
        <form onSubmit={submit}>
          <div className="form-group">
            <label className="form-label">Task Title *</label>
            <input className="form-input" name="title" value={form.title} onChange={h} required autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" name="description" value={form.description} onChange={h}
              placeholder="What exactly does this task involve?" />
          </div>
          <div className="form-group">
            <label className="form-label">Assign To *</label>
            <select className="form-select" name="assigned_to" value={form.assigned_to} onChange={h} required>
              <option value="">— Select member —</option>
              {group?.members?.map(m => (
                <option key={m.id} value={m.id}>{m.full_name} ({m.role})</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Link to Assignment (optional)</label>
            <select className="form-select" name="assignment" value={form.assignment} onChange={h}>
              <option value="">— Standalone task —</option>
              {assignments.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Due Date</label>
              <input className="form-input" type="datetime-local" name="due_date"
                value={form.due_date?.slice(0, 16) || ''} onChange={h} />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" name="status" value={form.status} onChange={h}>
                <option value="todo">To Do</option>
                <option value="progress">In Progress</option>
              </select>
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : task?.id ? 'Update Task' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Main page ── */
export default function TasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [group, setGroup] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);         // 'create' | task obj | null
  const [evidenceTask, setEvidenceTask] = useState(null); // task needing evidence
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      getTasks(),
      getMyGroup().catch(() => ({ data: null })),
      getAssignments().catch(() => ({ data: [] })),
    ]).then(([t, g, a]) => {
      setTasks(t.data); setGroup(g.data); setAssignments(a.data);
    }).finally(() => setLoading(false));
  }, []);

  const handleStatusChange = (task, newStatus) => {
    if (newStatus === 'done') {
      // Intercept and show evidence modal instead of updating directly
      setEvidenceTask(task);
      return;
    }
    updateTask(task.id, { status: newStatus })
      .then(r => setTasks(tasks.map(t => t.id === task.id ? r.data : t)))
      .catch(() => setError('Could not update status.'));
  };

  const handleDelete = (id) => {
    if (!window.confirm('Delete this task?')) return;
    deleteTask(id)
      .then(() => setTasks(tasks.filter(t => t.id !== id)))
      .catch(() => setError('Could not delete task.'));
  };

  const onSave = (saved) =>
    setTasks(prev => prev.find(t => t.id === saved.id)
      ? prev.map(t => t.id === saved.id ? saved : t)
      : [saved, ...prev]);

  const counts = {
    all:      tasks.length,
    todo:     tasks.filter(t => t.status === 'todo').length,
    progress: tasks.filter(t => t.status === 'progress').length,
    done:     tasks.filter(t => t.status === 'done').length,
    overdue:  tasks.filter(t => t.is_overdue).length,
  };
  const filtered = filter === 'all' ? tasks
    : filter === 'overdue' ? tasks.filter(t => t.is_overdue)
    : tasks.filter(t => t.status === filter);

  if (loading) return <div className="text-muted" style={{ padding: 40 }}>Loading tasks…</div>;

  return (
    <div>
      <div className="row-between page-header">
        <div>
          <h1>Tasks</h1>
          <p>{counts.done} of {counts.all} done
            {counts.overdue > 0 && <span className="text-red" style={{ marginLeft: 8 }}>· {counts.overdue} overdue</span>}
          </p>
        </div>
        {user.role === 'leader' && group && (
          <button className="btn btn-primary" onClick={() => setModal('create')}>
            + New Task
          </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Filter tabs */}
      <div className="tabs">
        {[
          ['all', 'All', counts.all],
          ['todo', 'To Do', counts.todo],
          ['progress', 'In Progress', counts.progress],
          ['done', 'Done', counts.done],
          ...(counts.overdue > 0 ? [['overdue', 'Overdue', counts.overdue]] : []),
        ].map(([val, label, count]) => (
          <button key={val} className={`tab-btn ${filter === val ? 'active' : ''}`}
            onClick={() => setFilter(val)}>
            {label} <span style={{ opacity: 0.6, marginLeft: 4 }}>({count})</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">✅</div>
          <p>{filter === 'all' ? 'No tasks yet.' : `No ${filter} tasks.`}</p>
          {user.role === 'leader' && group && filter === 'all' && (
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setModal('create')}>
              Create the first task
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {filtered.map(task => {
            const isOwn = task.assigned_to === user.id;
            const canUpdateStatus = user.role === 'student' && isOwn;
            const edgeClass = task.is_overdue && task.status !== 'done' ? 'overdue'
              : task.status === 'done' ? 'done'
              : task.status === 'progress' ? 'progress' : 'todo';

            return (
              <div key={task.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'stretch' }}>
                  {/* Left edge color bar */}
                  <div style={{
                    width: 4, flexShrink: 0,
                    background: edgeClass === 'done' ? 'var(--green)'
                      : edgeClass === 'progress' ? 'var(--amber)'
                      : edgeClass === 'overdue' ? 'var(--red)'
                      : 'var(--border-strong)'
                  }} />

                  <div style={{ flex: 1, padding: '14px 18px' }}>
                    <div className="row-between">
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14.5 }}>{task.title}</div>
                        {task.description && (
                          <div className="text-sm text-muted" style={{ marginTop: 3 }}>{task.description}</div>
                        )}
                        <div className="row" style={{ gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
                          {/* Assignee */}
                          <div className="member-row">
                            <div className="avatar sm">{task.assigned_to_detail?.avatar_initials}</div>
                            <span className="text-sm">{task.assigned_to_detail?.full_name}</span>
                          </div>
                          {/* Assignment link */}
                          {task.assignment_title && (
                            <span className="badge badge-accent" style={{ fontSize: 11 }}>
                              {task.assignment_title}
                            </span>
                          )}
                          {/* Due date */}
                          {task.due_date && (
                            <span className="text-sm text-muted">
                              Due {new Date(task.due_date).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
                            </span>
                          )}
                        </div>
                        {/* Evidence preview if done */}
                        {task.status === 'done' && task.submission_text && (
                          <div style={{ marginTop: 10, background: 'var(--surface-sunken)', borderRadius: 6, padding: '8px 12px', fontSize: 13, color: 'var(--muted)', borderLeft: '3px solid var(--green)' }}>
                            <span style={{ fontWeight: 600, color: 'var(--green)' }}>Evidence: </span>
                            {task.submission_text.length > 120
                              ? task.submission_text.slice(0, 120) + '…'
                              : task.submission_text}
                          </div>
                        )}
                        {task.status === 'done' && task.submission_file && (
                          <div style={{ marginTop: 6, fontSize: 12, color: 'var(--green)' }}>📎 File attached</div>
                        )}
                      </div>

                      {/* Right side: status + actions */}
                      <div className="row" style={{ gap: 10, marginLeft: 16, flexShrink: 0, alignItems: 'flex-start' }}>
                        {canUpdateStatus ? (
                          <select
                            className="form-select"
                            value={task.status}
                            onChange={e => handleStatusChange(task, e.target.value)}
                            style={{ padding: '4px 10px', fontSize: 12.5, width: 'auto', minWidth: 130 }}
                          >
                            <option value="todo">To Do</option>
                            <option value="progress">In Progress</option>
                            <option value="done">Done</option>
                          </select>
                        ) : (
                          <StatusBadge status={task.status} overdue={task.is_overdue} />
                        )}
                        {user.role === 'leader' && (
                          <div className="row" style={{ gap: 6 }}>
                            <button className="btn btn-sm btn-outline" onClick={() => setModal(task)}>Edit</button>
                            <button className="btn btn-sm btn-danger" onClick={() => handleDelete(task.id)}>✕</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Evidence modal — triggered when student picks "Done" */}
      {evidenceTask && (
        <EvidenceModal
          task={evidenceTask}
          onClose={() => setEvidenceTask(null)}
          onSaved={saved => {
            setTasks(prev => prev.map(t => t.id === saved.id ? saved : t));
            setEvidenceTask(null);
          }}
        />
      )}

      {/* Create/edit task modal */}
      {modal && (
        <TaskModal
          task={modal === 'create' ? null : modal}
          group={group}
          assignments={assignments}
          onClose={() => setModal(null)}
          onSave={onSave}
        />
      )}
    </div>
  );
}

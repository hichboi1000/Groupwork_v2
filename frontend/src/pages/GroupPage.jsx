import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getMyGroup, createGroup, joinGroup, leaveGroup } from '../api/client';

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button className="btn btn-outline btn-sm" onClick={copy}>
      {copied ? '✓ Copied' : '📋 Copy Code'}
    </button>
  );
}

export default function GroupPage() {
  const { user } = useAuth();
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Create form — class_code is how a leader connects to their cohort,
  // same self-service code pattern as group/unit joining. Ask their rep.
  const [createForm, setCreateForm] = useState({ name: '', description: '', class_code: '' });
  // Join form
  const [joinCode, setJoinCode] = useState('');

  useEffect(() => {
    loadGroup();
  }, []);

  const loadGroup = () => {
    setLoading(true);
    getMyGroup()
      .then(r => setGroup(r.data))
      .catch(() => setGroup(null))
      .finally(() => setLoading(false));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      const payload = { ...createForm };
      if (!payload.class_code) delete payload.class_code;
      const r = await createGroup(payload);
      setGroup(r.data);
      setSuccess('Group created successfully!');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create group.');
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      const r = await joinGroup({ code: joinCode.toUpperCase() });
      setGroup(r.data.group);
      setSuccess('You joined the group!');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid code or already in a group.');
    }
  };

  const handleLeave = async () => {
    if (!window.confirm('Are you sure you want to leave this group?')) return;
    try {
      await leaveGroup();
      setGroup(null);
      setSuccess('You left the group.');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not leave group.');
    }
  };

  if (loading) return <div className="text-muted">Loading group…</div>;

  // No group yet
  if (!group) {
    return (
      <div>
        <div className="page-header">
          <h1>My Group</h1>
          <p>You are not in a group yet.</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {user.role === 'leader' && (
            <div className="card">
              <div className="card-title">👑 Create a Group</div>
              <form onSubmit={handleCreate}>
                <div className="form-group">
                  <label className="form-label">Group Name</label>
                  <input className="form-input" value={createForm.name}
                    onChange={e => setCreateForm({ ...createForm, name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Description (optional)</label>
                  <textarea className="form-textarea" value={createForm.description}
                    onChange={e => setCreateForm({ ...createForm, description: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Class Code (optional)</label>
                  <input className="form-input" value={createForm.class_code}
                    placeholder="e.g. K3J9QZ — ask your class rep"
                    onChange={e => setCreateForm({ ...createForm, class_code: e.target.value.toUpperCase() })}
                    style={{ fontFamily: 'monospace', letterSpacing: 2 }} />
                  <p className="text-muted text-sm mt-8" style={{ marginTop: 6 }}>
                    Connects your group to your class (e.g. BBIT 3.2), so your
                    class rep and lecturer can see your group's progress once
                    your class is attached to a unit. You can add this later too.
                  </p>
                </div>
                <button className="btn btn-primary w-full" type="submit">Create Group</button>
              </form>
            </div>
          )}

          {user.role !== 'leader' && (
            <div className="card">
              <div className="card-title">🤝 Join a Group</div>
              <p className="text-muted text-sm mb-16">Ask your group leader for the invite code.</p>
              <form onSubmit={handleJoin}>
                <div className="form-group">
                  <label className="form-label">Group Code</label>
                  <input className="form-input" value={joinCode} placeholder="e.g. A9PN6G"
                    onChange={e => setJoinCode(e.target.value.toUpperCase())}
                    style={{ fontFamily: 'monospace', letterSpacing: 3, fontSize: 18 }} required />
                </div>
                <button className="btn btn-primary w-full" type="submit">Join Group</button>
              </form>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Group exists
  const prog = group.progress || {};
  const total = prog.total || 0;
  const done = prog.done || 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div>
      <div className="row-between page-header">
        <div>
          <h1>{group.name}</h1>
          {group.description && <p>{group.description}</p>}
        </div>
        {user.role !== 'leader' && (
          <button className="btn btn-danger btn-sm" onClick={handleLeave}>Leave Group</button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Group info */}
        <div className="card">
          <div className="card-title">Group Info</div>
          <div style={{ marginBottom: 16 }}>
            <div className="text-sm text-muted mb-16" style={{ marginBottom: 8 }}>Invite Code</div>
            <div className="row">
              <span className="code-badge">{group.code}</span>
              <CopyButton text={group.code} />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div className="text-sm text-muted" style={{ marginBottom: 4 }}>Leader</div>
            <div className="member-row">
              <div className="avatar sm">{group.leader?.avatar_initials}</div>
              <span>{group.leader?.full_name}</span>
            </div>
          </div>
          {group.class_name && (
            <div>
              <div className="text-sm text-muted" style={{ marginBottom: 4 }}>Class</div>
              <span className="badge badge-accent">{group.class_name}</span>
            </div>
          )}
          {!group.class_name && user.role === 'leader' && (
            <div className="alert alert-info" style={{ marginTop: 12, marginBottom: 0 }}>
              This group isn't linked to a class yet. Ask your class rep for
              their class code, then re-create or contact support to link it.
            </div>
          )}
        </div>

        {/* Progress */}
        <div className="card">
          <div className="card-title">Task Progress</div>
          <div className="row-between" style={{ marginBottom: 10 }}>
            <span className="text-muted text-sm">{done} of {total} tasks done</span>
            <span className="text-accent font-bold">{pct}%</span>
          </div>
          <div className="progress-bar" style={{ marginBottom: 16 }}>
            <div className="progress-fill green" style={{ width: `${pct}%` }} />
          </div>
          <div className="row" style={{ gap: 16 }}>
            <div><div className="text-muted text-sm">To Do</div><div className="font-bold">{prog.todo || 0}</div></div>
            <div><div className="text-amber text-sm">In Progress</div><div className="font-bold text-amber">{prog.in_progress || 0}</div></div>
            <div><div className="text-green text-sm">Done</div><div className="font-bold text-green">{prog.done || 0}</div></div>
          </div>
        </div>
      </div>

      {/* Members */}
      <div className="card mt-16" style={{ marginTop: 20 }}>
        <div className="card-title">Members ({group.member_count})</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {group.members?.map(m => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface2)', borderRadius: 8, padding: 12 }}>
              <div className="avatar" style={{ background: m.role === 'leader' ? 'var(--accent)' : 'var(--amber)' }}>
                {m.avatar_initials}
              </div>
              <div>
                <div className="member-name">{m.full_name}</div>
                <div className="member-role" style={{ textTransform: 'capitalize' }}>{m.role}</div>
              </div>
              {m.id === group.leader?.id && (
                <span className="badge badge-accent" style={{ marginLeft: 'auto' }}>Leader</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

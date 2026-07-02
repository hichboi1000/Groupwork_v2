import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getGroupProgress, getAllGroups } from '../api/client';

function MemberCard({ member }) {
  const { summary, tasks } = member;
  const pct = summary.total > 0 ? Math.round((summary.done / summary.total) * 100) : 0;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="row-between mb-16" style={{ marginBottom: 14 }}>
        <div className="member-row">
          <div className="avatar lg">{member.member.avatar_initials}</div>
          <div>
            <div className="member-name" style={{ fontSize: 15 }}>{member.member.full_name}</div>
            <div className="member-role" style={{ textTransform: 'capitalize' }}>{member.member.role}</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="font-bold text-accent" style={{ fontSize: 20 }}>{pct}%</div>
          <div className="text-sm text-muted">{summary.done}/{summary.total} done</div>
        </div>
      </div>

      <div className="progress-bar mb-16" style={{ marginBottom: 12 }}>
        <div className="progress-fill green" style={{ width: `${pct}%` }} />
      </div>

      <div className="row" style={{ gap: 16, marginBottom: summary.overdue > 0 ? 12 : 0 }}>
        <span className="text-sm text-muted">📋 {summary.todo} to do</span>
        <span className="text-sm text-amber">⏳ {summary.in_progress} in progress</span>
        <span className="text-sm text-green">✅ {summary.done} done</span>
        {summary.overdue > 0 && <span className="text-sm text-red">⚠ {summary.overdue} overdue</span>}
      </div>

      {tasks.length > 0 && (
        <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          {tasks.map(task => (
            <div key={task.id} className={`status-edge ${task.is_overdue ? 'overdue' : task.status}`} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 0 8px 14px', borderBottom: '1px solid var(--border)'
            }}>
              <div>
                <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{task.title}</span>
                {task.assignment_title && (
                  <span className="text-sm text-muted" style={{ marginLeft: 8 }}>({task.assignment_title})</span>
                )}
              </div>
              <div className="row" style={{ gap: 8 }}>
                {task.is_overdue && <span className="badge badge-overdue">Overdue</span>}
                <span className={`badge badge-${task.status === 'done' ? 'done' : task.status === 'progress' ? 'progress' : 'todo'}`}>
                  {task.status === 'todo' ? 'To Do' : task.status === 'progress' ? 'In Progress' : 'Done'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProgressPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isLecturerOrRep = ['lecturer', 'rep'].includes(user?.role);

  useEffect(() => {
    if (isLecturerOrRep) {
      getAllGroups()
        .then(r => { setGroups(r.data); setLoading(false); })
        .catch(() => setLoading(false));
    } else {
      loadProgress();
    }
  }, []);

  const loadProgress = (groupId) => {
    setLoading(true); setError('');
    getGroupProgress(groupId)
      .then(r => setData(r.data))
      .catch(err => setError(err.response?.data?.error || 'Could not load progress.'))
      .finally(() => setLoading(false));
  };

  const handleGroupSelect = (e) => {
    const id = e.target.value;
    setSelectedGroup(id);
    if (id) loadProgress(id);
    else setData(null);
  };

  if (loading && !isLecturerOrRep) return <div className="text-muted">Loading progress…</div>;

  return (
    <div>
      <div className="page-header">
        <h1>{isLecturerOrRep ? 'All Groups Progress' : 'Group Progress'}</h1>
        <p>See who is on track and who needs attention.</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Lecturer/rep: group selector */}
      {isLecturerOrRep && (
        <div className="card mb-16" style={{ marginBottom: 20, maxWidth: 400 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Select a Group to Inspect</label>
            <select className="form-select" value={selectedGroup} onChange={handleGroupSelect}>
              <option value="">— Choose a group —</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name} (Leader: {g.leader?.full_name})</option>)}
            </select>
          </div>
        </div>
      )}

      {loading && isLecturerOrRep && <div className="text-muted">Loading…</div>}

      {data && (
        <>
          {/* Group summary */}
          <div className="card mb-16" style={{ marginBottom: 20 }}>
            <div className="row-between mb-16" style={{ marginBottom: 14 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 17 }}>{data.group.name}</div>
                <div className="text-sm text-muted">Leader: {data.group.leader?.full_name}</div>
              </div>
              <div className="code-badge" style={{ fontSize: 14, letterSpacing: 2 }}>{data.group.code}</div>
            </div>

            <div className="stat-grid" style={{ marginBottom: 0 }}>
              {[
                { label: 'Total Tasks', value: data.overall.total },
                { label: 'To Do', value: data.overall.todo, color: 'var(--text-muted)' },
                { label: 'In Progress', value: data.overall.in_progress, color: 'var(--amber)' },
                { label: 'Done', value: data.overall.done, color: 'var(--green)' },
              ].map((s, i) => (
                <div key={i} className="stat-card">
                  <div className="stat-label">{s.label}</div>
                  <div className="stat-value" style={s.color ? { color: s.color } : {}}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Per-member breakdown */}
          <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 15 }}>
            Member Breakdown ({data.members.length} members)
          </div>
          {data.members.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">👥</div>
              <p>No members in this group yet.</p>
            </div>
          ) : (
            data.members.map(m => <MemberCard key={m.member.id} member={m} />)
          )}
        </>
      )}

      {!data && !loading && !isLecturerOrRep && (
        <div className="empty-state">
          <div className="empty-icon">📊</div>
          <p>No progress data available yet. Create tasks first.</p>
        </div>
      )}
    </div>
  );
}

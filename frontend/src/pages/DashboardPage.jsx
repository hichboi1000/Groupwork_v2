import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getDashboardStats } from '../api/client';

function StatCard({ label, value, sub, color }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={color ? { color } : {}}>{value ?? '—'}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    getDashboardStats().then(r => setStats(r.data)).catch(() => {});
  }, []);

  const role = user?.role;
  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const pct = stats && stats.tasks_total > 0
    ? Math.round((stats.tasks_done / stats.tasks_total) * 100) : 0;

  return (
    <div>
      <div className="page-header">
        <h1>{greeting()}, {user?.first_name || user?.username} 👋</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: 4, textTransform: 'capitalize' }}>
          Role: {role} {stats?.group_name ? `· ${stats.group_name}` : ''}
        </p>
        {(role === 'lecturer' || role === 'rep') && stats && (
          <p style={{ color: 'var(--text-muted)', marginTop: 6, fontSize: 13 }}>
            {stats.units_count > 0 ? (
              <>Scoped to: <strong style={{ color: 'var(--accent)' }}>{stats.units?.join(', ')}</strong></>
            ) : (
              <span style={{ color: 'var(--amber)' }}>
                ⚠ No units assigned yet — ask an admin to assign you a unit in Django Admin.
              </span>
            )}
          </p>
        )}
      </div>

      {/* Stat cards */}
      {stats && (
        <div className="stat-grid">
          {role === 'lecturer' || role === 'rep' ? (
            <>
              <StatCard label="Your Units" value={stats.units_count} />
              <StatCard label="Groups in Scope" value={stats.total_groups} />
              <StatCard label="Students in Scope" value={stats.total_users} />
              <StatCard label="Assignments" value={stats.total_assignments} />
              <StatCard label="Tasks Created" value={stats.total_tasks} />
              <StatCard label="Submissions" value={stats.total_submissions} />
              <StatCard label="Unread Notifications" value={stats.unread_notifications} color="var(--accent-light)" />
            </>
          ) : (
            <>
              <StatCard label="Tasks Total" value={stats.tasks_total} />
              <StatCard label="To Do" value={stats.tasks_todo} color="var(--text-muted)" />
              <StatCard label="In Progress" value={stats.tasks_in_progress} color="var(--amber)" />
              <StatCard label="Done" value={stats.tasks_done} color="var(--green)" />
              {role === 'leader' && <StatCard label="Group Members" value={stats.member_count} />}
              <StatCard label="Unread" value={stats.unread_notifications} color="var(--accent-light)" />
            </>
          )}
        </div>
      )}

      {/* Progress bar for leaders/students */}
      {stats && role !== 'lecturer' && role !== 'rep' && stats.tasks_total > 0 && (
        <div className="card mb-16" style={{ marginBottom: 20 }}>
          <div className="row-between mb-16">
            <span className="card-title" style={{ marginBottom: 0 }}>Overall Progress</span>
            <span className="text-accent font-bold">{pct}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill green" style={{ width: `${pct}%` }} />
          </div>
          <div className="row mt-8" style={{ gap: 20 }}>
            <span className="text-sm text-muted">✅ {stats.tasks_done} done</span>
            <span className="text-sm text-amber">⏳ {stats.tasks_in_progress} in progress</span>
            <span className="text-sm text-muted">📋 {stats.tasks_todo} to do</span>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="card">
        <div className="card-title">Quick Actions</div>
        <div className="row flex-wrap" style={{ gap: 10 }}>
          {role === 'leader' && (
            <>
              <button className="btn btn-primary" onClick={() => navigate('/group')}>👥 Manage Group</button>
              <button className="btn btn-outline" onClick={() => navigate('/tasks')}>➕ Create Task</button>
              <button className="btn btn-outline" onClick={() => navigate('/progress')}>📊 View Progress</button>
              <button className="btn btn-outline" onClick={() => navigate('/assignments')}>📋 Assignments</button>
            </>
          )}
          {role === 'student' && (
            <>
              <button className="btn btn-primary" onClick={() => navigate('/group')}>👥 Join a Group</button>
              <button className="btn btn-outline" onClick={() => navigate('/tasks')}>✅ My Tasks</button>
              <button className="btn btn-outline" onClick={() => navigate('/assignments')}>📋 Assignments</button>
            </>
          )}
          {role === 'rep' && (
            <>
              <button className="btn btn-primary" onClick={() => navigate('/classes')}>🏫 Manage My Class</button>
              <button className="btn btn-outline" onClick={() => navigate('/progress')}>📊 Monitor Groups</button>
              <button className="btn btn-outline" onClick={() => navigate('/assignments')}>📋 Assignments</button>
            </>
          )}
          {role === 'lecturer' && (
            <>
              <button className="btn btn-primary" onClick={() => navigate('/units')}>📖 Manage Units</button>
              <button className="btn btn-outline" onClick={() => navigate('/assignments')}>📋 Post Assignment</button>
              <button className="btn btn-outline" onClick={() => navigate('/progress')}>📊 Monitor Groups</button>
            </>
          )}
          <button className="btn btn-outline" onClick={() => navigate('/notifications')}>
            🔔 Notifications
          </button>
        </div>
      </div>

      {/* Role guide */}
      <div className="card mt-16" style={{ marginTop: 20 }}>
        <div className="card-title">How GroupWork works</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(195px, 1fr))', gap: 12 }}>
          {[
            { icon: '🎓', title: '1. Lecturer creates a unit', desc: 'Enters the university unit code (e.g. CS302) — this becomes the join code' },
            { icon: '🏫', title: '2. Rep creates a class', desc: 'e.g. BBIT 3.2 (2024 intake) and shares the class code with group leaders' },
            { icon: '🔗', title: '3. Rep attaches to unit', desc: 'Uses the unit code to link their class to the lecturer\'s unit for the semester' },
            { icon: '👑', title: '4. Leader creates group', desc: 'Enters the class code to link their group to the right cohort' },
            { icon: '🤝', title: '5. Members join', desc: 'Students enter the group code given to them by their leader' },
            { icon: '✅', title: '6. Tasks assigned', desc: 'Leader breaks the assignment into tasks and assigns each to a member' },
            { icon: '📎', title: '7. Members submit evidence', desc: 'Must attach a file or write a summary before marking a task done' },
            { icon: '📊', title: '8. Leader sees progress', desc: 'Real-time breakdown of who has done what — the accountability dashboard' },
          ].map((step, i) => (
            <div key={i} style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border)', borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{step.icon}</div>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, color: 'var(--ink)' }}>{step.title}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>{step.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

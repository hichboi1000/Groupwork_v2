import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getNotifications } from '../../api/client';

const AVATAR_COLORS = {
  leader:   'var(--navy)',
  lecturer: 'var(--green)',
  rep:      'var(--amber)',
  student:  '#7C6FAE',
};

function NavItem({ to, icon, children, end, badge }) {
  return (
    <NavLink to={to} end={end}
      className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
      <span className="nav-icon">{icon}</span>
      {children}
      {badge > 0 && <span className="badge">{badge}</span>}
    </NavLink>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);

  const role = user?.role;
  const isLeader    = role === 'leader';
  const isLecturer  = role === 'lecturer';
  const isRep       = role === 'rep';
  const isStudent   = role === 'student';

  useEffect(() => {
    const fetchUnread = () =>
      getNotifications()
        .then(r => setUnread(r.data.filter(n => !n.is_read).length))
        .catch(() => {});
    fetchUnread();
    const id = setInterval(fetchUnread, 30000);
    return () => clearInterval(id);
  }, []);

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="logo-icon">G</div>
          <span>GroupWork</span>
        </div>

        <nav className="sidebar-nav">
          {/* ── Always visible ── */}
          <div className="nav-section">Overview</div>
          <NavItem to="/" end icon="🏠">Dashboard</NavItem>
          <NavItem to="/notifications" icon="🔔" badge={unread}>Notifications</NavItem>

          {/* ── Student & Leader ── */}
          {(isStudent || isLeader) && (
            <>
              <div className="nav-section">My Work</div>
              <NavItem to="/group" icon="👥">My Group</NavItem>
              <NavItem to="/tasks" icon="✅">Tasks</NavItem>
              <NavItem to="/assignments" icon="📋">Assignments</NavItem>
            </>
          )}

          {/* Leader extras */}
          {isLeader && (
            <>
              <div className="nav-section">Manage</div>
              <NavItem to="/progress" icon="📊">Group Progress</NavItem>
            </>
          )}

          {/* ── Class Rep ── */}
          {isRep && (
            <>
              <div className="nav-section">Class Admin</div>
              <NavItem to="/classes" icon="🏫">Class Management</NavItem>
              <NavItem to="/progress" icon="📊">Monitor Groups</NavItem>
              <NavItem to="/assignments" icon="📋">Assignments</NavItem>
            </>
          )}

          {/* ── Lecturer ── */}
          {isLecturer && (
            <>
              <div className="nav-section">Teaching</div>
              <NavItem to="/units" icon="📖">Units Management</NavItem>
              <NavItem to="/assignments" icon="📋">Assignments</NavItem>
              <NavItem to="/progress" icon="📊">Monitor Groups</NavItem>
            </>
          )}
        </nav>

        {/* User footer */}
        <div className="sidebar-footer">
          <div className="avatar" style={{ background: AVATAR_COLORS[role] || 'var(--navy)' }}>
            {user?.avatar_initials || user?.username?.[0]?.toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink)' }}>
              {user?.first_name ? `${user.first_name} ${user.last_name}` : user?.username}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'capitalize', marginTop: 1 }}>
              {role === 'rep' ? 'Class Representative' : role}
            </div>
          </div>
          <button
            className="btn btn-sm btn-outline"
            onClick={handleLogout}
            title="Sign out"
            style={{ padding: '5px 10px', fontSize: 15 }}
          >
            ↩
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

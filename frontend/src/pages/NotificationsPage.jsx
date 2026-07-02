import React, { useEffect, useState } from 'react';
import { getNotifications, markRead, markAllRead } from '../api/client';

const TYPE_ICONS = {
  task_assigned: '✅',
  task_updated: '🔄',
  task_overdue: '⚠️',
  group_joined: '🤝',
  assignment_posted: '📋',
  submission_made: '📤',
  group_assigned: '🔗',
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getNotifications()
      .then(r => setNotifications(r.data))
      .finally(() => setLoading(false));
  }, []);

  const handleMarkRead = async (n) => {
    if (n.is_read) return;
    await markRead(n.id);
    setNotifications(notifications.map(x => x.id === n.id ? { ...x, is_read: true } : x));
  };

  const handleMarkAll = async () => {
    await markAllRead();
    setNotifications(notifications.map(n => ({ ...n, is_read: true })));
  };

  const unread = notifications.filter(n => !n.is_read).length;

  if (loading) return <div className="text-muted">Loading notifications…</div>;

  return (
    <div>
      <div className="row-between page-header">
        <div>
          <h1>Notifications</h1>
          <p>{unread} unread</p>
        </div>
        {unread > 0 && (
          <button className="btn btn-outline btn-sm" onClick={handleMarkAll}>
            ✓ Mark all as read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🔔</div>
          <p>No notifications yet. They'll appear here as things happen.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {notifications.map(n => (
            <div
              key={n.id}
              className={`notif-item ${n.is_read ? 'read' : 'unread'}`}
              onClick={() => handleMarkRead(n)}
            >
              <div style={{ fontSize: 20, flexShrink: 0, marginTop: 2 }}>
                {TYPE_ICONS[n.notification_type] || '🔔'}
              </div>
              <div style={{ flex: 1 }}>
                <div className="notif-title">{n.title}</div>
                <div className="notif-msg">{n.message}</div>
                <div className="notif-time">{timeAgo(n.created_at)}</div>
              </div>
              {!n.is_read && <div className="notif-dot" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

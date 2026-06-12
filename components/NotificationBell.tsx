'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, LockOpen } from '@/components/Icons';
import { getToken } from '@/lib/auth-storage';

interface Notification {
  id: string;
  examId: string;
  examTitle: string;
  subject: string;
  decryptedBy: string;
  decryptedByRole: string;
  message: string;
  createdAt: string;
  read: boolean;
}

interface NotificationBellProps {
  onNewNotification?: (message: string) => void;
  variant?: 'light' | 'dark';
  badgeBorder?: string;
}

export default function NotificationBell({ onNewNotification, variant = 'light', badgeBorder }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const initialLoadRef = useRef(true);

  const authFetch = useCallback(async (url: string, options?: RequestInit) => {
    const token = getToken();
    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options?.headers,
      },
    });
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await authFetch('/api/notifications');
      if (!res.ok) return;

      const data = await res.json();
      const items: Notification[] = data.notifications || [];
      setNotifications(items);
      setUnreadCount(data.unreadCount || 0);

      if (!initialLoadRef.current) {
        for (const item of items) {
          if (!item.read && !knownIdsRef.current.has(item.id)) {
            onNewNotification?.(item.message);
          }
        }
      }

      knownIdsRef.current = new Set(items.map(item => item.id));
      initialLoadRef.current = false;
    } catch {
      // ignore polling errors
    }
  }, [authFetch, onNewNotification]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markRead = async (ids: string[]) => {
    setLoading(true);
    try {
      const res = await authFetch('/api/notifications', {
        method: 'PATCH',
        body: JSON.stringify({ ids }),
      });
      if (res.ok) {
        await fetchNotifications();
      }
    } finally {
      setLoading(false);
    }
  };

  const markAllRead = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/notifications', {
        method: 'PATCH',
        body: JSON.stringify({ markAll: true }),
      });
      if (res.ok) {
        await fetchNotifications();
      }
    } finally {
      setLoading(false);
    }
  };

  const isDark = variant === 'dark';

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen(prev => !prev)}
        className={isDark ? `navbar-bell${open ? ' is-open' : ''}` : undefined}
        style={isDark ? undefined : {
          position: 'relative',
          width: 38,
          height: 38,
          borderRadius: 10,
          border: '1px solid var(--border)',
          background: open ? '#eef2f7' : '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'background 0.2s ease',
        }}
      >
        <Bell size={18} color={isDark ? '#f8fafc' : 'var(--navy)'} />
        {unreadCount > 0 && (
          <span
            className={isDark ? 'navbar-bell-badge' : undefined}
            style={isDark ? (badgeBorder ? { borderColor: badgeBorder } : undefined) : {
            position: 'absolute',
            top: -4,
            right: -4,
            minWidth: 18,
            height: 18,
            padding: '0 5px',
            borderRadius: 99,
            background: '#dc2626',
            color: '#fff',
            fontSize: 10,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid #fff',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 10px)',
          right: 0,
          width: 360,
          maxHeight: 420,
          overflow: 'hidden',
          background: '#fff',
          border: '1px solid var(--border)',
          borderRadius: 12,
          boxShadow: 'var(--shadow-lg)',
          zIndex: 100,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px',
            borderBottom: '1px solid var(--border)',
          }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>Notifications</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
              </div>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={loading}
                onClick={markAllRead}
                style={{ fontSize: 11, padding: '4px 8px' }}
              >
                Mark all read
              </button>
            )}
          </div>

          <div style={{ maxHeight: 340, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                No notifications yet. You will be alerted when an exam paper is decrypted.
              </div>
            ) : (
              notifications.map(notification => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => !notification.read && markRead([notification.id])}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '14px 16px',
                    border: 'none',
                    borderBottom: '1px solid var(--border)',
                    background: notification.read ? '#fff' : '#f0fdf4',
                    cursor: notification.read ? 'default' : 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: '#dcfce7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <LockOpen size={15} color="#16a34a" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>
                          Exam Decrypted
                        </span>
                        {!notification.read && (
                          <span style={{
                            width: 7,
                            height: 7,
                            borderRadius: '50%',
                            background: '#16a34a',
                            flexShrink: 0,
                          }} />
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5, marginBottom: 6 }}>
                        {notification.message}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                        {notification.subject} · {new Date(notification.createdAt).toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

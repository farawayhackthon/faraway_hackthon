'use client';

import { useRouter } from 'next/navigation';
import { LockShield, Shield, Key, Pen, LogOut } from '@/components/Icons';
import NotificationBell from '@/components/NotificationBell';
import { clearAuth } from '@/lib/auth-storage';
import { getNavbarRoleClass, getRoleTheme } from '@/lib/role-theme';
import React from 'react';

interface NavbarProps {
  user: { name: string; role: string } | null;
  onNotification?: (message: string) => void;
}

const ROLE_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  admin:       { label: 'Exam Board Administrator', icon: <Shield size={14} color="rgba(255,255,255,0.85)" /> },
  center_head: { label: 'Center Head',              icon: <Key size={14} color="rgba(255,255,255,0.85)" /> },
  invigilator: { label: 'Invigilator',              icon: <Pen size={14} color="rgba(255,255,255,0.85)" /> },
};

export default function Navbar({ user, onNotification }: NavbarProps) {
  const router = useRouter();
  const roleInfo = user ? ROLE_LABELS[user.role] : null;
  const roleClass = getNavbarRoleClass(user?.role);
  const theme = getRoleTheme(user?.role);

  return (
    <nav className={`navbar ${roleClass}`} aria-label="Main navigation">
      <div className="navbar-inner">
        <div className="navbar-brand">
          <div className="navbar-brand-mark" aria-hidden="true">
            <LockShield size={24} color="#ffffff" />
          </div>
          <div className="navbar-brand-text">
            <span className="navbar-brand-title">Secure-Exam Portal</span>
            <span className="navbar-brand-subtitle">Secure Exam Access</span>
          </div>
        </div>

        <div className="navbar-actions">
          {user?.role === 'admin' && (
            <NotificationBell variant="dark" badgeBorder={theme.badgeBorder} onNewNotification={onNotification} />
          )}

          {user && roleInfo && (
            <div className="navbar-user">
              <div className="navbar-user-meta">
                <div className="navbar-user-name">{user.name}</div>
                <div className="navbar-role-badge">
                  {roleInfo.icon}
                  {roleInfo.label}
                </div>
              </div>
              <div className="navbar-avatar" aria-hidden="true">
                {user.name.charAt(0).toUpperCase()}
              </div>
            </div>
          )}

          <div className="navbar-divider" aria-hidden="true" />

          <button
            id="btn-logout"
            type="button"
            className="navbar-signout"
            onClick={() => { clearAuth(); router.push('/'); }}
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </div>
    </nav>
  );
}

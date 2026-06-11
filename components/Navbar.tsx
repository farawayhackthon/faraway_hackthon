'use client';
import { useRouter } from 'next/navigation';
import { LockShield, Shield, Key, Pen, LogOut } from '@/components/Icons';
import React from 'react';

interface NavbarProps {
  user: { name: string; role: string } | null;
}

const ROLE_LABELS: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  admin:        { label: 'Admin',        color: '#1e3a5f', bg: '#e8eef6', icon: <Shield size={13} color="#1e3a5f" /> },
  center_head:  { label: 'Center Head',  color: '#1e588a', bg: '#e6f1fa', icon: <Key size={13} color="#1e588a" /> },
  invigilator:  { label: 'Invigilator',  color: '#15713a', bg: '#e7f5ee', icon: <Pen size={13} color="#15713a" /> },
};

export default function Navbar({ user }: NavbarProps) {
  const router = useRouter();
  const roleInfo = user ? ROLE_LABELS[user.role] : null;

  return (
    <nav className="navbar">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: 1200, margin: '0 auto' }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: '#eef2f7',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <LockShield size={18} color="var(--navy)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{
              fontSize: 15,
              fontWeight: 700,
              color: 'var(--navy)',
              letterSpacing: '-0.02em',
            }}>
              SecureExam
            </span>
            <span style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.08em',
              color: 'var(--text-3)',
              textTransform: 'uppercase' as const,
              padding: '2px 8px',
              background: '#f1f5f9',
              borderRadius: 4,
              border: '1px solid var(--border)',
            }}>
              Anti-Leak
            </span>
          </div>
        </div>

        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {user && roleInfo && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', lineHeight: 1.2, letterSpacing: '-0.01em' }}>{user.name}</div>
                <div style={{ fontSize: 11, color: roleInfo.color, fontWeight: 600, marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                  {roleInfo.icon} {roleInfo.label}
                </div>
              </div>
              <div style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: roleInfo.bg,
                border: `1px solid var(--border)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 15,
                fontWeight: 700,
                color: roleInfo.color,
              }}>
                {user.name.charAt(0).toUpperCase()}
              </div>
            </div>
          )}

          {/* Divider */}
          <div style={{ width: 1, height: 24, background: 'var(--border)' }} />

          <button
            id="btn-logout"
            className="btn btn-ghost btn-sm"
            onClick={() => { localStorage.clear(); router.push('/'); }}
            style={{ gap: 6 }}
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </div>
    </nav>
  );
}

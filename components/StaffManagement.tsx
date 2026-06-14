'use client';

import { useState } from 'react';
import { CheckCircle, Key, Pen, ScanFace, UserPlus } from '@/components/Icons';

export interface StaffUser {
  id: string;
  name: string;
  username: string;
  role: string;
  centerId?: string;
  faceEnrolled: boolean;
  faceEnrolledAt?: string | null;
}

const EMPTY_STAFF = {
  name: '',
  username: '',
  password: '',
  role: 'center_head' as 'center_head' | 'invigilator',
  centerId: 'center-001',
};

interface StaffManagementProps {
  users: StaffUser[];
  authFetch: (url: string, opts?: RequestInit) => Promise<Response>;
  onUpdated: () => void;
  onToast: (type: 'success' | 'error', text: string) => void;
}

export default function StaffManagement({ users, authFetch, onUpdated, onToast }: StaffManagementProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_STAFF);
  const [saving, setSaving] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);

  const staff = users.filter(u => u.role === 'center_head' || u.role === 'invigilator');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await authFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        onToast('success', data.message);
        setForm(EMPTY_STAFF);
        setOpen(false);
        onUpdated();
      } else {
        onToast('error', data.error || 'Failed to create staff member');
      }
    } catch {
      onToast('error', 'Network error');
    } finally {
      setSaving(false);
    }
  };

  const handleResetFace = async (userId: string, name: string) => {
    if (!confirm(`Reset face profile for ${name}? They will need to re-enroll before decrypting exams.`)) return;
    setResettingId(userId);
    try {
      const res = await authFetch('/api/users', {
        method: 'PATCH',
        body: JSON.stringify({ userId, action: 'reset_face' }),
      });
      const data = await res.json();
      if (res.ok) {
        onToast('success', data.message);
        onUpdated();
      } else {
        onToast('error', data.error || 'Failed to reset face profile');
      }
    } catch {
      onToast('error', 'Network error');
    } finally {
      setResettingId(null);
    }
  };

  const roleLabel = (role: string) => role === 'center_head' ? 'Center Head' : 'Invigilator';

  return (
    <div className="card anim-fade-up" style={{ padding: 24, marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: '#eef2f7', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <UserPlus size={18} color="var(--navy)" />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>Staff Management</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
              Add center heads and invigilators. Each staff member must enroll their face before decrypting exam papers.
            </div>
          </div>
        </div>
        <button type="button" className="btn btn-primary" style={{ height: 38, fontSize: 12 }} onClick={() => setOpen(v => !v)}>
          {open ? '✕ Close' : <><UserPlus size={14} /> Add Staff</>}
        </button>
      </div>

      {open && (
        <form onSubmit={handleCreate} style={{ marginBottom: 24, padding: 20, borderRadius: 10, background: '#f8fafc', border: '1px solid var(--border)' }}>
          <div className="form-row-2col">
            <div>
              <label className="field-label" htmlFor="staff-name">Full Name *</label>
              <input id="staff-name" className="input" placeholder="e.g. Prof. Anita Sharma" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div>
              <label className="field-label" htmlFor="staff-username">Username *</label>
              <input id="staff-username" className="input" placeholder="e.g. anita.sharma" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value.toLowerCase() }))} required />
            </div>
          </div>
          <div className="form-row-3col">
            <div>
              <label className="field-label" htmlFor="staff-password">Password *</label>
              <input id="staff-password" className="input" type="password" placeholder="Min. 6 characters" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required minLength={6} />
            </div>
            <div>
              <label className="field-label" htmlFor="staff-role">Role *</label>
              <select id="staff-role" className="input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as 'center_head' | 'invigilator' }))}>
                <option value="center_head">Center Head</option>
                <option value="invigilator">Invigilator</option>
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="staff-center">Center ID</label>
              <input id="staff-center" className="input" placeholder="center-001" value={form.centerId} onChange={e => setForm(f => ({ ...f, centerId: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" className="btn btn-success" disabled={saving} style={{ height: 40 }}>
              {saving ? <><span className="spinner" /> Creating…</> : 'Create Staff Member'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => { setOpen(false); setForm(EMPTY_STAFF); }}>Cancel</button>
          </div>
        </form>
      )}

      {staff.length === 0 ? (
        <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
          No center staff yet. Add a Center Head and Invigilator to assign exams.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {staff.map(member => (
            <div
              key={member.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                borderRadius: 10, border: '1px solid var(--border)', background: '#fff',
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                background: member.role === 'center_head' ? '#eef2f7' : '#ecfdf5',
                border: `1px solid ${member.role === 'center_head' ? 'var(--border)' : 'rgba(22,163,74,0.15)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {member.role === 'center_head' ? <Key size={16} color="var(--navy)" /> : <Pen size={16} color="#16a34a" />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>{member.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                  @{member.username} · {roleLabel(member.role)} · {member.centerId ?? 'center-001'}
                </div>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 99, flexShrink: 0,
                background: member.faceEnrolled ? '#f0fdf4' : '#fff7ed',
                color: member.faceEnrolled ? 'var(--green)' : '#d97706',
                border: `1px solid ${member.faceEnrolled ? 'rgba(22,163,74,0.15)' : '#fed7aa'}`,
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
                {member.faceEnrolled ? <CheckCircle size={12} /> : <ScanFace size={12} />}
                {member.faceEnrolled ? 'Face enrolled' : 'Face pending'}
              </span>
              {member.faceEnrolled && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ height: 34, fontSize: 11, flexShrink: 0 }}
                  disabled={resettingId === member.id}
                  onClick={() => handleResetFace(member.id, member.name)}
                >
                  {resettingId === member.id ? <span className="spinner spinner-sm" /> : 'Reset Face'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="alert alert-info" style={{ marginTop: 16, marginBottom: 0 }}>
        <span className="alert-icon"><ScanFace size={16} /></span>
        <span style={{ fontSize: 12, lineHeight: 1.5 }}>
          After creating staff, they log in at the portal and enroll their face under <strong>Verify Face &amp; Release Exam Paper</strong> before exam day.
        </span>
      </div>
    </div>
  );
}

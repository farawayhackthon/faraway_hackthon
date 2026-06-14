'use client';

import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { Clipboard, ArrowLeft, Download, Filter, CheckCircle, Key, Pen, ScanFace, LockOpen, Upload, XCircle, Printer } from '@/components/Icons';
import { getRole, getToken, getUser } from '@/lib/auth-storage';
import { AUDIT_EVENT_LABELS, type AuditEventType } from '@/lib/audit-types';

interface AuditEntry {
  id: string;
  examId?: string;
  examTitle?: string;
  event: AuditEventType;
  actorId: string;
  actorName: string;
  actorRole: string;
  message: string;
  metadata?: Record<string, string | number | boolean>;
  createdAt: string;
}

interface ExamOption {
  id: string;
  title: string;
  subject: string;
  status: string;
  isReleased: boolean;
}

const EVENT_ICONS: Record<AuditEventType, ReactNode> = {
  exam_uploaded: <Upload size={14} color="#2563eb" />,
  signature_center_head: <Key size={14} color="#16a34a" />,
  signature_invigilator: <Pen size={14} color="#16a34a" />,
  face_enrolled: <ScanFace size={14} color="#2563eb" />,
  face_verified: <ScanFace size={14} color="#16a34a" />,
  face_verification_failed: <XCircle size={14} color="#dc2626" />,
  exam_decrypted: <LockOpen size={14} color="#16a34a" />,
  exam_viewed: <Clipboard size={14} color="#64748b" />,
  exam_printed: <Printer size={14} color="#d97706" />,
};

export default function AdminAuditPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; role: string } | null>(null);
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [exams, setExams] = useState<ExamOption[]>([]);
  const [filterExamId, setFilterExamId] = useState('');
  const [loading, setLoading] = useState(true);

  const authFetch = useCallback((url: string) => {
    const t = getToken();
    return fetch(url, { headers: { Authorization: `Bearer ${t}` } });
  }, []);

  const fetchLogs = useCallback(async (examId?: string) => {
    const qs = examId ? `?examId=${encodeURIComponent(examId)}` : '';
    const res = await authFetch(`/api/audit${qs}`);
    if (res.ok) {
      const data = await res.json();
      setLogs(data.logs || []);
      setExams(data.exams || []);
    }
    setLoading(false);
  }, [authFetch]);

  useEffect(() => {
    const t = getToken();
    const r = getRole();
    const u = getUser();
    if (!t || r !== 'admin') { router.push('/'); return; }
    if (u) setTimeout(() => setUser(u), 0);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLogs();
  }, [router, fetchLogs]);

  const handleFilter = (examId: string) => {
    setFilterExamId(examId);
    setLoading(true);
    fetchLogs(examId || undefined);
  };

  const exportCsv = () => {
    const header = ['Time', 'Event', 'Exam', 'Actor', 'Role', 'Message', 'Trace ID'];
    const rows = logs.map(l => [
      new Date(l.createdAt).toISOString(),
      AUDIT_EVENT_LABELS[l.event],
      l.examTitle ?? '',
      l.actorName,
      l.actorRole,
      l.message.replace(/"/g, '""'),
      String(l.metadata?.traceId ?? ''),
    ]);
    const csv = [header, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page-bg" style={{ minHeight: '100vh' }}>
      <Navbar user={user} />

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
        <div className="anim-fade-up dashboard-header">
          <div>
            <Link href="/admin" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-3)', marginBottom: 10, textDecoration: 'none' }}>
              <ArrowLeft size={14} /> Back to Dashboard
            </Link>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)', marginBottom: 4 }}>Audit Log</h1>
            <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
              Immutable timeline of uploads, signatures, face verification, and paper release events.
            </p>
          </div>
          <div className="dashboard-header-actions">
            <button type="button" className="btn btn-ghost" onClick={exportCsv} disabled={logs.length === 0}>
              <Download size={14} /> Export CSV
            </button>
          </div>
        </div>

        <div className="card filter-card">
          <Filter size={16} color="var(--text-3)" />
          <label htmlFor="audit-filter" className="field-label" style={{ marginBottom: 0, whiteSpace: 'nowrap' }}>Filter by exam</label>
          <select
            id="audit-filter"
            className="input"
            style={{ maxWidth: 420 }}
            value={filterExamId}
            onChange={e => handleFilter(e.target.value)}
          >
            <option value="">All exams</option>
            {exams.map(e => (
              <option key={e.id} value={e.id}>
                {e.title} {e.isReleased ? '(released)' : `(${e.status})`}
              </option>
            ))}
          </select>
          <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 'auto' }}>{logs.length} event(s)</span>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 80, gap: 12, color: 'var(--text-3)' }}>
            <span className="spinner" /> Loading audit log…
          </div>
        ) : logs.length === 0 ? (
          <div className="card" style={{ padding: 64, textAlign: 'center', color: 'var(--text-3)' }}>
            No audit events yet. Upload an exam or run a demo to generate activity.
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {logs.map((entry, i) => (
                <div
                  key={entry.id}
                  style={{
                    display: 'flex',
                    gap: 16,
                    padding: '16px 20px',
                    borderBottom: i < logs.length - 1 ? '1px solid var(--border)' : undefined,
                    background: entry.event === 'face_verification_failed' ? '#fef2f2' : '#fff',
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                    background: '#f8fafc', border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {EVENT_ICONS[entry.event]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>
                        {AUDIT_EVENT_LABELS[entry.event]}
                      </span>
                      {entry.examTitle && (
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: '#eef2f7', color: 'var(--text-2)' }}>
                          {entry.examTitle}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 6 }}>{entry.message}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                      <span>{entry.actorName} · {entry.actorRole}</span>
                      <span className="mono">{new Date(entry.createdAt).toLocaleString('en-IN')}</span>
                      {entry.metadata?.traceId != null && (
                        <span className="mono" style={{ color: '#991b1b' }}>Trace: {String(entry.metadata.traceId)}</span>
                      )}
                    </div>
                  </div>
                  {entry.event !== 'face_verification_failed' && (
                    <CheckCircle size={16} color="var(--green)" style={{ flexShrink: 0, marginTop: 4, opacity: 0.5 }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

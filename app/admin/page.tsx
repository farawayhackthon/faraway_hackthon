'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import ExamCard from '@/components/ExamCard';
import StaffManagement, { type StaffUser } from '@/components/StaffManagement';
import { Clipboard, Clock, Zap, CheckCircle, XCircle, Flask, LockShield, Inbox, Upload } from '@/components/Icons';
import { getRole, getToken, getUser } from '@/lib/auth-storage';
import ExamFilterTabs from '@/components/ExamFilterTabs';

type User = StaffUser;
interface Exam {
  id: string; title: string; subject: string; examTime: string;
  status: string; minutesUntilExam: number; windowOpen: boolean; expired: boolean;
  signatures: { centerHead: boolean; invigilator: boolean };
  centerHeadName: string; invigilatorName: string; uploadedByName: string;
  originalFilename?: string;
}

const EMPTY_FORM = { title: '', subject: '', examTime: '', centerHeadId: '', invigilatorId: '', content: '', filename: 'exam-paper.txt' };

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; role: string } | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const showToast = (type: 'success' | 'error' | 'info', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 5000);
  };

  const authFetch = useCallback((url: string, opts?: RequestInit) => {
    const t = getToken();
    return fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}`, ...opts?.headers } });
  }, []);

  const fetchUsers = useCallback(async () => {
    const res = await authFetch('/api/users');
    if (res.ok) { const d = await res.json(); setUsers(d.users || []); }
  }, [authFetch]);

  const fetchExams = useCallback(async () => {
    const res = await authFetch('/api/exam/list');
    if (res.ok) { const d = await res.json(); setExams(d.exams || []); }
  }, [authFetch]);

  useEffect(() => {
    const t = getToken();
    const u = getUser();
    const r = getRole();
    if (!t || r !== 'admin') { router.push('/'); return; }
    if (u) setTimeout(() => setUser(u), 0);

    authFetch('/api/users').then(r => r.json()).then(d => setUsers(d.users || [])).catch(() => {});
    authFetch('/api/exam/list').then(r => r.json()).then(d => { setExams(d.exams || []); setLoading(false); }).catch(() => setLoading(false));

    const iv = setInterval(fetchExams, 30_000);
    return () => clearInterval(iv);
  }, [router, authFetch, fetchExams]);

  const centerHeads  = users.filter(u => u.role === 'center_head');
  const invigilators = users.filter(u => u.role === 'invigilator');

  const minExamTime = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset() + 11); return d.toISOString().slice(0, 16); };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadLoading(true);
    try {
      const payload = { ...form, examTime: new Date(form.examTime).toISOString() };
      const res = await authFetch('/api/exam/upload', { method: 'POST', body: JSON.stringify(payload) });
      const d = await res.json();
      if (res.ok) { 
        showToast('success', d.message); 
        setUploadOpen(false); 
        setForm(EMPTY_FORM); 
        fetchExams(); 
        const fileInput = document.getElementById('file-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      }
      else showToast('error', d.error);
    } catch { showToast('error', 'Network error. Please try again.'); }
    finally { setUploadLoading(false); }
  };

  const handleDemo = async () => {
    setDemoLoading(true);
    try {
      const res = await authFetch('/api/exam/demo', { method: 'POST', body: JSON.stringify({ minutesFromNow: 4 }) });
      const d = await res.json();
      if (res.ok) { showToast('success', d.message); fetchExams(); }
      else showToast('error', d.error);
    } catch { showToast('error', 'Network error.'); }
    finally { setDemoLoading(false); }
  };

  const handleFileRead = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setForm(f => ({ ...f, filename: file.name }));
    const reader = new FileReader();
    reader.onload = ev => setForm(f => ({ ...f, content: ev.target?.result as string || '' }));
    if (file.type.includes('pdf') || file.type.includes('image') || file.name.match(/\.(pdf|doc|docx|png|jpg|jpeg)$/i)) {
      reader.readAsDataURL(file);
    } else {
      reader.readAsText(file);
    }
  };

  const statIcons = [
    <Clipboard key="clipboard" size={18} color="#2563eb" />,
    <Zap key="zap" size={18} color="#06b6d4" />,
    <Clock key="clock" size={18} color="#8b5cf6" />,
    <CheckCircle key="check" size={18} color="#16a34a" />,
  ];

  const statIconBgs = ['#eef2f7', '#ecf9ff', '#f3e8ff', '#f0fdf4'];

  const stats = [
    { label: 'Total',      value: exams.length,                                          color: '#2563eb' },
    { label: 'Active',     value: exams.filter(e => !e.expired).length,                  color: '#06b6d4' },
    { label: 'Expired',    value: exams.filter(e => e.expired).length,                   color: '#8b5cf6' },
    { label: 'Decrypted',  value: exams.filter(e => e.status === 'decrypted').length,    color: '#16a34a' },
  ];

  return (
    <div className="page-bg" style={{ minHeight: '100vh' }}>
      <Navbar
        user={user}
        onNotification={(message) => {
          showToast('info', message);
          fetchExams();
        }}
      />

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 96, right: 24, zIndex: 99, maxWidth: 400,
          padding: '14px 18px', borderRadius: 8, fontSize: 13, lineHeight: 1.5,
          display: 'flex', alignItems: 'center', gap: 8,
          background: '#fff',
          borderLeft: toast.type === 'success' ? '3px solid #16a34a' : toast.type === 'info' ? '3px solid #2563eb' : '3px solid #dc2626',
          color: toast.type === 'success' ? '#166534' : toast.type === 'info' ? '#1e40af' : '#991b1b',
          boxShadow: 'var(--shadow-lg)',
          animation: 'fadeUp 0.3s ease-out'
        }}>
          {toast.type === 'success'
            ? <CheckCircle size={16} color="#16a34a" />
            : toast.type === 'info'
            ? <LockShield size={16} color="#2563eb" />
            : <XCircle size={16} color="#dc2626" />}
          {toast.text}
        </div>
      )}

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>

        {/* Page header */}
        <div className="anim-fade-up dashboard-header">
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)', marginBottom: 4, letterSpacing: '-0.02em' }}>Admin Dashboard</h1>
            <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Manage exam papers, encryption, and personnel assignment</p>
          </div>
          <div className="dashboard-header-actions">
            <Link href="/admin/audit" className="btn btn-ghost" style={{ textDecoration: 'none' }}>
              <Clipboard size={15} /> Audit Log
            </Link>
            <button id="btn-demo-exam" onClick={handleDemo} disabled={demoLoading} className="btn btn-ghost">
              {demoLoading ? <><span className="spinner spinner-sm" /> Creating…</> : <><Flask size={15} /> Quick Demo</>}
            </button>
            <button id="btn-upload-exam" onClick={() => { setUploadOpen(!uploadOpen); }} className="btn btn-primary">
              {uploadOpen ? '✕  Close' : <><Upload size={15} /> Upload Exam</>}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="anim-fade-up anim-delay-1 stats-grid">
          {stats.map((s, i) => (
            <div key={i} className="stat-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: statIconBgs[i], display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {statIcons[i]}
                </div>
                <span style={{ fontSize: 26, fontWeight: 700, color: s.color, letterSpacing: '-0.03em' }}>{s.value}</span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Staff Management */}
        <StaffManagement
          users={users}
          authFetch={authFetch}
          onUpdated={fetchUsers}
          onToast={showToast}
        />

        {/* Upload Panel */}
        {uploadOpen && (
          <div className="card anim-fade-up" style={{ padding: 28, marginBottom: 28, borderColor: 'var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: '#eef2f7', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <LockShield size={18} color="var(--navy)" />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>Upload &amp; Encrypt Exam Paper</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>Content is encrypted with AES-256-GCM. Key is time-locked until T−5 min.</div>
              </div>
            </div>

            <form onSubmit={handleUpload}>
              <div className="form-row-2col">
                <div>
                  <label className="field-label" htmlFor="exam-title">Exam Title *</label>
                  <input id="exam-title" className="input" placeholder="e.g. Advanced Mathematics — Paper 1" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
                </div>
                <div>
                  <label className="field-label" htmlFor="exam-subject">Subject *</label>
                  <input id="exam-subject" className="input" placeholder="e.g. Mathematics" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} required />
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label className="field-label" htmlFor="exam-time">Exam Date &amp; Time * (minimum 10 min from now)</label>
                <input id="exam-time" className="input" type="datetime-local" min={minExamTime()} value={form.examTime} onChange={e => setForm(f => ({ ...f, examTime: e.target.value }))} required />
              </div>

              <div className="form-row-2col">
                <div>
                  <label className="field-label" htmlFor="center-head-select">Assign Center Head *</label>
                  <select id="center-head-select" className="input" value={form.centerHeadId} onChange={e => setForm(f => ({ ...f, centerHeadId: e.target.value }))} required>
                    <option value="">— Select —</option>
                    {centerHeads.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label" htmlFor="invigilator-select">Assign Invigilator *</label>
                  <select id="invigilator-select" className="input" value={form.invigilatorId} onChange={e => setForm(f => ({ ...f, invigilatorId: e.target.value }))} required>
                    <option value="">— Select —</option>
                    {invigilators.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label className="field-label">Upload file (txt / pdf) — optional</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <label htmlFor="file-upload" className="btn btn-ghost" style={{ cursor: 'pointer', margin: 0 }}>
                    <Upload size={15} /> Choose File
                  </label>
                  <input id="file-upload" type="file" accept=".txt,.pdf,.doc,.docx" onChange={handleFileRead} style={{ display: 'none' }} />
                  <span style={{ fontSize: 13, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '250px' }}>
                    {form.filename !== 'exam-paper.txt' ? form.filename : 'No file chosen'}
                  </span>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 5 }}>Binary files (PDFs, images) are securely converted to encrypted blobs.</p>
              </div>

              <div style={{ marginBottom: 24 }}>
                <label className="field-label" htmlFor="exam-content">Exam Paper Content * (paste or upload above)</label>
                <textarea id="exam-content" className="input" style={{ minHeight: 180 }} placeholder="Paste exam questions here…" value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} required />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button id="btn-encrypt-upload" type="submit" className="btn btn-primary" disabled={uploadLoading}>
                  {uploadLoading ? <><span className="spinner" /> Encrypting…</> : <><LockShield size={15} /> Encrypt & Store Securely</>}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setUploadOpen(false)}>Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Exam list */}
        <div className="anim-fade-up anim-delay-2">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div>
                <span className="exam-section-heading">
                  {showHistory ? 'Expired Exams' : 'Active Exams'}
                </span>
                <span style={{ marginLeft: 8, fontSize: 14, color: 'var(--text-3)' }}>
                  {showHistory ? exams.filter(e => e.expired).length : exams.filter(e => !e.expired).length} total
                </span>
              </div>
            </div>
            <ExamFilterTabs
              role={user?.role ?? 'admin'}
              showExpired={showHistory}
              onShowActive={() => setShowHistory(false)}
              onShowExpired={() => setShowHistory(true)}
            />
          </div>

          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '80px 0', color: 'var(--text-3)' }}>
              <span className="spinner" style={{ borderColor: '#e2e8f0', borderTopColor: 'var(--blue)' }} /> Loading exams…
            </div>
          ) : (showHistory ? exams.filter(e => e.expired) : exams.filter(e => !e.expired)).length === 0 ? (
            <div className="card" style={{ padding: '64px 24px', textAlign: 'center' }}>
              <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
                <Inbox size={40} color="var(--text-3)" />
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>
                {showHistory ? 'No expired exams' : 'No active exams'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
                {showHistory 
                  ? 'Expired exams will appear here.' 
                  : 'Click "Upload Exam" or "Quick Demo" to get started.'}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(showHistory ? exams.filter(e => e.expired) : exams.filter(e => !e.expired)).map((exam, i) => <ExamCard key={exam.id} exam={exam} role="admin" index={i} />)}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

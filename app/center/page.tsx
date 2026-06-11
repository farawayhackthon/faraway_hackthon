'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import CountdownTimer from '@/components/CountdownTimer';
import SignaturePanel from '@/components/SignaturePanel';
import { Key, Pen, Zap, CheckCircle, Ban, Clock, Inbox, ArrowLeft, Document, Clipboard, LockOpen, AlertTriangle, XCircle, Download, Printer } from '@/components/Icons';

interface Exam {
  id: string; title: string; subject: string; examTime: string;
  status: string; minutesUntilExam: number; windowOpen: boolean; expired: boolean;
  signatures: { centerHead: boolean; centerHeadAt?: string; invigilator: boolean; invigilatorAt?: string };
  centerHeadName: string; invigilatorName: string;
  originalFilename?: string; decryptedContent?: string;
}

interface UserInfo { id: string; name: string; role: 'center_head' | 'invigilator'; username: string; }

export default function CenterPage() {
  const router = useRouter();
  const paperRef = useRef<HTMLDivElement>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [signingId, setSigningId] = useState<string | null>(null);
  const [decryptingId, setDecryptingId] = useState<string | null>(null);
  const [decryptedContent, setDecryptedContent] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const [auditLog, setAuditLog] = useState<Record<string, string> | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const authFetch = useCallback(async (url: string, options?: RequestInit) => {
    const t = localStorage.getItem('token') || '';
    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${t}`,
        ...options?.headers,
      },
    });
  }, []);

  const fetchExams = useCallback(async () => {
    try {
      const res = await authFetch('/api/exam/list');
      if (res.ok) {
        const data = await res.json();
        setExams(data.exams || []);
        // Update selected exam if viewing one
        if (selectedExam) {
          const updated = data.exams.find((e: Exam) => e.id === selectedExam.id);
          if (updated) setSelectedExam(updated);
        }
      }
    } catch (e) { console.error(e); }
  }, [authFetch, selectedExam]);

  useEffect(() => {
    const t = localStorage.getItem('token');
    const u = localStorage.getItem('user');
    const r = localStorage.getItem('role');
    if (!t || !u || r === 'admin') {
      router.push('/');
      return;
    }
    const parsedUser = JSON.parse(u) as UserInfo;
    setUser(parsedUser);

    authFetch('/api/exam/list')
      .then(r => r.json())
      .then(d => { setExams(d.exams || []); setLoading(false); })
      .catch(() => setLoading(false));

    const interval = setInterval(fetchExams, 15000); // Poll every 15s
    return () => clearInterval(interval);
  }, [router, authFetch, fetchExams]);

  const handleSign = async (examId: string) => {
    setSigningId(examId);
    setMessage(null);
    try {
      const res = await authFetch('/api/exam/sign', {
        method: 'POST',
        body: JSON.stringify({ examId }),
      });
      const data = await res.json();

      if (res.ok) {
        setMessage({ type: 'success', text: data.message });
        await fetchExams();
        // Update selected exam
        const updated = exams.find(e => e.id === examId);
        if (updated) setSelectedExam({ ...updated, signatures: data.signatures });
      } else {
        setMessage({ type: data.locked ? 'warning' : 'error', text: data.error });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setSigningId(null);
    }
  };

  const handleDecrypt = async (examId: string) => {
    setDecryptingId(examId);
    setMessage(null);
    setDecryptedContent(null);
    try {
      const res = await authFetch('/api/exam/decrypt', {
        method: 'POST',
        body: JSON.stringify({ examId }),
      });
      const data = await res.json();

      if (res.ok) {
        setDecryptedContent(data.content);
        setAuditLog(data.auditLog);
        setMessage({ type: 'success', text: 'Exam paper decrypted successfully! All security conditions verified.' });
        await fetchExams();
      } else {
        setMessage({
          type: data.locked ? 'warning' : 'error',
          text: data.error,
        });
      }
    } catch {
      setMessage({ type: 'error', text: 'Decryption failed. Please try again.' });
    } finally {
      setDecryptingId(null);
    }
  };

  const handleDownloadPDF = async () => {
    if (!paperRef.current || !selectedExam) return;
    
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const element = paperRef.current;
      const filename = `${selectedExam.subject.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      
      const options = {
        margin: 10,
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' }
      };
      
      html2pdf().set(options).from(element).save();
      setMessage({ type: 'success', text: 'PDF downloaded successfully!' });
    } catch (error) {
      console.error('PDF download error:', error);
      setMessage({ type: 'error', text: 'Failed to generate PDF. Please try again.' });
    }
  };

  const handlePrint = () => {
    if (!paperRef.current) return;
    
    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        setMessage({ type: 'error', text: 'Failed to open print dialog. Please check your popup settings.' });
        return;
      }
      
      const content = paperRef.current.innerHTML;
      printWindow.document.write(`
        <html>
          <head>
            <title>${selectedExam?.subject || 'Exam Paper'}</title>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; margin: 20px; }
              h2, h3 { color: #333; }
              pre { background: #f4f4f4; padding: 10px; border-radius: 4px; overflow-x: auto; }
              .meta-info { color: #666; font-size: 0.9em; margin: 10px 0; }
            </style>
          </head>
          <body>
            <h2>${selectedExam?.title || 'Exam Paper'}</h2>
            <p class="meta-info">Subject: ${selectedExam?.subject}</p>
            <p class="meta-info">Date: ${new Date().toLocaleString()}</p>
            <hr />
            ${content}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    } catch (error) {
      console.error('Print error:', error);
      setMessage({ type: 'error', text: 'Failed to open print dialog. Please try again.' });
    }
  };

  const myRole = user?.role;

  const getMySignatureStatus = (exam: Exam) => {
    if (myRole === 'center_head') return exam.signatures.centerHead;
    if (myRole === 'invigilator') return exam.signatures.invigilator;
    return false;
  };

  const canSign = (exam: Exam) => exam.windowOpen && !exam.expired && !getMySignatureStatus(exam);
  const canDecrypt = (exam: Exam) =>
    exam.windowOpen && !exam.expired &&
    exam.signatures.centerHead && exam.signatures.invigilator &&
    exam.status !== 'decrypted';

  const statusBadgeClass = (status: string) => {
    switch (status) {
      case 'window_open': return 'badge badge-amber';
      case 'decrypted':   return 'badge badge-green';
      case 'expired':     return 'badge badge-red';
      default:            return 'badge badge-gray';
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'window_open': return 'Window Open';
      case 'decrypted':   return 'Decrypted';
      case 'expired':     return 'Expired';
      default:            return 'Scheduled';
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'window_open': return <Zap size={14} />;
      case 'decrypted':   return <CheckCircle size={14} />;
      case 'expired':     return <Ban size={14} />;
      default:            return <Clock size={14} />;
    }
  };

  const statusDotColor = (status: string) => {
    switch (status) {
      case 'window_open': return '#d97706';
      case 'decrypted':   return '#16a34a';
      case 'expired':     return '#dc2626';
      default:            return '#64748b';
    }
  };

  // Filter exams into active and archived
  const activeExams = exams.filter(e => !e.expired);
  const archivedExams = exams.filter(e => e.expired);
  const displayExams = showHistory ? archivedExams : activeExams;

  return (
    <div className="page-bg" style={{ minHeight: '100vh' }}>
      <Navbar user={user} />

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>

        {/* Page Header */}
        <div className="anim-fade-up" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: myRole === 'center_head' ? '#eef2f7' : '#ecfdf5', border: `1px solid ${myRole === 'center_head' ? '#d5dae2' : 'rgba(22,163,74,0.15)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {myRole === 'center_head' ? <Key size={20} color="var(--navy)" /> : <Pen size={20} color="#16a34a" />}
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)', marginBottom: 4, letterSpacing: '-0.02em' }}>
                {myRole === 'center_head' ? 'Center Head Portal' : 'Invigilator Portal'}
              </h1>
              <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
                {myRole === 'center_head'
                  ? 'Provide Signature 1 to authorize exam decryption within the time window'
                  : 'Provide Signature 2 to complete multi-signature exam decryption'}
              </p>
            </div>
          </div>
          <button onClick={fetchExams} className="btn btn-ghost btn-sm" style={{ flexShrink: 0 }}>↻ Refresh</button>
        </div>

        {/* Message / Alert */}
        {message && (
          <div
            className={`alert ${message.type === 'success' ? 'alert-success' : message.type === 'warning' ? 'alert-warning' : 'alert-error'} anim-fade-up`}
            style={{ marginBottom: 24 }}
          >
            <span className="alert-icon">
              {message.type === 'success' ? <CheckCircle size={16} /> : message.type === 'warning' ? <AlertTriangle size={16} /> : <XCircle size={16} />}
            </span>
            <span>{message.text}</span>
          </div>
        )}

        {/* Two-column layout: Exam List + Detail Panel */}
        <div className="anim-fade-up anim-delay-1" style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 24, alignItems: 'start' }}>

          {/* ── Left: Exam List ── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 8 }}>
              <span className="section-label">
                {showHistory ? `History (${archivedExams.length})` : `Active Exams (${activeExams.length})`}
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={() => setShowHistory(false)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 4,
                    border: 'none',
                    background: !showHistory ? '#2563eb' : 'transparent',
                    color: !showHistory ? 'white' : 'var(--text-3)',
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: 600,
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => !showHistory && (e.currentTarget.style.background = '#1d4ed8')}
                  onMouseLeave={(e) => !showHistory && (e.currentTarget.style.background = '#2563eb')}
                >
                  Active
                </button>
                <button
                  onClick={() => setShowHistory(true)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 4,
                    border: 'none',
                    background: showHistory ? '#7c3aed' : 'transparent',
                    color: showHistory ? 'white' : 'var(--text-3)',
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: 600,
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => showHistory && (e.currentTarget.style.background = '#6d28d9')}
                  onMouseLeave={(e) => showHistory && (e.currentTarget.style.background = '#7c3aed')}
                >
                  History
                </button>
              </div>
            </div>

            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '80px 0', color: 'var(--text-3)' }}>
                <span className="spinner" style={{ borderColor: 'rgba(37,99,235,0.2)', borderTopColor: '#2563eb' }} /> Loading…
              </div>
            ) : displayExams.length === 0 ? (
              <div className="card" style={{ padding: '64px 24px', textAlign: 'center' }}>
                <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
                  <Inbox size={40} color="var(--text-3)" />
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>
                  {showHistory ? 'No exam history' : 'No active exams'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
                  {showHistory ? 'Expired exams will appear here.' : 'Active exams will appear here.'}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {displayExams.map((exam) => {
                  const signed = getMySignatureStatus(exam);
                  const isSelected = selectedExam?.id === exam.id;
                  return (
                    <button
                      key={exam.id}
                      onClick={() => {
                        setSelectedExam(exam);
                        setDecryptedContent(exam.decryptedContent || null);
                        setMessage(null);
                        setAuditLog(null);
                      }}
                      className={`exam-list-item ${isSelected ? 'card-selected' : ''}`}
                      style={{ display: 'block' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', lineHeight: 1.3 }}>{exam.title}</span>
                        <div style={{
                          width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 5,
                          background: statusDotColor(exam.status),
                        }} />
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>{exam.subject}</div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span className="mono" style={{ fontSize: 11, color: 'var(--text-4)' }}>
                          {new Date(exam.examTime).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {signed && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#16a34a', fontWeight: 600 }}>
                            <span className="sig-dot sig-dot-signed" /> Signed
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Right: Detail Panel ── */}
          <div>
            {!selectedExam ? (
              <div className="card" style={{ padding: '80px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
                  <ArrowLeft size={48} color="var(--text-3)" />
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>Select an Exam</div>
                <div style={{ fontSize: 13, color: 'var(--text-3)', maxWidth: 300 }}>Click on an exam from the list to view details and provide your signature.</div>
              </div>
            ) : (
              <div className="anim-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Exam Header Card */}
                <div className="card" style={{ padding: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 20 }}>
                    <div>
                      <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)', marginBottom: 4, letterSpacing: '-0.01em' }}>{selectedExam.title}</h2>
                      <p style={{ fontSize: 13, color: 'var(--text-2)' }}>{selectedExam.subject}</p>
                    </div>
                    <span className={statusBadgeClass(selectedExam.status)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      {statusIcon(selectedExam.status)}
                      {statusLabel(selectedExam.status)}
                    </span>
                  </div>

                  <div className="divider" style={{ marginBottom: 16 }} />

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                    <div>
                      <span className="section-label" style={{ display: 'block', marginBottom: 6 }}>Exam Time</span>
                      <span style={{ fontSize: 13, color: 'var(--text-1)' }}>{new Date(selectedExam.examTime).toLocaleString('en-IN')}</span>
                    </div>
                    <div>
                      <span className="section-label" style={{ display: 'block', marginBottom: 6 }}>Center Head</span>
                      <span style={{ fontSize: 13, color: 'var(--text-1)' }}>{selectedExam.centerHeadName}</span>
                    </div>
                    <div>
                      <span className="section-label" style={{ display: 'block', marginBottom: 6 }}>Invigilator</span>
                      <span style={{ fontSize: 13, color: 'var(--text-1)' }}>{selectedExam.invigilatorName}</span>
                    </div>
                  </div>
                </div>

                {/* Countdown */}
                <CountdownTimer examTime={selectedExam.examTime} />

                {/* Signature Panel */}
                <SignaturePanel
                  exam={selectedExam}
                  myRole={myRole || ''}
                  canSign={canSign(selectedExam)}
                  canDecrypt={canDecrypt(selectedExam)}
                  signing={signingId === selectedExam.id}
                  decrypting={decryptingId === selectedExam.id}
                  onSign={() => handleSign(selectedExam.id)}
                  onDecrypt={() => handleDecrypt(selectedExam.id)}
                />

                {/* Decrypted Paper */}
                {(decryptedContent || selectedExam.decryptedContent) && (
                  <div className="card card-glow-green anim-fade-up" style={{ padding: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: '#f0fdf4', border: '1px solid rgba(22,163,74,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Document size={18} color="#16a34a" />
                        </div>
                        <div>
                          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--green)' }}>Exam Paper — Decrypted</h3>
                          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                            {selectedExam.originalFilename} · For official use only
                          </p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={handleDownloadPDF}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '8px 12px',
                            borderRadius: 6,
                            border: '1px solid rgba(22,163,74,0.2)',
                            background: '#f0fdf4',
                            cursor: 'pointer',
                            fontSize: 12,
                            fontWeight: 600,
                            color: '#16a34a',
                            transition: 'all 0.2s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#dcfce7';
                            e.currentTarget.style.borderColor = 'rgba(22,163,74,0.4)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#f0fdf4';
                            e.currentTarget.style.borderColor = 'rgba(22,163,74,0.2)';
                          }}
                        >
                          <Download size={14} />
                          PDF
                        </button>
                        <button
                          onClick={handlePrint}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '8px 12px',
                            borderRadius: 6,
                            border: '1px solid rgba(22,163,74,0.2)',
                            background: '#f0fdf4',
                            cursor: 'pointer',
                            fontSize: 12,
                            fontWeight: 600,
                            color: '#16a34a',
                            transition: 'all 0.2s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#dcfce7';
                            e.currentTarget.style.borderColor = 'rgba(22,163,74,0.4)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#f0fdf4';
                            e.currentTarget.style.borderColor = 'rgba(22,163,74,0.2)';
                          }}
                        >
                          <Printer size={14} />
                          Print
                        </button>
                      </div>
                    </div>

                    {auditLog && (
                      <div className="alert alert-info" style={{ marginBottom: 16 }}>
                        <span className="alert-icon"><Clipboard size={16} /></span>
                        <div className="mono" style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span>Audit Trail:</span>
                          {auditLog.centerHeadSignedAt && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Key size={12} /> CH Signed: {new Date(auditLog.centerHeadSignedAt).toLocaleString()}</span>}
                          {auditLog.invigilatorSignedAt && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Pen size={12} /> Inv Signed: {new Date(auditLog.invigilatorSignedAt).toLocaleString()}</span>}
                          {auditLog.decryptedAt && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><LockOpen size={12} /> Decrypted: {new Date(auditLog.decryptedAt).toLocaleString()}</span>}
                        </div>
                      </div>
                    )}

                    <div className="paper-view" ref={paperRef}>
                      {decryptedContent || selectedExam.decryptedContent}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

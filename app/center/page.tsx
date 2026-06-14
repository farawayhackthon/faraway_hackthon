'use client';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import CountdownTimer from '@/components/CountdownTimer';
import SignaturePanel from '@/components/SignaturePanel';
import FaceVerificationModal from '@/components/FaceVerificationModal';
import WatermarkedPaper from '@/components/WatermarkedPaper';
import { Key, Pen, Zap, CheckCircle, Ban, Clock, Inbox, ArrowLeft, Clipboard, LockOpen, AlertTriangle, XCircle, Download, Printer, ScanFace } from '@/components/Icons';
import { getRole, getToken, getUser } from '@/lib/auth-storage';
import { buildWatermarkMeta, buildWatermarkedPrintHtml, escapeHtml as wmEscapeHtml } from '@/lib/watermark';
import ExamFilterTabs from '@/components/ExamFilterTabs';

interface Exam {
  id: string; title: string; subject: string; examTime: string;
  status: string; minutesUntilExam: number; windowOpen: boolean; expired: boolean;
  signatures: { centerHead: boolean; centerHeadAt?: string; invigilator: boolean; invigilatorAt?: string };
  centerHeadName: string; invigilatorName: string;
  originalFilename?: string; decryptedContent?: string;
  isReleased?: boolean;
  releaseAudit?: {
    decryptedAt: string;
    decryptedBy: string;
    decryptedByRole: string;
    faceVerifiedAt: string;
    traceId: string;
    centerId?: string;
  } | null;
  printCount?: number;
}

interface UserInfo { id: string; name: string; role: 'center_head' | 'invigilator'; username: string; centerId?: string; }

async function dataURLtoBlob(dataurl: string): Promise<Blob | null> {
  try {
    const res = await fetch(dataurl);
    return await res.blob();
  } catch {
    return null;
  }
}

function isPdfContent(content: string) {
  return content.startsWith('data:application/pdf');
}

function isImageContent(content: string) {
  return content.startsWith('data:image/');
}

function isDataUrl(content: string) {
  return content.startsWith('data:');
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default function CenterPage() {
  const router = useRouter();
  const paperSectionRef = useRef<HTMLDivElement>(null);
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
  const [faceEnrolled, setFaceEnrolled] = useState(false);
  const [faceModalOpen, setFaceModalOpen] = useState(false);
  const [faceModalMode, setFaceModalMode] = useState<'enroll' | 'verify'>('enroll');
  const [pendingDecryptExamId, setPendingDecryptExamId] = useState<string | null>(null);
  const selectedExamIdRef = useRef<string | null>(null);

  const authFetch = useCallback(async (url: string, options?: RequestInit) => {
    const t = getToken();
    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${t}`,
        ...options?.headers,
      },
    });
  }, []);

  const fetchFaceStatus = useCallback(async () => {
    try {
      const res = await authFetch('/api/user/face');
      if (res.ok) {
        const data = await res.json();
        setFaceEnrolled(Boolean(data.enrolled));
      }
    } catch (e) { console.error(e); }
  }, [authFetch]);

  useEffect(() => {
    selectedExamIdRef.current = selectedExam?.id ?? null;
  }, [selectedExam?.id]);

  const buildAuditFromExam = useCallback((exam: Exam, apiAudit?: Record<string, string> | null) => {
    const ra = exam.releaseAudit;
    if (apiAudit) return apiAudit;
    if (!ra && !exam.signatures.centerHead) return null;
    const log: Record<string, string> = {};
    if (exam.signatures.centerHeadAt) log.centerHeadSignedAt = exam.signatures.centerHeadAt;
    if (exam.signatures.invigilatorAt) log.invigilatorSignedAt = exam.signatures.invigilatorAt;
    if (ra?.faceVerifiedAt) log.faceVerifiedAt = ra.faceVerifiedAt;
    if (ra?.decryptedBy) log.faceVerifiedUser = ra.decryptedBy;
    if (ra?.decryptedAt) log.decryptedAt = ra.decryptedAt;
    if (ra?.traceId) log.traceId = ra.traceId;
    return Object.keys(log).length ? log : null;
  }, []);

  const loadReleasedPaper = useCallback(async (exam: Exam) => {
    try {
      const res = await authFetch('/api/exam/decrypt', {
        method: 'POST',
        body: JSON.stringify({ examId: exam.id }),
      });
      const data = await res.json();
      if (res.ok && data.content) {
        setDecryptedContent(data.content);
        setAuditLog(buildAuditFromExam(exam, data.auditLog));
        setSelectedExam(prev => prev?.id === exam.id
          ? { ...prev, ...exam, decryptedContent: data.content, status: 'decrypted', releaseAudit: data.releaseAudit ?? exam.releaseAudit }
          : prev);
      }
    } catch (e) {
      console.error(e);
    }
  }, [authFetch, buildAuditFromExam]);

  const fetchExams = useCallback(async () => {
    try {
      const res = await authFetch('/api/exam/list');
      if (!res.ok) return;
      const data = await res.json();
      const nextExams: Exam[] = data.exams || [];
      setExams(nextExams);

      const selectedId = selectedExamIdRef.current;
      if (!selectedId) return;

      const updated = nextExams.find((e: Exam) => e.id === selectedId);
      if (!updated) return;

      setSelectedExam(prev => {
        if (!prev || prev.id !== selectedId) return updated;
        return {
          ...updated,
          decryptedContent: updated.decryptedContent ?? prev.decryptedContent,
          releaseAudit: updated.releaseAudit ?? prev.releaseAudit,
          isReleased: updated.isReleased ?? prev.isReleased,
        };
      });
      if (updated.decryptedContent) {
        setDecryptedContent(updated.decryptedContent);
      }
    } catch (e) { console.error(e); }
  }, [authFetch]);

  useEffect(() => {
    const t = getToken();
    const parsedUser = getUser<UserInfo>();
    const r = getRole();
    if (!t || !parsedUser || r === 'admin') {
      router.push('/');
      return;
    }
    setTimeout(() => setUser(parsedUser), 0);

    authFetch('/api/exam/list')
      .then(r => r.json())
      .then(d => setTimeout(() => { setExams(d.exams || []); setLoading(false); }, 0))
      .catch(() => setTimeout(() => setLoading(false), 0));

    setTimeout(() => fetchFaceStatus(), 0);
  }, [router, authFetch, fetchFaceStatus]);

  useEffect(() => {
    const interval = setInterval(fetchExams, 5000);
    return () => clearInterval(interval);
  }, [fetchExams]);

  const openFaceVerification = useCallback(async (examId: string) => {
    try {
      const res = await authFetch('/api/user/face');
      if (res.ok) {
        const data = await res.json();
        const enrolled = Boolean(data.enrolled);
        setFaceEnrolled(enrolled);
        setPendingDecryptExamId(examId);
        setFaceModalMode(enrolled ? 'verify' : 'enroll');
        setFaceModalOpen(true);
        return;
      }
    } catch (e) { console.error(e); }
    setPendingDecryptExamId(examId);
    setFaceModalMode(faceEnrolled ? 'verify' : 'enroll');
    setFaceModalOpen(true);
  }, [authFetch, faceEnrolled]);

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
        const bothSigned = data.bothSigned;
        setMessage({
          type: 'success',
          text: bothSigned
            ? 'Both signatures collected. Please verify your face to release the exam paper.'
            : data.message,
        });
        await fetchExams();
        setSelectedExam(prev => prev?.id === examId
          ? { ...prev, signatures: data.signatures, status: bothSigned ? 'ready_to_decrypt' : prev.status }
          : prev);

        if (bothSigned) {
          openFaceVerification(examId);
        }
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
    const exam = exams.find(e => e.id === examId) ?? (selectedExam?.id === examId ? selectedExam : null);
    if (!exam) return;
    if (exam.isReleased || exam.status === 'decrypted') {
      await loadReleasedPaper(exam);
      setMessage({ type: 'success', text: 'Exam paper loaded. Scroll down to view.' });
      setTimeout(() => paperSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
      return;
    }
    await openFaceVerification(examId);
  };

  const performDecrypt = async (examId: string, faceVerificationToken?: string) => {
    setDecryptingId(examId);
    setMessage(null);
    try {
      const res = await authFetch('/api/exam/decrypt', {
        method: 'POST',
        body: JSON.stringify({
          examId,
          ...(faceVerificationToken ? { faceVerificationToken } : {}),
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setDecryptedContent(data.content);
        setAuditLog(data.auditLog ?? null);
        setSelectedExam(prev => prev?.id === examId
          ? {
            ...prev,
            decryptedContent: data.content,
            status: 'decrypted',
            isReleased: true,
            releaseAudit: data.releaseAudit ?? prev.releaseAudit,
          }
          : prev);
        setMessage({ type: 'success', text: 'Exam paper released! Scroll down to view the watermarked paper.' });
        await fetchExams();
        setTimeout(() => paperSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
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
      setPendingDecryptExamId(null);
    }
  };

  const getContent = () => decryptedContent || selectedExam?.decryptedContent || '';

  const watermarkMeta = useMemo(() => {
    if (!selectedExam || !user) return null;
    const ra = selectedExam.releaseAudit;
    return buildWatermarkMeta({
      examId: selectedExam.id,
      examTitle: selectedExam.title,
      subject: selectedExam.subject,
      centerId: ra?.centerId ?? user.centerId,
      releasedBy: auditLog?.faceVerifiedUser ?? ra?.decryptedBy ?? user.name,
      releasedByRole: ra?.decryptedByRole ?? (user.role === 'center_head' ? 'Center Head' : 'Invigilator'),
      releasedAt: auditLog?.decryptedAt ?? ra?.decryptedAt ?? auditLog?.faceVerifiedAt,
    });
  }, [selectedExam, user, auditLog]);

  const logPrintAction = async (examId: string, actionType: 'print' | 'pdf_download') => {
    try {
      const res = await authFetch('/api/exam/print-audit', {
        method: 'POST',
        body: JSON.stringify({ examId, actionType }),
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedExam(prev => prev && prev.id === examId ? { ...prev, printCount: data.printCount } : prev);
        setExams(prev => prev.map(e => e.id === examId ? { ...e, printCount: data.printCount } : e));
      }
    } catch (e) {
      console.error('Failed to log print action:', e);
    }
  };

  const handleDownloadPDF = async () => {
    if (!selectedExam) return;

    await logPrintAction(selectedExam.id, 'pdf_download');

    const contentStr = getContent();
    if (!contentStr) {
      setMessage({ type: 'error', text: 'No decrypted content available to download.' });
      return;
    }

    const defaultName = selectedExam.originalFilename || `${selectedExam.subject.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}`;
    const userName = prompt('Enter file name:', defaultName);
    if (userName === null) return;

    let finalName = userName.trim() || defaultName;

    if (isDataUrl(contentStr)) {
      try {
        const blob = await dataURLtoBlob(contentStr);
        if (!blob) throw new Error('Invalid data URL');
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        if (!finalName.includes('.')) {
          finalName += isPdfContent(contentStr) ? '.pdf' : isImageContent(contentStr) ? '.png' : '';
        }
        a.download = finalName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
        setMessage({ type: 'success', text: 'Document downloaded successfully!' });
      } catch (error) {
        console.error('Download error:', error);
        setMessage({ type: 'error', text: 'Failed to download document.' });
      }
      return;
    }

    try {
      const html2pdfModule = await import('html2pdf.js');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const html2pdf = (html2pdfModule as any).default || html2pdfModule;

      const bodyHtml = `<pre style="white-space:pre-wrap;font-family:Arial,sans-serif;font-size:14px;line-height:1.7;margin:0">${wmEscapeHtml(contentStr)}</pre>`;
      const wrapper = document.createElement('div');
      wrapper.innerHTML = watermarkMeta
        ? buildWatermarkedPrintHtml(bodyHtml, watermarkMeta, selectedExam.title)
        : bodyHtml;
      document.body.appendChild(wrapper);

      if (!finalName.toLowerCase().endsWith('.pdf')) finalName += '.pdf';

      await html2pdf()
        .set({
          margin: 10,
          filename: finalName,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' },
        })
        .from(wrapper.querySelector('.wm-page') ?? wrapper)
        .save();

      document.body.removeChild(wrapper);
      setMessage({ type: 'success', text: 'Watermarked PDF downloaded successfully!' });
    } catch (error) {
      console.error('PDF download error:', error);
      setMessage({ type: 'error', text: 'Failed to generate PDF. Please try again.' });
    }
  };

  const printFromIframe = (html: string, title: string, cleanup?: () => void) => {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      cleanup?.();
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (e) {
        console.error(e);
        setMessage({ type: 'error', text: 'Failed to print. Please try again.' });
      } finally {
        setTimeout(() => {
          if (document.body.contains(iframe)) document.body.removeChild(iframe);
          cleanup?.();
        }, 1000);
      }
    }, 500);
  };

  const handlePrint = async () => {
    if (!selectedExam) return;

    await logPrintAction(selectedExam.id, 'print');

    const contentStr = getContent();
    if (!contentStr) {
      setMessage({ type: 'error', text: 'No decrypted content available to print.' });
      return;
    }

    if (isPdfContent(contentStr)) {
      try {
        const blob = await dataURLtoBlob(contentStr);
        if (!blob) throw new Error('Invalid data URL');
        const blobUrl = URL.createObjectURL(blob);

        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
        iframe.src = blobUrl;
        document.body.appendChild(iframe);

        iframe.onload = () => {
          setTimeout(() => {
            try {
              iframe.contentWindow?.focus();
              iframe.contentWindow?.print();
            } catch (e) {
              console.error(e);
              setMessage({ type: 'error', text: 'Failed to print document.' });
            } finally {
              setTimeout(() => {
                if (document.body.contains(iframe)) document.body.removeChild(iframe);
                URL.revokeObjectURL(blobUrl);
              }, 1000);
            }
          }, 500);
        };
      } catch (error) {
        console.error('Print error:', error);
        setMessage({ type: 'error', text: 'Failed to print document.' });
      }
      return;
    }

    if (isImageContent(contentStr)) {
      const imgHtml = `<div style="text-align:center"><img src="${contentStr}" alt="Exam Paper" style="max-width:100%" /></div>`;
      printFromIframe(
        watermarkMeta
          ? buildWatermarkedPrintHtml(imgHtml, watermarkMeta, selectedExam.subject)
          : `<html><head><title>${escapeHtml(selectedExam.subject)}</title></head><body style="margin:20px;text-align:center"><img src="${contentStr}" alt="Exam Paper" style="max-width:100%" /></body></html>`,
        selectedExam.subject,
      );
      return;
    }

    const bodyContent = isDataUrl(contentStr)
      ? `<p>Binary document — use the PDF button to download.</p>`
      : `<pre style="white-space:pre-wrap;font-family:Arial,sans-serif;font-size:14px;line-height:1.7;margin:0">${escapeHtml(contentStr)}</pre>`;

    printFromIframe(
      watermarkMeta
        ? buildWatermarkedPrintHtml(bodyContent, watermarkMeta, selectedExam.subject)
        : `<html>
        <head>
          <title>${escapeHtml(selectedExam.subject)}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; margin: 20px; color: #111; }
            h2 { color: #333; margin-bottom: 8px; }
            .meta-info { color: #666; font-size: 0.9em; margin: 4px 0; }
          </style>
        </head>
        <body>
          <h2>${escapeHtml(selectedExam.title)}</h2>
          <p class="meta-info">Subject: ${escapeHtml(selectedExam.subject)}</p>
          <p class="meta-info">Date: ${new Date().toLocaleString()}</p>
          <hr />
          ${bodyContent}
        </body>
      </html>`,
      selectedExam.subject,
    );
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
    !exam.isReleased && exam.status !== 'decrypted';

  const statusBadgeClass = (status: string) => {
    switch (status) {
      case 'window_open': return 'badge badge-amber';
      case 'ready_to_decrypt': return 'badge badge-amber';
      case 'decrypted':   return 'badge badge-green';
      case 'expired':     return 'badge badge-red';
      default:            return 'badge badge-gray';
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'window_open': return 'Window Open';
      case 'ready_to_decrypt': return 'Awaiting Face Verify';
      case 'decrypted':   return 'Decrypted';
      case 'expired':     return 'Expired';
      default:            return 'Scheduled';
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'window_open': return <Zap size={14} />;
      case 'ready_to_decrypt': return <ScanFace size={14} />;
      case 'decrypted':   return <CheckCircle size={14} />;
      case 'expired':     return <Ban size={14} />;
      default:            return <Clock size={14} />;
    }
  };

  const statusDotColor = (status: string) => {
    switch (status) {
      case 'window_open': return '#d97706';
      case 'ready_to_decrypt': return '#2563eb';
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
        <div className="anim-fade-up" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 24 }}>
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
        </div>

        {/* Face Enrollment Card */}
        {!faceEnrolled && (
          <div className="anim-fade-up" style={{ marginBottom: 24 }}>
            <div
              className="card"
              style={{
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                border: '1px solid rgba(234,179,8,0.3)',
                background: 'rgba(234,179,8,0.03)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: '#fffbeb',
                  border: '1px solid rgba(234,179,8,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <ScanFace size={18} color="#d97706" />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', marginBottom: 2 }}>
                    Face Registration Required
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.4 }}>
                    Register your face now to avoid delays during exam decryption.
                  </div>
                </div>
              </div>
              <button
                id="btn-face-enroll"
                type="button"
                className="btn btn-primary"
                style={{ height: 38, fontSize: 12, padding: '0 16px', whiteSpace: 'nowrap', flexShrink: 0 }}
                onClick={() => {
                  setFaceModalMode('enroll');
                  setPendingDecryptExamId(null);
                  setFaceModalOpen(true);
                }}
              >
                <ScanFace size={14} />
                &nbsp;Register Face Now
              </button>
            </div>
          </div>
        )}

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
              <span className="exam-section-heading">
                {showHistory ? `Expired Exams (${archivedExams.length})` : `Active Exams (${activeExams.length})`}
              </span>
              <ExamFilterTabs
                role={myRole}
                showExpired={showHistory}
                onShowActive={() => setShowHistory(false)}
                onShowExpired={() => setShowHistory(true)}
              />
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
                  {showHistory ? 'No expired exams' : 'No active exams'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.6 }}>
                  {showHistory
                    ? 'Expired exams will appear here.'
                    : 'Ask the Exam Board admin to click "Create Live Demo Exam" on the admin dashboard. Then both Center Head and Invigilator must sign, verify face, and release the paper.'}
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
                        setDecryptedContent(null);
                        setMessage(null);
                        setAuditLog(buildAuditFromExam(exam));
                        if (exam.isReleased || exam.status === 'decrypted') {
                          loadReleasedPaper(exam);
                        }
                      }}
                      className={`exam-list-item ${isSelected ? 'card-selected' : ''}`}
                      style={{ display: 'block' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                        <span className="exam-list-title">{exam.title}</span>
                        <div style={{
                          width: 10, height: 10, borderRadius: '50%', flexShrink: 0, marginTop: 6,
                          background: statusDotColor(exam.status),
                        }} />
                      </div>
                      <div className="exam-list-subject">{exam.subject}</div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span className="mono exam-list-meta">
                          {new Date(exam.examTime).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {signed && (
                          <span className="exam-list-signed">
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
                <CountdownTimer
                  examTime={selectedExam.examTime}
                  decrypted={selectedExam.status === 'decrypted' || selectedExam.isReleased || Boolean(decryptedContent)}
                />

                {/* Signature Panel */}
                <SignaturePanel
                  exam={{ ...selectedExam, isReleased: selectedExam.isReleased || Boolean(decryptedContent) }}
                  myRole={myRole || ''}
                  canSign={canSign(selectedExam)}
                  canDecrypt={canDecrypt(selectedExam)}
                  signing={signingId === selectedExam.id}
                  decrypting={decryptingId === selectedExam.id}
                  onSign={() => handleSign(selectedExam.id)}
                  onDecrypt={() => handleDecrypt(selectedExam.id)}
                />

                {/* Waiting for face verification */}
                {canDecrypt(selectedExam) && !selectedExam.isReleased && (
                  <div className="card" style={{ padding: 32, textAlign: 'center', borderStyle: 'dashed' }}>
                    <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
                      <ScanFace size={40} color="var(--text-3)" />
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>
                      Exam paper locked
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-3)', maxWidth: 360, margin: '0 auto 16px' }}>
                      Both signatures are complete. Click &quot;Verify Face &amp; Release Exam Paper&quot; above — the decrypted paper will appear here.
                    </div>
                    <button type="button" onClick={() => handleDecrypt(selectedExam.id)} className="btn btn-primary" style={{ height: 40, fontSize: 13 }}>
                      <ScanFace size={14} /> Verify Face Now
                    </button>
                  </div>
                )}

                {(selectedExam.isReleased || selectedExam.status === 'decrypted') && !getContent() && (
                  <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)' }}>
                    <span className="spinner" style={{ marginRight: 10 }} /> Loading released exam paper…
                  </div>
                )}

                {(decryptedContent || selectedExam.isReleased || selectedExam.status === 'decrypted') && getContent() && watermarkMeta && (
                  <div ref={paperSectionRef} className="card card-glow-green anim-fade-up" style={{ padding: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: '#f0fdf4', border: '1px solid rgba(22,163,74,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <LockOpen size={18} color="#16a34a" />
                        </div>
                        <div>
                          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--green)' }}>Exam Paper — Unlocked</h3>
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
                          {auditLog.faceVerifiedAt && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><ScanFace size={12} /> Face Verified ({auditLog.faceVerifiedUser}): {new Date(auditLog.faceVerifiedAt).toLocaleString()}</span>}
                          {auditLog.decryptedAt && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><LockOpen size={12} /> Decrypted: {new Date(auditLog.decryptedAt).toLocaleString()}</span>}
                          {auditLog.traceId && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>Trace ID: {auditLog.traceId}</span>}
                          {selectedExam.printCount !== undefined && selectedExam.printCount > 0 && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#d97706', marginTop: 4 }}>
                              <Printer size={12} /> Printed/Downloaded {selectedExam.printCount} time{selectedExam.printCount === 1 ? '' : 's'}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {watermarkMeta && (
                      <WatermarkedPaper
                        content={getContent()}
                        meta={watermarkMeta}
                        originalFilename={selectedExam.originalFilename}
                        isPdf={isPdfContent}
                        isImage={isImageContent}
                        isDataUrl={isDataUrl}
                      />
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      <FaceVerificationModal
        open={faceModalOpen}
        mode={faceModalMode}
        examId={pendingDecryptExamId ?? undefined}
        userName={user?.name ?? 'Staff'}
        authFetch={authFetch}
        onClose={() => {
          setFaceModalOpen(false);
          setPendingDecryptExamId(null);
        }}
        onEnrolled={() => {
          setFaceEnrolled(true);
          fetchFaceStatus();
          if (pendingDecryptExamId) {
            // Close modal, then reopen in verify mode so camera reinitializes
            setFaceModalOpen(false);
            setMessage({ type: 'success', text: 'Face enrolled! Now verify your identity to release the exam paper.' });
            setTimeout(() => {
              setFaceModalMode('verify');
              setFaceModalOpen(true);
            }, 600);
          } else {
            setFaceModalOpen(false);
            setMessage({ type: 'success', text: 'Face profile registered successfully. You\'re ready for biometric verification.' });
          }
        }}
        onVerified={(token) => {
          setFaceModalOpen(false);
          if (pendingDecryptExamId) performDecrypt(pendingDecryptExamId, token);
        }}
      />
    </div>
  );
}

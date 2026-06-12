'use client';

import { Document, Ban, Clipboard, Calendar, Clock, Paperclip, LockShield } from '@/components/Icons';

interface Exam {
  id: string; title: string; subject: string; examTime: string;
  status: string; minutesUntilExam: number; windowOpen: boolean; expired: boolean;
  signatures: { centerHead: boolean; invigilator: boolean };
  centerHeadName: string; invigilatorName: string;
  uploadedByName: string; originalFilename?: string;
}

const STATUS: Record<string, { label: string; badge: string; dot: string }> = {
  scheduled:   { label: 'Scheduled',   badge: 'badge-gray',  dot: '#475569' },
  window_open: { label: 'Window Open', badge: 'badge-amber', dot: '#d97706' },
  decrypted:   { label: 'Decrypted',   badge: 'badge-green', dot: '#16a34a' },
  expired:     { label: 'Expired',     badge: 'badge-red',   dot: '#dc2626' },
};

export default function ExamCard({ exam, index }: { exam: Exam; role: string; index: number }) {
  const cfg = STATUS[exam.status] || STATUS.scheduled;
  const sigCount = (exam.signatures.centerHead ? 1 : 0) + (exam.signatures.invigilator ? 1 : 0);

  const timeLabel = () => {
    if (exam.expired) return 'Expired';
    const m = exam.minutesUntilExam;
    if (exam.windowOpen) return m < 0 ? `Started ${Math.abs(Math.round(m))}m ago` : `${Math.round(m)}m until exam`;
    if (m > 60) return `${Math.floor(m / 60)}h ${Math.round(m % 60)}m to go`;
    return `${Math.round(m)}m to go`;
  };

  const iconBg = exam.status === 'decrypted'
    ? '#f0fdf4'
    : exam.status === 'window_open'
    ? '#fff7ed'
    : '#eff6ff';

  const iconBorder = exam.status === 'decrypted'
    ? '#dcfce7'
    : exam.status === 'window_open'
    ? '#fed7aa'
    : '#dbeafe';

  const iconColor = exam.status === 'decrypted'
    ? '#16a34a'
    : exam.status === 'window_open'
    ? '#d97706'
    : '#2563eb';

  return (
    <div
      className="card card-hover anim-fade-up"
      style={{
        padding: '26px 28px',
        animationDelay: `${index * 0.05}s`,
        borderLeft: `3px solid ${cfg.dot}`,
        transition: 'all 0.22s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18 }}>

        {/* Icon column */}
        <div style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: iconBg,
          border: `1px solid ${iconBorder}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          {exam.status === 'decrypted'
            ? <Document size={20} color={iconColor} />
            : exam.status === 'expired'
            ? <Ban size={20} color="#dc2626" />
            : <Clipboard size={20} color={iconColor} />}
        </div>

        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
            <div style={{ minWidth: 0 }}>
              <h3 style={{
                fontSize: 17,
                fontWeight: 600,
                color: 'var(--text-1)',
                marginBottom: 4,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                letterSpacing: '-0.01em',
              }}>
                {exam.title}
              </h3>
              <span style={{ fontSize: 14, color: 'var(--text-3)', fontWeight: 500 }}>{exam.subject}</span>
            </div>
            <span className={`badge ${cfg.badge}`} style={{ flexShrink: 0 }}>
              <span style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: cfg.dot,
                display: 'inline-block',
              }} />
              {cfg.label}
            </span>
          </div>

          {/* Meta row */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px 24px',
            fontSize: 14,
            color: 'var(--text-3)',
            marginBottom: 16,
            padding: '12px 16px',
            background: '#f8fafc',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid #f1f5f9',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Calendar size={14} color="var(--text-3)" />
              {new Date(exam.examTime).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
            <span style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              color: exam.windowOpen ? 'var(--amber)' : 'var(--text-3)',
              fontWeight: exam.windowOpen ? 600 : 400,
            }}>
              <Clock size={14} color={exam.windowOpen ? 'var(--amber)' : 'var(--text-3)'} />
              {timeLabel()}
            </span>
            <span className="mono" style={{ color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Paperclip size={14} color="var(--text-3)" />
              {exam.originalFilename || 'exam-paper.txt'}
            </span>
          </div>

          {/* Bottom row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>

            {/* Sig indicators */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {[
                { label: 'Center Head', signed: exam.signatures.centerHead },
                { label: 'Invigilator', signed: exam.signatures.invigilator },
              ].map(({ label, signed }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  <span className={`sig-dot ${signed ? 'sig-dot-signed' : 'sig-dot-unsigned'}`} />
                  <span style={{ color: signed ? 'var(--green)' : 'var(--text-3)', fontWeight: signed ? 600 : 400 }}>
                    {label}: {signed ? 'Signed' : 'Pending'}
                  </span>
                </div>
              ))}
              <span style={{
                fontSize: 13,
                fontWeight: 600,
                color: sigCount === 2 ? 'var(--green)' : 'var(--text-3)',
                background: sigCount === 2 ? '#f0fdf4' : '#f8fafc',
                padding: '5px 12px',
                borderRadius: 99,
                border: `1px solid ${sigCount === 2 ? '#dcfce7' : 'var(--border)'}`,
              }}>
                {sigCount}/2 sigs
              </span>
            </div>

            {/* Personnel */}
            <div style={{
              fontSize: 13,
              color: 'var(--text-3)',
              textAlign: 'right',
              maxWidth: 240,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {exam.centerHeadName} · {exam.invigilatorName}
            </div>
          </div>
        </div>
      </div>

      {/* Encryption footer */}
      <div style={{
        marginTop: 16,
        paddingTop: 14,
        borderTop: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 11,
        color: 'var(--text-3)',
      }}>
        <LockShield size={14} color="var(--text-3)" />
        <span style={{ letterSpacing: '0.01em' }}>AES-256-GCM encrypted · PBKDF2 key derivation · Time-lock enforced server-side</span>
      </div>
    </div>
  );
}

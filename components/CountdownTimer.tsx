'use client';
import { useState, useEffect } from 'react';
import { Calendar, Ban, LockOpen, Lock } from '@/components/Icons';

interface CountdownTimerProps {
  examTime: string;
}

function pad(n: number) { return String(n).padStart(2, '0'); }

export default function CountdownTimer({ examTime }: CountdownTimerProps) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!now) return null;

  const exam   = new Date(examTime);
  const diffMs = exam.getTime() - now.getTime();
  const diffSec = Math.floor(Math.abs(diffMs) / 1000);

  const hrs  = Math.floor(diffSec / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);
  const secs = diffSec % 60;

  const timeStr = hrs > 0
    ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}`
    : `${pad(mins)}:${pad(secs)}`;

  const isPast    = diffMs < 0;
  const isWindow  = diffMs <= 5 * 60_000 && diffMs >= -30 * 60_000;
  const isExpired = diffMs < -30 * 60_000;

  // Progress: 0 = just uploaded (many hours), 1 = exam time
  const totalWindowMs = 24 * 3600 * 1000;
  const progress = Math.min(1, Math.max(0, 1 - diffMs / totalWindowMs));

  let statusLabel = '';
  let statusColor = 'var(--text-3)';
  let statusBg = '#f8fafc';
  let statusBorder = 'var(--border)';
  if (isExpired) {
    statusLabel = 'Exam window expired';
    statusColor = 'var(--red)';
    statusBg = '#fef2f2';
    statusBorder = '#fecaca';
  } else if (isWindow) {
    statusLabel = isPast ? 'Exam in progress — window open' : 'Signing window is OPEN';
    statusColor = 'var(--amber)';
    statusBg = '#fff7ed';
    statusBorder = '#fed7aa';
  } else {
    statusLabel = `Opens in ${Math.max(0, Math.ceil(diffMs / 60_000) - 5)} min`;
    statusColor = 'var(--text-3)';
    statusBg = '#f8fafc';
    statusBorder = 'var(--border)';
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Top section with countdown */}
      <div style={{ padding: '24px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>

          {/* Left — digits */}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span className="section-label">
                {isExpired ? 'Expired' : isPast ? 'Since start' : 'Time until exam'}
              </span>
            </div>

            <div className={isWindow && !isExpired ? 'countdown-digits-amber' : 'countdown-digits'} style={{ fontSize: 40 }}>
              {isExpired ? 'EXPIRED' : (isPast ? '+' : '−') + timeStr}
            </div>

            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Calendar size={14} color="var(--text-3)" />
              {new Date(examTime).toLocaleString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>

          {/* Right — status indicator */}
          <div style={{
            textAlign: 'center',
            flexShrink: 0,
            padding: '16px 20px',
            borderRadius: 'var(--radius-md)',
            background: statusBg,
            border: `1px solid ${statusBorder}`,
            minWidth: 120,
          }}>
            <div style={{
              fontSize: 32,
              marginBottom: 8,
              display: 'flex',
              justifyContent: 'center',
            }}>
              {isExpired
                ? <Ban size={32} color="var(--red)" />
                : isWindow
                  ? <LockOpen size={32} color="var(--amber)" />
                  : <Lock size={32} color="var(--text-3)" />
              }
            </div>
            <div style={{
              fontSize: 11,
              fontWeight: 700,
              color: statusColor,
              letterSpacing: '0.04em',
              lineHeight: 1.4,
            }}>
              {statusLabel}
            </div>
          </div>
        </div>
      </div>

      {/* Progress bar section */}
      <div style={{
        padding: '16px 28px 20px',
        background: '#f1f5f9',
        borderTop: '1px solid var(--border)',
      }}>
        <div className="progress-bar" style={{ height: 4 }}>
          <div
            className="progress-fill"
            style={{
              width: `${progress * 100}%`,
              background: isWindow
                ? 'linear-gradient(90deg, #d97706, #dc2626)'
                : 'linear-gradient(90deg, #2563eb, #0891b2)',
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10, color: 'var(--text-3)', fontWeight: 500, letterSpacing: '0.02em' }}>
          <span>Uploaded</span>
          <span style={{ color: isWindow ? 'var(--amber)' : 'var(--text-3)' }}>T−5 min window</span>
          <span>Exam start</span>
        </div>
      </div>
    </div>
  );
}

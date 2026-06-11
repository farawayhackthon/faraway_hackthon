'use client';

import { Ban, CheckCircle, Lock, Pen, AlarmClock, LockOpen } from '@/components/Icons';

interface Exam {
  id: string;
  signatures: {
    centerHead: boolean; centerHeadAt?: string;
    invigilator: boolean; invigilatorAt?: string;
  };
  windowOpen: boolean;
  expired: boolean;
  status: string;
}

interface SignaturePanelProps {
  exam: Exam;
  myRole: string;
  canSign: boolean;
  canDecrypt: boolean;
  signing: boolean;
  decrypting: boolean;
  onSign: () => void;
  onDecrypt: () => void;
}

export default function SignaturePanel({
  exam, myRole, canSign, canDecrypt, signing, decrypting, onSign, onDecrypt
}: SignaturePanelProps) {
  const { signatures, windowOpen, expired, status } = exam;
  const bothSigned = signatures.centerHead && signatures.invigilator;
  const mySignature = myRole === 'center_head' ? signatures.centerHead : signatures.invigilator;
  const isDecrypted = status === 'decrypted';

  const gate1Pass = windowOpen && !expired;
  const gate2Pass = bothSigned;

  const SigRow = ({ label, signed, signedAt, num }: { label: string; signed: boolean; signedAt?: string; num: number }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 10, background: signed ? 'rgba(22,163,74,0.04)' : '#fafafa', border: `1px solid ${signed ? 'rgba(22,163,74,0.15)' : 'var(--border)'}`, transition: 'all 0.3s' }}>
      <div className={`step-pill ${signed ? 'step-pill-done' : 'step-pill-idle'}`}>{signed ? '✓' : num}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)', marginBottom: 2 }}>{label}</div>
        {signedAt
          ? <div className="mono" style={{ fontSize: 11, color: 'var(--green)' }}>Signed · {new Date(signedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
          : <div style={{ fontSize: 11, color: 'var(--text-4)' }}>Awaiting signature</div>
        }
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: signed ? '#f0fdf4' : '#f8fafc', color: signed ? 'var(--green)' : 'var(--text-3)', border: `1px solid ${signed ? 'rgba(22,163,74,0.15)' : 'var(--border)'}` }}>
        {signed ? 'SIGNED' : 'PENDING'}
      </span>
    </div>
  );

  return (
    <div className="card" style={{ padding: 24 }}>

      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', marginBottom: 2 }}>Multi-Signature Authorization</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Both signatures required to release exam paper</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 99, background: bothSigned ? '#f0fdf4' : '#f8fafc', color: bothSigned ? 'var(--green)' : 'var(--text-3)', border: `1px solid ${bothSigned ? 'rgba(22,163,74,0.15)' : 'var(--border)'}` }}>
            {(signatures.centerHead ? 1 : 0) + (signatures.invigilator ? 1 : 0)}/2 SIGNED
          </div>
        </div>
      </div>

      {/* Gates */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
        <div className={`gate-box ${gate1Pass ? 'gate-unlocked' : 'gate-locked'}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ display: 'flex', alignItems: 'center' }}>
              {expired ? <Ban size={16} color="var(--red)" /> : gate1Pass ? <CheckCircle size={16} color="var(--green)" /> : <Lock size={16} color="var(--text-3)" />}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: gate1Pass ? 'var(--green)' : 'var(--text-3)', letterSpacing: '0.06em' }}>GATE 1 · TIME LOCK</span>
          </div>
          <p style={{ fontSize: 12, color: gate1Pass ? '#16a34a' : 'var(--text-4)', lineHeight: 1.5 }}>
            {expired ? 'Window expired' : gate1Pass ? 'Window open (T−5 min)' : 'Locked until T−5 minutes'}
          </p>
        </div>

        <div className={`gate-box ${gate2Pass ? 'gate-unlocked' : 'gate-locked'}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ display: 'flex', alignItems: 'center' }}>
              {gate2Pass ? <CheckCircle size={16} color="var(--green)" /> : <Pen size={16} color="var(--text-3)" />}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: gate2Pass ? 'var(--green)' : 'var(--text-3)', letterSpacing: '0.06em' }}>GATE 2 · MULTI-SIG</span>
          </div>
          <p style={{ fontSize: 12, color: gate2Pass ? '#16a34a' : 'var(--text-4)', lineHeight: 1.5 }}>
            {gate2Pass ? 'Both signatures collected' : `${(signatures.centerHead ? 1 : 0) + (signatures.invigilator ? 1 : 0)}/2 signatures`}
          </p>
        </div>
      </div>

      {/* Signature rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        <SigRow label="Signature 1 — Center Head" signed={signatures.centerHead} signedAt={signatures.centerHeadAt} num={1} />
        <SigRow label="Signature 2 — Invigilator" signed={signatures.invigilator} signedAt={signatures.invigilatorAt} num={2} />
      </div>

      {/* Actions */}
      {!isDecrypted && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Sign button */}
          {mySignature ? (
            <div className="alert alert-success">
              <span className="alert-icon"><CheckCircle size={16} color="var(--green)" /></span>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>Your signature has been recorded</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  {!signatures[myRole === 'center_head' ? 'invigilator' : 'centerHead']
                    ? 'Waiting for the other party to sign before decryption can proceed.'
                    : 'Both signatures collected. You can now decrypt the exam paper.'}
                </div>
              </div>
            </div>
          ) : (
            <button
              id={`btn-sign-${myRole}`}
              onClick={onSign}
              disabled={!canSign || signing}
              className="btn btn-success"
              style={{ width: '100%', height: 46, fontSize: 14, position: 'relative' }}
            >
              {signing
                ? <><span className="spinner" /> Recording signature…</>
                : <>
                    <Pen size={16} /> &nbsp;Provide {myRole === 'center_head' ? 'Signature 1 (Center Head)' : 'Signature 2 (Invigilator)'}
                    {!canSign && !expired && <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.7 }}>[Time-locked]</span>}
                  </>
              }
            </button>
          )}

          {/* Decrypt button */}
          <button
            id="btn-decrypt"
            onClick={onDecrypt}
            disabled={!canDecrypt || decrypting}
            className="btn btn-primary"
            style={{ width: '100%', height: 46, fontSize: 14, opacity: (canDecrypt && !decrypting) ? 1 : 0.45 }}
          >
            {decrypting
              ? <><span className="spinner" /> Decrypting…</>
              : <>
                  <LockOpen size={16} /> &nbsp;Decrypt &amp; Release Exam Paper
                  {!bothSigned && <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.7 }}>[Need both sigs]</span>}
                  {bothSigned && !canDecrypt && !expired && <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.7 }}>[Time-locked]</span>}
                </>
            }
          </button>

          {/* Time-lock notice */}
          {!windowOpen && !expired && (
            <div className="alert alert-warning" style={{ marginTop: 4 }}>
              <span className="alert-icon"><AlarmClock size={16} color="var(--amber)" /></span>
              <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                <strong>Time-lock active.</strong> The signing window opens exactly 5 minutes before exam time. Both parties must be present and sign within that window.
              </div>
            </div>
          )}
        </div>
      )}

      {isDecrypted && (
        <div className="alert alert-success">
          <span className="alert-icon"><LockOpen size={16} color="var(--green)" /></span>
          <span>Exam paper has been successfully decrypted. Scroll down to view it.</span>
        </div>
      )}
    </div>
  );
}

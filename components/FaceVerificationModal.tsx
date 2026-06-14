'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { XCircle, CheckCircle, AlertTriangle, ScanFace } from '@/components/Icons';
import {
  extractFaceDescriptor,
  getLastFaceModelError,
  loadFaceModels,
  multiCaptureDescriptors,
  startCamera,
  startLiveDetection,
} from '@/lib/face-client';
import type { FaceDetectionResult, CaptureProgress } from '@/lib/face-client';

type FaceMode = 'enroll' | 'verify';
type ModalPhase = 'loading' | 'ready' | 'capturing' | 'processing' | 'success' | 'error';

interface FaceVerificationModalProps {
  open: boolean;
  mode: FaceMode;
  examId?: string;
  userName: string;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
  onClose: () => void;
  onEnrolled: () => void;
  onVerified: (faceVerificationToken: string) => void;
}

const ENROLL_CAPTURE_COUNT = 3;

export default function FaceVerificationModal({
  open,
  mode,
  examId,
  userName,
  authFetch,
  onClose,
  onEnrolled,
  onVerified,
}: FaceVerificationModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopDetectionRef = useRef<(() => void) | null>(null);

  const [phase, setPhase] = useState<ModalPhase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [faceScore, setFaceScore] = useState(0);
  const [captureProgress, setCaptureProgress] = useState<CaptureProgress | null>(null);
  const [livenessStep, setLivenessStep] = useState<'turn_left' | 'turn_right' | 'passed'>('turn_left');

  /* ─── Stop camera & detection ──────────────────────────────────────────── */
  const stopCamera = useCallback(() => {
    stopDetectionRef.current?.();
    stopDetectionRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  /* ─── Initialize camera + models ───────────────────────────────────────── */
  useEffect(() => {
    if (!open) {
      stopCamera();
      // Reset state on close (in next tick to avoid flicker)
      const t = setTimeout(() => {
        setPhase('loading');
        setError(null);
        setSuccessMsg(null);
        setFaceDetected(false);
        setFaceScore(0);
        setCaptureProgress(null);
        setLivenessStep('turn_left');
      }, 0);
      return () => clearTimeout(t);
    }

    let cancelled = false;

    const init = async () => {
      try {
        setPhase('loading');
        setError(null);
        setSuccessMsg(null);
        setFaceDetected(false);
        setLivenessStep('turn_left');

        await loadFaceModels();
        if (cancelled) return;

        const stream = await startCamera();
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();

          // Start live face detection loop
          const stopDetect = startLiveDetection(
            videoRef.current,
            (result: FaceDetectionResult) => {
              if (!cancelled) {
                setFaceDetected(result.detected);
                setFaceScore(result.score ?? 0);
                if (result.detected && result.yaw !== undefined) {
                  setLivenessStep(prev => {
                    if (prev === 'turn_left' && result.yaw! > 0.15) return 'turn_right';
                    if (prev === 'turn_right' && result.yaw! < -0.15) return 'passed';
                    return prev;
                  });
                }
              }
            },
            350,
          );
          stopDetectionRef.current = stopDetect;
        }

        if (!cancelled) setPhase('ready');
      } catch (err) {
        if (cancelled) return;
        const modelErr = getLastFaceModelError();
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setError(
          modelErr
            ? `Face models failed to load: ${modelErr}. Check your internet connection and reload the page.`
            : msg.includes('Camera') || msg.includes('getUserMedia')
              ? 'Camera access denied or unavailable. Allow camera permission in your browser and try again.'
              : `Face verification setup failed: ${msg}`,
        );
        setPhase('error');
      }
    };

    init();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [open, stopCamera]);

  /* ─── Enroll: multi-capture ────────────────────────────────────────────── */
  const handleEnroll = async () => {
    if (!videoRef.current || phase === 'capturing' || phase === 'processing') return;

    setPhase('capturing');
    setError(null);
    setSuccessMsg(null);
    setCaptureProgress(null);

    try {
      const descriptors = await multiCaptureDescriptors(
        videoRef.current,
        ENROLL_CAPTURE_COUNT,
        900,
        (progress) => setCaptureProgress(progress),
      );

      setPhase('processing');

      const res = await authFetch('/api/user/face', {
        method: 'POST',
        body: JSON.stringify({ descriptors }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Face enrollment failed.');
        setPhase('ready');
        return;
      }

      setSuccessMsg(data.reEnrolled
        ? 'Face profile updated! Your identity has been re-registered.'
        : 'Face profile enrolled successfully!');
      setPhase('success');
      stopCamera();
      setTimeout(() => onEnrolled(), 1200);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      setError(`Enrollment failed: ${msg}`);
      setPhase('ready');
    }
  };

  /* ─── Verify: single capture ───────────────────────────────────────────── */
  const handleVerify = async () => {
    if (!videoRef.current || phase === 'capturing' || phase === 'processing') return;

    setPhase('processing');
    setError(null);
    setSuccessMsg(null);

    try {
      const descriptor = await extractFaceDescriptor(videoRef.current);
      if (!descriptor) {
        setError('No face detected. Center your face in the frame with good lighting and try again.');
        setPhase('ready');
        return;
      }

      if (!examId) {
        setError('Exam ID missing for verification.');
        setPhase('ready');
        return;
      }

      const res = await authFetch('/api/user/face', {
        method: 'PUT',
        body: JSON.stringify({ descriptor, examId }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Face verification failed.');
        setPhase('ready');
        return;
      }

      setSuccessMsg('Identity verified! Proceeding to decrypt…');
      setPhase('success');
      stopCamera();
      setTimeout(() => onVerified(data.faceVerificationToken), 800);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      setError(`Face capture failed: ${msg}`);
      setPhase('ready');
    }
  };

  const handleCapture = mode === 'enroll' ? handleEnroll : handleVerify;

  if (!open) return null;

  /* ─── UI Text ──────────────────────────────────────────────────────────── */
  const title = mode === 'enroll' ? 'Register Your Face' : 'Verify Your Identity';
  const subtitle = mode === 'enroll'
    ? 'Register your face profile for secure biometric verification. We\'ll capture 3 snapshots for accuracy.'
    : `Confirm your identity as ${userName} to decrypt and view the exam paper.`;

  /* ─── Face guide border color ──────────────────────────────────────────── */
  const guideBorderColor = phase === 'capturing'
    ? 'rgba(234,179,8,0.8)'
    : faceDetected
      ? 'rgba(34,197,94,0.8)'
      : 'rgba(239,68,68,0.5)';

  const guideGlow = phase === 'capturing'
    ? '0 0 20px rgba(234,179,8,0.3)'
    : faceDetected
      ? '0 0 20px rgba(34,197,94,0.2)'
      : 'none';

  /* ─── Live status text ─────────────────────────────────────────────────── */
  const liveStatusText = (() => {
    if (phase === 'loading') return null;
    if (phase === 'capturing' && captureProgress) {
      return `📸 Capturing ${captureProgress.current} of ${captureProgress.total}… hold still`;
    }
    if (phase === 'processing') return '⏳ Processing…';
    if (phase === 'success') return null;
    if (!faceDetected) return '⚠️ No face detected — position your face in the oval';
    
    // Liveness checks
    if (livenessStep === 'turn_left') return '🔄 Please turn your head slightly to the left';
    if (livenessStep === 'turn_right') return '🔄 Now turn your head slightly to the right';
    
    return '✅ Liveness verified — ready to capture';
  })();

  /* ─── Button disabled state ────────────────────────────────────────────── */
  const buttonDisabled =
    phase === 'loading' || phase === 'capturing' || phase === 'processing' || phase === 'success' ||
    (!faceDetected && phase === 'ready') ||
    livenessStep !== 'passed';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="face-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(15, 23, 42, 0.72)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        className="card anim-fade-up"
        style={{ width: '100%', maxWidth: 520, padding: 0, overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ─── Header ────────────────────────────────────────────────── */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: mode === 'enroll' ? '#eef2ff' : '#f0fdf4',
            border: `1px solid ${mode === 'enroll' ? 'rgba(37,99,235,0.15)' : 'rgba(22,163,74,0.15)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <ScanFace size={20} color={mode === 'enroll' ? '#2563eb' : '#16a34a'} />
          </div>
          <div style={{ flex: 1 }}>
            <h2 id="face-modal-title" style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-1)', marginBottom: 4 }}>
              {title}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5 }}>{subtitle}</p>
          </div>
        </div>

        {/* ─── Video Feed ────────────────────────────────────────────── */}
        <div style={{ padding: '16px 24px 0' }}>
          <div style={{
            position: 'relative',
            borderRadius: 14,
            overflow: 'hidden',
            background: '#0f172a',
            aspectRatio: '4 / 3',
            border: '1px solid var(--border)',
          }}>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
            />

            {/* Face guide oval */}
            {phase !== 'loading' && phase !== 'error' && (
              <div style={{
                position: 'absolute',
                inset: '10%',
                border: `2.5px ${phase === 'capturing' ? 'solid' : 'dashed'} ${guideBorderColor}`,
                borderRadius: '50%',
                pointerEvents: 'none',
                transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
                boxShadow: guideGlow,
              }} />
            )}

            {/* Loading overlay */}
            {phase === 'loading' && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                background: 'rgba(15,23,42,0.8)', color: '#fff', fontSize: 13, gap: 12,
              }}>
                <span className="spinner" style={{ borderColor: 'rgba(255,255,255,0.2)', borderTopColor: '#fff', width: 32, height: 32 }} />
                Loading camera &amp; face models…
              </div>
            )}

            {/* Capture progress overlay */}
            {phase === 'capturing' && captureProgress && (
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                background: 'linear-gradient(transparent, rgba(15,23,42,0.85))',
                padding: '32px 20px 16px', color: '#fff',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>
                    Capturing {captureProgress.current}/{captureProgress.total}
                  </span>
                  {captureProgress.error && (
                    <span style={{ fontSize: 11, color: '#fbbf24' }}>Retrying…</span>
                  )}
                </div>
                {/* Progress bar */}
                <div style={{
                  height: 4, borderRadius: 2,
                  background: 'rgba(255,255,255,0.2)',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%',
                    borderRadius: 2,
                    background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                    width: `${(captureProgress.current / captureProgress.total) * 100}%`,
                    transition: 'width 0.5s ease',
                  }} />
                </div>
              </div>
            )}

            {/* Processing overlay */}
            {phase === 'processing' && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                background: 'rgba(15,23,42,0.6)', color: '#fff', gap: 10,
              }}>
                <span className="spinner" style={{ borderColor: 'rgba(255,255,255,0.2)', borderTopColor: '#fff', width: 28, height: 28 }} />
                <span style={{ fontSize: 13 }}>{mode === 'enroll' ? 'Enrolling face profile…' : 'Verifying identity…'}</span>
              </div>
            )}

            {/* Success overlay */}
            {phase === 'success' && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                background: 'rgba(15,23,42,0.7)', color: '#fff', gap: 10,
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: 'rgba(34,197,94,0.2)', border: '2px solid #22c55e',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <CheckCircle size={24} color="#22c55e" />
                </div>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{successMsg}</span>
              </div>
            )}
          </div>

          {/* ─── Live status bar ────────────────────────────────────── */}
          {liveStatusText && (
            <div style={{
              marginTop: 10,
              padding: '8px 12px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 500,
              textAlign: 'center',
              color: faceDetected || phase === 'capturing' ? 'var(--text-1)' : 'var(--text-3)',
              background: faceDetected
                ? 'rgba(34,197,94,0.08)'
                : phase === 'capturing'
                  ? 'rgba(234,179,8,0.08)'
                  : 'rgba(239,68,68,0.06)',
              border: `1px solid ${faceDetected
                ? 'rgba(34,197,94,0.15)'
                : phase === 'capturing'
                  ? 'rgba(234,179,8,0.15)'
                  : 'rgba(239,68,68,0.1)'}`,
              transition: 'all 0.3s ease',
            }}>
              {liveStatusText}
              {faceDetected && faceScore > 0 && phase === 'ready' && (
                <span style={{ marginLeft: 8, opacity: 0.5, fontSize: 11 }}>
                  ({Math.round(faceScore * 100)}% confidence)
                </span>
              )}
            </div>
          )}
        </div>

        {/* ─── Messages ──────────────────────────────────────────────── */}
        <div style={{ padding: '12px 24px 0' }}>
          {error && (
            <div className="alert alert-error" style={{ marginBottom: 8 }}>
              <span className="alert-icon"><XCircle size={16} /></span>
              <span style={{ fontSize: 13 }}>{error}</span>
            </div>
          )}

          {/* Enrollment instructions */}
          <div className="alert alert-info" style={{ marginBottom: 0 }}>
            <span className="alert-icon"><AlertTriangle size={16} /></span>
            <span style={{ fontSize: 12, lineHeight: 1.5 }}>
              {mode === 'enroll'
                ? 'Look directly at the camera. Remove masks or sunglasses. We\'ll capture 3 photos to build a robust face profile for secure verification.'
                : 'Live face must match your enrolled profile. Decryption is blocked if identity cannot be confirmed.'}
            </span>
          </div>
        </div>

        {/* ─── Actions ───────────────────────────────────────────────── */}
        <div style={{ padding: '16px 24px 20px', display: 'flex', gap: 10 }}>
          <button type="button" onClick={onClose} className="btn" style={{ flex: 1, height: 44 }}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCapture}
            disabled={buttonDisabled}
            className="btn btn-primary"
            style={{
              flex: 2,
              height: 44,
              opacity: buttonDisabled ? 0.5 : 1,
              cursor: buttonDisabled ? 'not-allowed' : 'pointer',
            }}
          >
            {phase === 'capturing' ? (
              <><span className="spinner" /> Capturing…</>
            ) : phase === 'processing' ? (
              <><span className="spinner" /> {mode === 'enroll' ? 'Enrolling…' : 'Verifying…'}</>
            ) : mode === 'enroll' ? (
              <><ScanFace size={16} /> &nbsp;Capture &amp; Enroll ({ENROLL_CAPTURE_COUNT} photos)</>
            ) : (
              <><ScanFace size={16} /> &nbsp;Verify Identity</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

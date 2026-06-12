'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Key, Pen, LockShield, Lock, Eye, EyeOff, AlertTriangle, AlarmClock } from '@/components/Icons';
import { getRole, getToken, setAuth } from '@/lib/auth-storage';
import { ROLE_THEMES } from '@/lib/role-theme';

const ROLES = [
  {
    id: 'admin',
    label: 'Exam Board Admin',
    tag: 'Administrator',
    icon: <Shield size={19} />,
    accent: ROLE_THEMES.admin.accent,
    desc: 'Upload & encrypt exam papers. Set exam time and assign personnel.',
    username: 'admin',
    password: 'Admin@123',
  },
  {
    id: 'center_head',
    label: 'Center Head',
    tag: 'Regional Center',
    icon: <Key size={19} />,
    accent: ROLE_THEMES.center_head.accent,
    desc: 'View assigned exams and provide Signature 1 to authorize decryption.',
    username: 'centerhead',
    password: 'Center@123',
  },
  {
    id: 'invigilator',
    label: 'Invigilator',
    tag: 'Exam Hall',
    icon: <Pen size={19} />,
    accent: ROLE_THEMES.invigilator.accent,
    desc: 'View assigned exams and provide Signature 2 to complete unlock.',
    username: 'invigilator',
    password: 'Invigil@123',
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [selected, setSelected] = useState(ROLES[0]);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('Admin@123');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = getToken();
    const role = getRole();
    if (token && role) {
      router.push(role === 'admin' ? '/admin' : '/center');
    }
  }, [router]);

  const pickRole = (r: typeof ROLES[0]) => {
    setSelected(r);
    setUsername(r.username);
    setPassword(r.password);
    setError('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Login failed'); return; }
      setAuth(data.token, data.user, data.user.role);
      router.push(data.user.role === 'admin' ? '/admin' : '/center');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const trustBadges: [React.ReactNode, string, string][] = [
    [<Lock size={18} key="lock" color="var(--navy)" />, 'AES-256-GCM end-to-end encryption', 'All data encrypted at rest & in transit'],
    [<AlarmClock size={18} key="alarm" color="var(--navy)" />, 'Time-locked key release (T−5 min)', 'Keys inaccessible until exam window'],
    [<Pen size={18} key="pen" color="var(--navy)" />, 'Dual multi-signature authorization', 'Both parties must co-sign to decrypt'],
  ];

  return (
    <div className="page-bg" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>

      <div style={{ width: '100%', maxWidth: 1000, position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <div className="anim-fade-up" style={{ textAlign: 'center', marginBottom: 52 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 20, padding: '8px 20px', background: '#eef2f7', border: '1px solid #d5dae2', borderRadius: 99 }}>
            <LockShield size={16} color="var(--navy)" />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: 'var(--navy)', textTransform: 'uppercase' as const }}>Secure-Exam System</span>
          </div>
          <h1 style={{ fontSize: 40, fontWeight: 800, color: 'var(--navy)', letterSpacing: '-0.035em', lineHeight: 1.1, marginBottom: 12 }}>
            Anti-Leak Exam<br />
            <span style={{ color: 'var(--blue)' }}>Distribution Platform</span>
          </h1>
          <p style={{ fontSize: 16, color: 'var(--text-3)', maxWidth: 520, margin: '0 auto', lineHeight: 1.7 }}>
            AES-256 encryption · Time-locked release · Multi-signature authorization
          </p>
        </div>

        {/* Two-panel layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, alignItems: 'start' }}>

          {/* Left — Role picker */}
          <div className="anim-fade-up anim-delay-1">
            <p className="section-label" style={{ marginBottom: 14 }}>Select your role</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {ROLES.map((r) => {
                const isActive = selected.id === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => pickRole(r)}
                    style={{
                      position: 'relative',
                      borderRadius: 'var(--radius-md)',
                      border: `1px solid ${isActive ? `${r.accent}88` : 'var(--border)'}`,
                      padding: '18px 18px',
                      cursor: 'pointer',
                      transition: 'all 0.22s ease',
                      background: isActive ? `${r.accent}08` : 'var(--surface)',
                      textAlign: 'left' as const,
                      width: '100%',
                      boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
                    }}
                  >
                    {/* Active indicator bar */}
                    {isActive && (
                      <div style={{
                        position: 'absolute',
                        left: 0,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: 3,
                        height: '60%',
                        borderRadius: '0 4px 4px 0',
                        background: r.accent,
                      }} />
                    )}

                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                      <div style={{
                        width: 42,
                        height: 42,
                        borderRadius: 10,
                        background: `${r.accent}10`,
                        border: `1px solid ${r.accent}20`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'all 0.2s',
                        color: r.accent,
                      }}>
                        {r.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                          <span style={{ fontSize: 16, fontWeight: 600, color: isActive ? 'var(--text-1)' : 'var(--text-2)' }}>{r.label}</span>
                          <span style={{
                            fontSize: 12,
                            fontWeight: 700,
                            letterSpacing: '0.06em',
                            padding: '2px 8px',
                            borderRadius: 99,
                            background: `${r.accent}10`,
                            color: r.accent,
                            border: `1px solid ${r.accent}20`,
                          }}>
                            {r.tag}
                          </span>
                        </div>
                        <p style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.55 }}>{r.desc}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right — Login form */}
          <div className="anim-fade-up anim-delay-2">
            <div className="card" style={{ padding: 36 }}>

              {/* Form header */}
              <div style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: `${selected.accent}10`,
                    border: `1px solid ${selected.accent}20`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.3s ease',
                    color: selected.accent,
                  }}>
                    {selected.icon}
                  </div>
                  <div>
                    <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>Sign In</h2>
                    <p style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.5, marginTop: 2 }}>
                      Logging in as <span style={{ color: selected.accent, fontWeight: 600 }}>{selected.label}</span>
                    </p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleLogin}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                  {/* Username */}
                  <div>
                    <label className="field-label" htmlFor="username">Username</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', fontSize: 14, opacity: 0.6 }}>@</span>
                      <input
                        id="username"
                        className="input"
                        style={{ paddingLeft: 32 }}
                        type="text"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        placeholder="username"
                        autoComplete="username"
                        required
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="field-label" htmlFor="password">Password</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        id="password"
                        className="input"
                        style={{ paddingRight: 48 }}
                        type={showPass ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(!showPass)}
                        style={{
                          position: 'absolute',
                          right: 14,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--text-3)',
                          padding: 4,
                          borderRadius: 4,
                          transition: 'color 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Error */}
                  {error && (
                    <div className="alert alert-error">
                      <span className="alert-icon"><AlertTriangle size={16} /></span>
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    id="login-submit"
                    type="submit"
                    className="btn btn-primary btn-lg"
                    disabled={loading}
                    style={{
                      width: '100%',
                      marginTop: 4,
                      background: selected.accent,
                      transition: 'all 0.25s ease',
                    }}
                  >
                    {loading ? <><span className="spinner" /> Authenticating…</> : <><LockShield size={16} />&nbsp;&nbsp;Sign In Securely</>}
                  </button>
                </div>
              </form>

              {/* Trust badges */}
              <div style={{ marginTop: 28, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {trustBadges.map(([icon, title, subtitle]) => (
                    <div key={title as string} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0' }}>
                      <span style={{ flexShrink: 0, marginTop: 1, display: 'flex' }}>{icon}</span>
                      <div>
                        <div style={{ fontSize: 14, color: 'var(--text-2)', fontWeight: 500 }}>{title}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 1 }}>{subtitle}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="anim-fade-up anim-delay-4" style={{ textAlign: 'center', marginTop: 40, fontSize: 13, color: 'var(--text-4)', letterSpacing: '0.02em' }}>
          SecureExam Prototype v1.0 · Unauthorized access is a criminal offense under applicable law.
        </p>
      </div>
    </div>
  );
}

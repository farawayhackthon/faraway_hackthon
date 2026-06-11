import { NextResponse } from 'next/server';
import { getStore, ExamRecord } from '@/lib/store';
import { verifyToken } from '@/lib/jwt';
import { encrypt, generatePassphrase } from '@/lib/crypto';
import { v4 as uuidv4 } from 'uuid';

/**
 * Admin-only demo endpoint: creates a test exam with exam time set to
 * NOW + N minutes. This bypasses the 10-minute upload restriction
 * specifically for live demonstrations of the time-lock mechanism.
 */
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const minutesFromNow = body.minutesFromNow ?? 6; // default: 6 min (window opens in 1 min)

    const store = getStore();
    const ch = store.getUsers().find(u => u.role === 'center_head');
    const inv = store.getUsers().find(u => u.role === 'invigilator');

    if (!ch || !inv) {
      return NextResponse.json({ error: 'No Center Head or Invigilator found' }, { status: 400 });
    }

    const examTime = new Date(Date.now() + minutesFromNow * 60 * 1000);

    const demoContent = `CONFIDENTIAL — EXAM PAPER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Subject: Advanced Mathematics — Paper I
Exam Date: ${examTime.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
Duration: 3 Hours     Max Marks: 100

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SECTION A — Short Answer (20 Marks)

Q1. Evaluate: ∫₀^π sin²(x) dx                                    [4 marks]

Q2. Find the eigenvalues of the matrix:
    [2  1]
    [1  2]                                                        [4 marks]

Q3. If f(x) = e^(x²), find f''(x).                               [4 marks]

Q4. Prove that √2 is irrational.                                  [4 marks]

Q5. Find the radius of convergence of Σ (n! xⁿ) / nⁿ            [4 marks]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SECTION B — Long Answer (40 Marks)

Q6. Using Lagrange multipliers, find the maximum value of
    f(x,y) = xy subject to x² + y² = 1.                         [10 marks]

Q7. Solve the differential equation:
    d²y/dx² + 4y = cos(2x)
    with y(0) = 0, y'(0) = 1                                     [10 marks]

Q8. State and prove the Fundamental Theorem of Calculus.         [10 marks]

Q9. Find the Taylor series expansion of ln(1+x) about x=0
    and determine its radius of convergence.                      [10 marks]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SECTION C — Application Problems (40 Marks)

Q10. A particle moves with velocity v(t) = t² - 4t + 3 m/s.
     Find: (a) displacement from t=0 to t=4
           (b) distance traveled from t=0 to t=4
           (c) when is the particle at rest?                      [15 marks]

Q11. Using Green's Theorem, evaluate the line integral:
     ∮ (y² dx + x² dy) where C is the boundary of the
     square with vertices (0,0), (1,0), (1,1), (0,1).           [15 marks]

Q12. Prove that every convergent sequence is Cauchy, and
     give an example showing the converse is not always true
     in a general metric space.                                   [10 marks]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
END OF PAPER — This paper contains 3 sections and 12 questions.
Do not turn over until instructed by the invigilator.`;

    const masterPassphrase = generatePassphrase();
    const { encrypted: encryptedPayload, salt } = encrypt(demoContent, masterPassphrase);
    const vaultKey = `${process.env.VAULT_SECRET || 'vault-secret-key'}-${payload.userId}`;
    const { encrypted: encryptedKey, salt: keySalt } = encrypt(masterPassphrase, vaultKey);

    const examRecord: ExamRecord = {
      id: uuidv4(),
      title: `[DEMO] Advanced Mathematics Paper — ${new Date().toLocaleTimeString()}`,
      subject: 'Advanced Mathematics',
      examTime: examTime.toISOString(),
      centerHeadId: ch.id,
      invigilatorId: inv.id,
      encryptedPayload,
      salt,
      encryptedKey,
      keySalt,
      uploadedAt: new Date().toISOString(),
      status: 'scheduled',
      signatures: { centerHead: false, invigilator: false },
      uploadedBy: payload.userId,
      originalFilename: 'advanced_math_paper_1.txt',
    };

    store.addExam(examRecord);

    return NextResponse.json({
      success: true,
      examId: examRecord.id,
      examTime: examTime.toISOString(),
      minutesFromNow,
      windowOpensInMinutes: minutesFromNow - 5,
      message: `Demo exam created! Exam time: T+${minutesFromNow}min. Window opens in ${minutesFromNow - 5} minute(s).`,
    });
  } catch (err) {
    console.error('Demo exam error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

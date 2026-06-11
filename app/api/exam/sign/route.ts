import { NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { verifyToken } from '@/lib/jwt';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { examId } = body;

    if (!examId) {
      return NextResponse.json({ error: 'Exam ID is required' }, { status: 400 });
    }

    const store = getStore();
    const exam = store.getExamById(examId);

    if (!exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    // ─── Time-Lock Check ──────────────────────────────────────────────────────
    const computed = store.computeExamStatus(exam);

    if (!computed.windowOpen) {
      const minutesLeft = Math.ceil(computed.minutesUntilExam - 5);
      return NextResponse.json({
        error: `TIME-LOCK ACTIVE: Signing window opens in ${minutesLeft} minute(s). You can only sign within 5 minutes of the exam start time.`,
        minutesUntilWindow: minutesLeft,
        locked: true,
      }, { status: 403 });
    }

    if (computed.expired) {
      return NextResponse.json({ error: 'Exam period has expired' }, { status: 403 });
    }

    // ─── Role-Based Signature ─────────────────────────────────────────────────
    let updates: Partial<typeof exam> = {};
    let signerRole = '';

    if (payload.role === 'center_head') {
      if (exam.centerHeadId !== payload.userId) {
        return NextResponse.json({ error: 'You are not assigned to this exam' }, { status: 403 });
      }
      if (exam.signatures.centerHead) {
        return NextResponse.json({ error: 'You have already signed this exam' }, { status: 409 });
      }
      updates = {
        signatures: {
          ...exam.signatures,
          centerHead: true,
          centerHeadAt: new Date().toISOString(),
        },
      };
      signerRole = 'Center Head';
    } else if (payload.role === 'invigilator') {
      if (exam.invigilatorId !== payload.userId) {
        return NextResponse.json({ error: 'You are not assigned to this exam' }, { status: 403 });
      }
      if (exam.signatures.invigilator) {
        return NextResponse.json({ error: 'You have already signed this exam' }, { status: 409 });
      }
      updates = {
        signatures: {
          ...exam.signatures,
          invigilator: true,
          invigilatorAt: new Date().toISOString(),
        },
      };
      signerRole = 'Invigilator';
    } else {
      return NextResponse.json({ error: 'Admins cannot sign exams' }, { status: 403 });
    }

    const updated = store.updateExam(examId, updates);
    if (!updated) {
      return NextResponse.json({ error: 'Failed to update exam' }, { status: 500 });
    }

    // Check if both signatures are now collected
    const bothSigned = updated.signatures.centerHead && updated.signatures.invigilator;

    console.log(`[SIGNATURE] ${signerRole} "${payload.username}" signed exam "${exam.title}" at ${new Date().toISOString()}`);

    return NextResponse.json({
      success: true,
      message: `Signature ${signerRole === 'Center Head' ? '1 (Center Head)' : '2 (Invigilator)'} recorded successfully.`,
      signatures: updated.signatures,
      bothSigned,
      readyToDecrypt: bothSigned,
    });
  } catch (err) {
    console.error('Sign exam error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

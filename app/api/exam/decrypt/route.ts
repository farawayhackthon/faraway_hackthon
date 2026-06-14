import { NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { verifyToken } from '@/lib/jwt';
import { decrypt } from '@/lib/crypto';
import { verifyFaceVerificationToken } from '@/lib/face';
import { buildTraceId } from '@/lib/watermark';
import { logAudit } from '@/lib/audit';
import { v4 as uuidv4 } from 'uuid';

function buildAuditResponse(exam: ReturnType<ReturnType<typeof getStore>['getExamById']>) {
  if (!exam) return null;
  const ra = exam.releaseAudit;
  return {
    centerHeadSignedAt: exam.signatures.centerHeadAt,
    invigilatorSignedAt: exam.signatures.invigilatorAt,
    faceVerifiedAt: ra?.faceVerifiedAt,
    faceVerifiedUser: ra?.decryptedBy,
    decryptedAt: ra?.decryptedAt,
    traceId: ra?.traceId,
  };
}

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
    const { examId, faceVerificationToken } = body;

    if (!examId) {
      return NextResponse.json({ error: 'Exam ID is required' }, { status: 400 });
    }

    const store = getStore();
    const exam = store.getExamById(examId);

    if (!exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    if (payload.role === 'admin') {
      return NextResponse.json({ error: 'Admins cannot decrypt exam papers' }, { status: 403 });
    }
    if (payload.role === 'center_head' && exam.centerHeadId !== payload.userId) {
      return NextResponse.json({ error: 'Not assigned to this exam' }, { status: 403 });
    }
    if (payload.role === 'invigilator' && exam.invigilatorId !== payload.userId) {
      return NextResponse.json({ error: 'Not assigned to this exam' }, { status: 403 });
    }

    // ─── Already decrypted — allow assigned staff to view (no re-face-verify) ─
    if (exam.decryptedContent) {
      const viewer = store.getUserById(payload.userId);
      logAudit({
        examId: exam.id,
        examTitle: exam.title,
        event: 'exam_viewed',
        actorId: payload.userId,
        actorName: viewer?.name ?? 'Unknown',
        actorRole: payload.role === 'center_head' ? 'Center Head' : 'Invigilator',
        message: `Decrypted paper viewed by ${viewer?.name ?? 'staff'}.`,
      });

      return NextResponse.json({
        success: true,
        content: exam.decryptedContent,
        alreadyCached: true,
        decryptedAt: exam.releaseAudit?.decryptedAt,
        releaseAudit: exam.releaseAudit,
        auditLog: buildAuditResponse(exam),
      });
    }

    // ─── GATE 1: Time-Lock ────────────────────────────────────────────────────
    const computed = store.computeExamStatus(exam);

    if (computed.expired) {
      return NextResponse.json({
        error: 'Decryption window has expired. Contact the Exam Board.',
        gate: 'EXPIRED',
      }, { status: 403 });
    }

    if (!computed.windowOpen) {
      const minutesLeft = Math.ceil(computed.minutesUntilExam - 5);
      return NextResponse.json({
        error: `TIME-LOCK ACTIVE: Decryption window opens in ${minutesLeft} minute(s).`,
        minutesUntilWindow: minutesLeft,
        locked: true,
        gate: 'TIME_LOCK',
      }, { status: 403 });
    }

    // ─── GATE 2: Multi-Signature ────────────────────────────────────────────
    if (!exam.signatures.centerHead) {
      return NextResponse.json({
        error: 'MULTI-SIG INCOMPLETE: Waiting for Center Head signature (Signature 1).',
        gate: 'MISSING_SIG_1',
        signatures: exam.signatures,
      }, { status: 403 });
    }

    if (!exam.signatures.invigilator) {
      return NextResponse.json({
        error: 'MULTI-SIG INCOMPLETE: Waiting for Invigilator signature (Signature 2).',
        gate: 'MISSING_SIG_2',
        signatures: exam.signatures,
      }, { status: 403 });
    }

    // ─── GATE 3: Face Verification (first release only) ─────────────────────
    const user = store.getUserById(payload.userId);
    if (!user?.faceDescriptor?.length) {
      return NextResponse.json({
        error: 'FACE NOT ENROLLED: Register your face profile before decrypting exam papers.',
        gate: 'FACE_NOT_ENROLLED',
      }, { status: 403 });
    }

    if (!faceVerificationToken) {
      return NextResponse.json({
        error: 'FACE VERIFICATION REQUIRED: Live face recognition must pass before decryption.',
        gate: 'FACE_REQUIRED',
      }, { status: 403 });
    }

    const facePayload = verifyFaceVerificationToken(faceVerificationToken, payload.userId, examId);
    if (!facePayload) {
      return NextResponse.json({
        error: 'FACE VERIFICATION EXPIRED: Please verify your identity again.',
        gate: 'FACE_TOKEN_INVALID',
      }, { status: 403 });
    }

    // ─── UNLOCK: Decrypt ────────────────────────────────────────────────────
    try {
      const vaultKey = `${process.env.VAULT_SECRET || 'vault-secret-key'}-${exam.uploadedBy}`;
      const masterPassphrase = decrypt(exam.encryptedKey, vaultKey, exam.keySalt);
      const decryptedContent = decrypt(exam.encryptedPayload, masterPassphrase, exam.salt);

      const decryptor = store.getUserById(payload.userId);
      const roleLabel = payload.role === 'center_head' ? 'Center Head' : 'Invigilator';
      const decryptedAt = new Date().toISOString();
      const traceId = buildTraceId(examId, decryptedAt);

      const releaseAudit = {
        decryptedAt,
        decryptedBy: decryptor?.name ?? 'Unknown',
        decryptedByRole: roleLabel,
        decryptedById: payload.userId,
        faceVerifiedAt: decryptedAt,
        traceId,
        centerId: decryptor?.centerId,
      };

      store.updateExam(examId, {
        decryptedContent,
        status: 'decrypted',
        releaseAudit,
      });

      store.addNotification({
        id: uuidv4(),
        userId: exam.uploadedBy,
        type: 'exam_decrypted',
        examId: exam.id,
        examTitle: exam.title,
        subject: exam.subject,
        decryptedBy: decryptor?.name ?? 'Unknown',
        decryptedByRole: roleLabel,
        message: `"${exam.title}" was decrypted by ${decryptor?.name ?? 'center staff'} (${roleLabel}).`,
        createdAt: decryptedAt,
        read: false,
      });

      logAudit({
        examId: exam.id,
        examTitle: exam.title,
        event: 'exam_decrypted',
        actorId: payload.userId,
        actorName: decryptor?.name ?? 'Unknown',
        actorRole: roleLabel,
        message: `Exam paper decrypted and released. Trace ID: ${traceId}`,
        metadata: { traceId },
      });

      console.log(`[DECRYPT SUCCESS] Exam "${exam.title}" decrypted. Trace: ${traceId}`);

      return NextResponse.json({
        success: true,
        content: decryptedContent,
        decryptedAt,
        releaseAudit,
        auditLog: {
          centerHeadSignedAt: exam.signatures.centerHeadAt,
          invigilatorSignedAt: exam.signatures.invigilatorAt,
          faceVerifiedAt: decryptedAt,
          faceVerifiedUser: decryptor?.name ?? 'Unknown',
          decryptedAt,
          traceId,
        },
      });
    } catch (decryptErr) {
      console.error('Decryption failed:', decryptErr);
      return NextResponse.json({ error: 'Decryption failed — cryptographic error' }, { status: 500 });
    }
  } catch (err) {
    console.error('Decrypt route error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

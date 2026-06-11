import { NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { verifyToken } from '@/lib/jwt';

export async function GET(request: Request) {
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

    const store = getStore();
    const exams = store.getExamsForUser(payload.userId, payload.role);

    // Compute live status for each exam and strip sensitive fields for non-admins
    const enriched = exams.map(exam => {
      const computed = store.computeExamStatus(exam);

      // Get assigned user names
      const ch = store.getUserById(exam.centerHeadId);
      const inv = store.getUserById(exam.invigilatorId);
      const uploader = store.getUserById(exam.uploadedBy);

      return {
        id: exam.id,
        title: exam.title,
        subject: exam.subject,
        examTime: exam.examTime,
        uploadedAt: exam.uploadedAt,
        status: computed.status,
        minutesUntilExam: computed.minutesUntilExam,
        windowOpen: computed.windowOpen,
        expired: computed.expired,
        signatures: exam.signatures,
        centerHeadName: ch?.name ?? 'Unknown',
        invigilatorName: inv?.name ?? 'Unknown',
        uploadedByName: uploader?.name ?? 'Unknown',
        originalFilename: exam.originalFilename,
        // Only include decrypted content if fully unlocked
        decryptedContent: computed.status === 'decrypted' ? exam.decryptedContent : undefined,
      };
    });

    return NextResponse.json({ exams: enriched });
  } catch (err) {
    console.error('List exams error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { verifyToken } from '@/lib/jwt';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyToken(authHeader.split(' ')[1]);
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const examId = searchParams.get('examId');

    const store = getStore();
    const logs = examId ? await store.getAuditLogsForExam(examId) : await store.getAuditLogs();

    const allExams = await store.getExams();
    const exams = allExams.map(e => ({
      id: e.id,
      title: e.title,
      subject: e.subject,
      status: store.computeExamStatus(e).status,
      isReleased: Boolean(e.decryptedContent),
    }));

    return NextResponse.json({ logs, exams });
  } catch (err) {
    console.error('Audit log error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

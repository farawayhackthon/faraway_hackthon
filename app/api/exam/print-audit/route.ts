import { NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { verifyToken } from '@/lib/jwt';
import { v4 as uuidv4 } from 'uuid';

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

    const { examId, actionType } = await request.json();
    if (!examId || !actionType) {
      return NextResponse.json({ error: 'Missing examId or actionType' }, { status: 400 });
    }

    const store = getStore();
    const exam = await store.getExamById(examId);

    if (!exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    // Ensure the user is authorized to print this exam (center head or invigilator assigned to it, or admin)
    if (payload.role !== 'admin' && exam.centerHeadId !== payload.userId && exam.invigilatorId !== payload.userId) {
      return NextResponse.json({ error: 'Unauthorized to access this exam' }, { status: 403 });
    }

    // Increment print count
    const currentCount = exam.printCount || 0;
    await store.updateExam(examId, { printCount: currentCount + 1 });

    const user = await store.getUserById(payload.userId);
    if (user) {
      await store.addAuditLog({
        id: uuidv4(),
        examId: exam.id,
        examTitle: exam.title,
        event: 'exam_printed',
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        message: `${user.name} generated a ${actionType} for this exam paper.`,
        metadata: {
          actionType,
          newPrintCount: currentCount + 1,
        },
        createdAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({ success: true, printCount: currentCount + 1 });
  } catch (err) {
    console.error('Print audit error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

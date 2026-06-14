import { NextResponse } from 'next/server';
import { getStore, ExamRecord } from '@/lib/store';
import { verifyToken } from '@/lib/jwt';
import { encrypt, generatePassphrase } from '@/lib/crypto';
import { logAudit } from '@/lib/audit';
import { v4 as uuidv4 } from 'uuid';

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
    const { title, subject, examTime, centerHeadId, invigilatorId, content, filename } = body;

    if (!title || !subject || !examTime || !centerHeadId || !invigilatorId || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const store = getStore();

    // Validate assigned users exist and have correct roles
    const ch = await store.getUserById(centerHeadId);
    const inv = await store.getUserById(invigilatorId);

    if (!ch || ch.role !== 'center_head') {
      return NextResponse.json({ error: 'Invalid Center Head ID' }, { status: 400 });
    }
    if (!inv || inv.role !== 'invigilator') {
      return NextResponse.json({ error: 'Invalid Invigilator ID' }, { status: 400 });
    }
    if (ch.centerId !== inv.centerId) {
      return NextResponse.json({ error: 'Center Head and Invigilator must belong to the same center' }, { status: 400 });
    }

    // Validate exam time is in the future
    const examDate = new Date(examTime);
    if (isNaN(examDate.getTime())) {
      return NextResponse.json({ error: 'Invalid exam time format' }, { status: 400 });
    }
    if (examDate.getTime() <= Date.now() + 6 * 60 * 1000) {
      return NextResponse.json({
        error: 'Exam time must be at least 6 minutes in the future',
      }, { status: 400 });
    }

    // Step 1: Generate a strong random AES passphrase (this IS the "smart contract key")
    const masterPassphrase = generatePassphrase();

    // Step 2: Encrypt the exam content with the master passphrase
    const { encrypted: encryptedPayload, salt } = encrypt(content, masterPassphrase);

    // Step 3: Encrypt the master passphrase itself (simulates time-lock vault storage)
    // In a real system, this would be locked in a smart contract / HSM
    // Here we encrypt it with a system key + exam ID as additional entropy
    const vaultKey = `${process.env.VAULT_SECRET || 'vault-secret-key'}-${payload.userId}`;
    const { encrypted: encryptedKey, salt: keySalt } = encrypt(masterPassphrase, vaultKey);

    const examId = uuidv4();

    const examRecord: ExamRecord = {
      id: examId,
      title,
      subject,
      examTime: examDate.toISOString(),
      centerHeadId,
      invigilatorId,
      encryptedPayload,
      salt,
      encryptedKey,
      keySalt,
      uploadedAt: new Date().toISOString(),
      status: 'scheduled',
      signatures: {
        centerHead: false,
        invigilator: false,
      },
      uploadedBy: payload.userId,
      originalFilename: filename || 'exam-paper.txt',
    };

    await store.addExam(examRecord);

    const admins = await store.getUsers();
    for (const admin of admins) {
      if (admin.role !== 'admin') continue;
      await store.addNotification({
        id: uuidv4(),
        userId: admin.id,
        type: 'exam_decrypted',
        examId: examRecord.id,
        examTitle: examRecord.title,
        message: `New exam uploaded: ${examRecord.title}`,
        createdAt: new Date().toISOString(),
        read: false,
      });
    }

    const adminUser = await store.getUserById(payload.userId);
    await logAudit({
      examId,
      examTitle: title,
      event: 'exam_uploaded',
      actorId: payload.userId,
      actorName: adminUser?.name ?? 'Admin',
      actorRole: 'Admin',
      message: `Exam "${title}" encrypted and scheduled for ${examDate.toLocaleString()}.`,
      metadata: { subject, centerHeadId, invigilatorId },
    });

    console.log(`[SECURE STORE] Exam "${title}" encrypted & stored. ID: ${examId}`);
    console.log(`[IPFS-SIM] CID would be: sha256(${encryptedPayload.substring(0, 20)}...)`);

    return NextResponse.json({
      success: true,
      examId,
      message: `Exam paper encrypted with AES-256-GCM and stored securely. Decryption key is time-locked until ${examDate.toLocaleString()}.`,
    });
  } catch (err) {
    console.error('Upload exam error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getStore } from '@/lib/store';
import { verifyToken } from '@/lib/jwt';
import { averageDescriptors, facesMatch, signFaceVerificationToken } from '@/lib/face';
import { logAudit } from '@/lib/audit';
import { v4 as uuidv4 } from 'uuid';

function requireStaff(payload: ReturnType<typeof verifyToken>) {
  if (!payload) return { error: 'Invalid token', status: 401 as const };
  if (payload.role !== 'center_head' && payload.role !== 'invigilator') {
    return { error: 'Face verification is only required for center staff', status: 403 as const };
  }
  return null;
}

/* ─── GET: Check enrollment status ─────────────────────────────────────────── */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyToken(authHeader.split(' ')[1]);
    const staffCheck = requireStaff(payload);
    if (staffCheck) return NextResponse.json({ error: staffCheck.error }, { status: staffCheck.status });

    const user = await getStore().getUserById(payload!.userId);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Vercel Ephemeral Storage Hack: Restore face descriptor from cookie if missing
    if (!user.faceDescriptor?.length) {
      const cookieStore = await cookies();
      const cookieFace = cookieStore.get(`vercel_mock_face_${user.id}`)?.value;
      if (cookieFace) {
        try {
          user.faceDescriptor = JSON.parse(cookieFace);
          await getStore().updateUser(user.id, { faceDescriptor: user.faceDescriptor });
        } catch {}
      }
    }

    return NextResponse.json({
      enrolled: Boolean(user.faceDescriptor?.length),
      enrolledAt: user.faceEnrolledAt ?? null,
    });
  } catch (err) {
    console.error('Face status error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/* ─── POST: Enroll (or re-enroll) face ─────────────────────────────────────── */
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyToken(authHeader.split(' ')[1]);
    const staffCheck = requireStaff(payload);
    if (staffCheck) return NextResponse.json({ error: staffCheck.error }, { status: staffCheck.status });

    const body = await request.json();

    // Support both single descriptor and multi-descriptor (array of arrays)
    let finalDescriptor: number[];

    if (body.descriptors && Array.isArray(body.descriptors) && body.descriptors.length > 0) {
      // Multi-capture: array of 128-dim descriptors → average them
      for (const d of body.descriptors) {
        if (!Array.isArray(d) || d.length !== 128) {
          return NextResponse.json({ error: 'Each descriptor must be a 128-dimension array' }, { status: 400 });
        }
      }
      finalDescriptor = averageDescriptors(body.descriptors);
    } else if (body.descriptor && Array.isArray(body.descriptor) && body.descriptor.length === 128) {
      // Legacy single descriptor
      finalDescriptor = body.descriptor;
    } else {
      return NextResponse.json({ error: 'Valid face descriptor(s) required. Send { descriptors: [...] } or { descriptor: [...] }' }, { status: 400 });
    }

    const store = getStore();
    const existingUser = await store.getUserById(payload!.userId);
    const wasEnrolled = Boolean(existingUser?.faceDescriptor?.length);

    const updated = await store.updateUser(payload!.userId, {
      faceDescriptor: finalDescriptor,
      faceEnrolledAt: new Date().toISOString(),
    });

    if (!updated) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Vercel Ephemeral Storage Hack: Save to cookie
    const cookieStore = await cookies();
    cookieStore.set(`vercel_mock_face_${updated.id}`, JSON.stringify(finalDescriptor), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    await logAudit({
      event: 'face_enrolled',
      actorId: payload!.userId,
      actorName: updated.name,
      actorRole: updated.role === 'center_head' ? 'Center Head' : 'Invigilator',
      message: wasEnrolled
        ? `${updated.name} updated their face profile.`
        : `${updated.name} enrolled their face profile.`,
    });

    const allUsers = await store.getUsers();
    const admins = allUsers.filter(u => u.role === 'admin');
    for (const admin of admins) {
      await store.addNotification({
        id: uuidv4(),
        userId: admin.id,
        type: 'face_enrolled',
        message: wasEnrolled
          ? `Staff "${updated.name}" (${updated.role === 'center_head' ? 'Center Head' : 'Invigilator'}) updated their face profile.`
          : `Staff "${updated.name}" (${updated.role === 'center_head' ? 'Center Head' : 'Invigilator'}) enrolled their face profile.`,
        createdAt: new Date().toISOString(),
        read: false,
      });
    }

    console.log(`[FACE ${wasEnrolled ? 'RE-ENROLL' : 'ENROLL'}] User ${updated.name} enrolled face biometrics`);

    return NextResponse.json({
      success: true,
      reEnrolled: wasEnrolled,
      message: wasEnrolled
        ? 'Face profile updated successfully. Your previous face data has been replaced.'
        : 'Face profile enrolled successfully. You can now decrypt exam papers after live verification.',
      enrolledAt: updated.faceEnrolledAt,
    });
  } catch (err) {
    console.error('Face enroll error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/* ─── PUT: Verify face against enrolled profile ────────────────────────────── */
export async function PUT(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyToken(authHeader.split(' ')[1]);
    const staffCheck = requireStaff(payload);
    if (staffCheck) return NextResponse.json({ error: staffCheck.error }, { status: staffCheck.status });

    const body = await request.json();
    const { descriptor, examId } = body as { descriptor?: number[]; examId?: string };

    if (!examId) {
      return NextResponse.json({ error: 'Exam ID is required' }, { status: 400 });
    }
    if (!descriptor || !Array.isArray(descriptor) || descriptor.length !== 128) {
      return NextResponse.json({ error: 'Valid 128-dimension face descriptor is required' }, { status: 400 });
    }

    const store = getStore();
    const user = await store.getUserById(payload!.userId);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Vercel Ephemeral Storage Hack: Restore face descriptor from cookie if missing
    if (!user.faceDescriptor?.length) {
      const cookieStore = await cookies();
      const cookieFace = cookieStore.get(`vercel_mock_face_${user.id}`)?.value;
      if (cookieFace) {
        try {
          user.faceDescriptor = JSON.parse(cookieFace);
          await store.updateUser(user.id, { faceDescriptor: user.faceDescriptor });
        } catch {}
      }
    }

    if (!user.faceDescriptor?.length) {
      return NextResponse.json({
        error: 'FACE NOT ENROLLED: Register your face profile before decrypting exam papers.',
        gate: 'FACE_NOT_ENROLLED',
      }, { status: 403 });
    }

    const exam = await store.getExamById(examId);
    if (!exam) return NextResponse.json({ error: 'Exam not found' }, { status: 404 });

    if (payload!.role === 'center_head' && exam.centerHeadId !== payload!.userId) {
      return NextResponse.json({ error: 'Not assigned to this exam' }, { status: 403 });
    }
    if (payload!.role === 'invigilator' && exam.invigilatorId !== payload!.userId) {
      return NextResponse.json({ error: 'Not assigned to this exam' }, { status: 403 });
    }

    const { match, distance } = facesMatch(user.faceDescriptor, descriptor);
    if (!match) {
      console.warn(`[FACE VERIFY FAIL] User ${user.name} — distance ${distance.toFixed(3)}`);
      await logAudit({
        examId: exam.id,
        examTitle: exam.title,
        event: 'face_verification_failed',
        actorId: payload!.userId,
        actorName: user.name,
        actorRole: payload!.role === 'center_head' ? 'Center Head' : 'Invigilator',
        message: `Face verification failed for ${user.name} on "${exam.title}".`,
        metadata: { distance },
      });
      return NextResponse.json({
        error: 'FACE VERIFICATION FAILED: Identity could not be confirmed. Only the enrolled center head or invigilator may decrypt.',
        gate: 'FACE_MISMATCH',
        distance,
      }, { status: 403 });
    }

    const faceVerificationToken = signFaceVerificationToken(payload!.userId, examId);
    await logAudit({
      examId: exam.id,
      examTitle: exam.title,
      event: 'face_verified',
      actorId: payload!.userId,
      actorName: user.name,
      actorRole: payload!.role === 'center_head' ? 'Center Head' : 'Invigilator',
      message: `Face verified for ${user.name} on "${exam.title}".`,
      metadata: { distance },
    });
    console.log(`[FACE VERIFY OK] User ${user.name} verified for exam ${examId} (distance ${distance.toFixed(3)})`);

    return NextResponse.json({
      success: true,
      faceVerificationToken,
      verifiedAt: new Date().toISOString(),
      distance,
    });
  } catch (err) {
    console.error('Face verify error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getStore, User } from '@/lib/store';
import { verifyToken } from '@/lib/jwt';
import { v4 as uuidv4 } from 'uuid';

function requireAdmin(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const payload = verifyToken(authHeader.split(' ')[1]);
  if (!payload || payload.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 }) };
  }
  return { payload };
}

function serializeStaffUser(u: User) {
  return {
    id: u.id,
    username: u.username,
    role: u.role,
    name: u.name,
    centerId: u.centerId,
    faceEnrolled: Boolean(u.faceDescriptor?.length),
    faceEnrolledAt: u.faceEnrolledAt ?? null,
    createdViaAdmin: Boolean(u.passwordPlain),
  };
}

export async function GET(request: Request) {
  try {
    const auth = requireAdmin(request);
    if (auth.error) return auth.error;

    const store = getStore();
    const users = store.getUsers();

    return NextResponse.json({
      users: users.map(serializeStaffUser),
    });
  } catch (err) {
    console.error('Users list error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = requireAdmin(request);
    if (auth.error) return auth.error;

    const body = await request.json();
    const { name, username, password, role, centerId } = body as {
      name?: string;
      username?: string;
      password?: string;
      role?: string;
      centerId?: string;
    };

    if (!name?.trim() || !username?.trim() || !password?.trim()) {
      return NextResponse.json({ error: 'Name, username, and password are required' }, { status: 400 });
    }

    if (role !== 'center_head' && role !== 'invigilator') {
      return NextResponse.json({ error: 'Role must be center_head or invigilator' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const normalizedUsername = username.trim().toLowerCase();
    if (!/^[a-z0-9._-]+$/.test(normalizedUsername)) {
      return NextResponse.json({ error: 'Username may only contain letters, numbers, dots, hyphens, and underscores' }, { status: 400 });
    }

    const store = getStore();
    if (store.getUserByUsername(normalizedUsername)) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
    }

    const user: User = {
      id: uuidv4(),
      username: normalizedUsername,
      passwordHash: '',
      passwordPlain: password,
      role,
      name: name.trim(),
      centerId: centerId?.trim() || 'center-001',
    };

    store.addUser(user);
    console.log(`[STAFF CREATE] Admin created ${role} "${user.name}" (${user.username})`);

    return NextResponse.json({
      success: true,
      message: `${role === 'center_head' ? 'Center Head' : 'Invigilator'} "${user.name}" created. They must log in and enroll their face before decrypting exams.`,
      user: serializeStaffUser(user),
    }, { status: 201 });
  } catch (err) {
    console.error('Create user error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = requireAdmin(request);
    if (auth.error) return auth.error;

    const body = await request.json();
    const { userId, action } = body as { userId?: string; action?: string };

    if (!userId || action !== 'reset_face') {
      return NextResponse.json({ error: 'userId and action=reset_face are required' }, { status: 400 });
    }

    const store = getStore();
    const existing = store.getUserById(userId);
    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (existing.role === 'admin') {
      return NextResponse.json({ error: 'Cannot reset admin face profile' }, { status: 403 });
    }

    const updated = store.resetUserFace(userId);
    if (!updated) {
      return NextResponse.json({ error: 'Failed to reset face profile' }, { status: 500 });
    }

    console.log(`[STAFF FACE RESET] Admin reset face for "${updated.name}"`);

    return NextResponse.json({
      success: true,
      message: `Face profile reset for ${updated.name}. They must re-enroll on next login.`,
      user: serializeStaffUser(updated),
    });
  } catch (err) {
    console.error('Update user error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

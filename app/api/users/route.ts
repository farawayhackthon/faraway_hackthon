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
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const store = getStore();
    const users = store.getUsers();

    return NextResponse.json({
      users: users.map(u => ({
        id: u.id,
        username: u.username,
        role: u.role,
        name: u.name,
        centerId: u.centerId,
      })),
    });
  } catch (err) {
    console.error('Users list error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

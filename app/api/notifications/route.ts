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
    const notifications = store.getNotificationsForUser(payload.userId);
    const unreadCount = store.getUnreadNotificationCount(payload.userId);

    return NextResponse.json({ notifications, unreadCount });
  } catch (err) {
    console.error('List notifications error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
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
    const store = getStore();

    if (body.markAll) {
      store.markAllNotificationsRead(payload.userId);
      return NextResponse.json({ success: true });
    }

    if (Array.isArray(body.ids) && body.ids.length > 0) {
      for (const id of body.ids) {
        store.markNotificationRead(id, payload.userId);
      }
      return NextResponse.json({
        success: true,
        unreadCount: store.getUnreadNotificationCount(payload.userId),
      });
    }

    return NextResponse.json({ error: 'No notification IDs provided' }, { status: 400 });
  } catch (err) {
    console.error('Update notifications error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

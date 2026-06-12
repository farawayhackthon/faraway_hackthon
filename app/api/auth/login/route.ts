import { NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { signToken } from '@/lib/jwt';
import { MOCK_CREDENTIALS } from '@/lib/credentials';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    const store = getStore();
    const user = store.getUserByUsername(username.trim().toLowerCase());

    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Mock credential check (plain-text for prototype simplicity)
    const validPassword =
      MOCK_CREDENTIALS[username as keyof typeof MOCK_CREDENTIALS]?.password === password;

    if (!validPassword) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = signToken({
      userId: user.id,
      username: user.username,
      role: user.role,
      centerId: user.centerId,
    });

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
        centerId: user.centerId,
        faceEnrolled: Boolean(user.faceDescriptor?.length),
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

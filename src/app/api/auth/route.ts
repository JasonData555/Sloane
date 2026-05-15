import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { signSessionToken } from '@/lib/session';

// ─── POST /api/auth ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { password } = body;
  const expected = process.env.LOGIN_PASSWORD;

  if (!password || !expected) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  let match = false;
  try {
    const a = Buffer.from(password);
    const b = Buffer.from(expected);
    match = a.length === b.length && timingSafeEqual(a, b);
  } catch {
    match = false;
  }

  if (!match) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  let token: string;
  try {
    token = signSessionToken('team@hitchpartners.com');
  } catch {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set('sloane_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60,
    path: '/',
  });

  return response;
}

// ─── DELETE /api/auth ─────────────────────────────────────────────────────────

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete('sloane_session');
  return response;
}

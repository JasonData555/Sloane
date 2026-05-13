import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getUserByResetToken, updatePinHash, clearResetToken } from '@/lib/users';

function isExpired(expiresIso: string | null): boolean {
  if (!expiresIso) return true;
  return new Date(expiresIso) < new Date();
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'Token required' }, { status: 400 });
  }

  try {
    const user = await getUserByResetToken(token);
    if (!user || !user.resetToken) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 });
    }
    if (isExpired(user.resetExpires)) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 410 });
    }
    return NextResponse.json({ email: user.email });
  } catch (err) {
    console.error('[auth/reset GET] error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: { token?: string; pin?: string; confirmPin?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { token, pin, confirmPin } = body;

  if (!token) {
    return NextResponse.json({ error: 'Token required' }, { status: 400 });
  }
  if (!pin || !confirmPin) {
    return NextResponse.json({ error: 'PIN and confirmation are required' }, { status: 400 });
  }
  if (pin !== confirmPin) {
    return NextResponse.json({ error: 'PINs do not match' }, { status: 400 });
  }
  if (!/^\d{4,8}$/.test(pin)) {
    return NextResponse.json({ error: 'PIN must be 4–8 digits' }, { status: 400 });
  }

  try {
    const user = await getUserByResetToken(token);
    if (!user || !user.resetToken) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 });
    }
    if (isExpired(user.resetExpires)) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 410 });
    }

    const pinHash = await bcrypt.hash(pin, 10);
    await updatePinHash(user.id, pinHash);
    await clearResetToken(user.id);
  } catch (err) {
    console.error('[auth/reset POST] error:', err);
    return NextResponse.json({ error: 'Server error — please try again' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

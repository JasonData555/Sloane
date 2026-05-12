import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { signSessionToken } from '@/lib/session';

// ─── Rate limiting ────────────────────────────────────────────────────────────
// In-memory — resets on server restart. Sufficient for Sprint 1 internal use.
// Replace with Redis/KV before exposing externally.

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(email: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(email);
  if (!entry || now > entry.resetAt) return true;
  return entry.count < MAX_ATTEMPTS;
}

function recordFailedAttempt(email: string): void {
  const now = Date.now();
  const entry = loginAttempts.get(email);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(email, { count: 1, resetAt: now + LOCKOUT_MS });
  } else {
    entry.count++;
  }
}

function clearAttempts(email: string): void {
  loginAttempts.delete(email);
}

// ─── POST /api/auth ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: { email?: string; pin?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { email, pin } = body;
  if (!email || !pin) {
    return NextResponse.json({ error: 'Email and PIN required' }, { status: 400 });
  }

  const emailLc = email.toLowerCase().trim();

  if (!checkRateLimit(emailLc)) {
    return NextResponse.json({ error: 'Too many attempts — try again later' }, { status: 429 });
  }

  // Parse USER_PINS safely — bad JSON must not crash the server
  let userPins: Record<string, string> = {};
  try {
    userPins = JSON.parse(process.env.USER_PINS ?? '{}');
  } catch {
    console.error('[auth] USER_PINS is not valid JSON');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  // Validate allowlist
  const allowedUsers = (process.env.ALLOWED_USERS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (allowedUsers.length && !allowedUsers.includes(emailLc)) {
    recordFailedAttempt(emailLc);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Validate PIN using timing-safe comparison
  // Note: PINs are stored in plaintext in USER_PINS env var for Sprint 1.
  // Add bcrypt/argon2 hashing before any external exposure.
  if (Object.keys(userPins).length > 0) {
    const expectedPin = userPins[emailLc] ?? '';
    let pinValid = false;
    try {
      const a = Buffer.from(pin);
      const b = Buffer.from(expectedPin);
      pinValid = a.length === b.length && timingSafeEqual(a, b);
    } catch {
      pinValid = false;
    }
    if (!pinValid) {
      recordFailedAttempt(emailLc);
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
  }

  clearAttempts(emailLc);

  let token: string;
  try {
    token = signSessionToken(emailLc);
  } catch {
    // LOGIN_SECRET not set
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

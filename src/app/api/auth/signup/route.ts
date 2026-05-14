import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getUserByEmail, createUser } from '@/lib/users';

const signupAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_SIGNUP_ATTEMPTS = 10;
const SIGNUP_WINDOW_MS = 60 * 60 * 1000;

function checkSignupRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = signupAttempts.get(ip);
  if (!entry || now > entry.resetAt) return true;
  return entry.count < MAX_SIGNUP_ATTEMPTS;
}

function recordSignupAttempt(ip: string): void {
  const now = Date.now();
  const entry = signupAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    signupAttempts.set(ip, { count: 1, resetAt: now + SIGNUP_WINDOW_MS });
  } else {
    entry.count++;
  }
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';

  if (!checkSignupRateLimit(ip)) {
    return NextResponse.json({ error: 'Too many requests — try again later' }, { status: 429 });
  }
  recordSignupAttempt(ip);

  let body: { name?: string; email?: string; pin?: string; confirmPin?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { name, email, pin, confirmPin } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }
  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }
  if (!email.toLowerCase().trim().endsWith('@hitchpartners.com')) {
    return NextResponse.json(
      { error: 'Sign-ups are restricted to @hitchpartners.com email addresses' },
      { status: 400 }
    );
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

  const emailLc = email.toLowerCase().trim();

  const missingVars = ['AIRTABLE_API_KEY', 'AIRTABLE_BASE_ID']
    .filter(v => !process.env[v]);
  if (missingVars.length > 0) {
    console.error('[auth/signup] Missing env vars:', missingVars.join(', '));
    return NextResponse.json({ error: 'Server error — please try again' }, { status: 500 });
  }

  try {
    const existing = await getUserByEmail(emailLc);
    if (existing) {
      return NextResponse.json({ error: 'That email is already registered' }, { status: 409 });
    }

    const pinHash = await bcrypt.hash(pin, 10);
    await createUser(name.trim(), emailLc, pinHash);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const code = (err as { statusCode?: number }).statusCode;
    console.error(`[auth/signup] error: ${msg}${code ? ` (HTTP ${code})` : ''}`);
    return NextResponse.json({ error: 'Server error — please try again' }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

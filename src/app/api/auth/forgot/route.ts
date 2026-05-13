import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { Resend } from 'resend';
import { getUserByEmail, setResetToken } from '@/lib/users';

const forgotAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_FORGOT_ATTEMPTS = 3;
const FORGOT_WINDOW_MS = 60 * 60 * 1000;

function checkForgotRateLimit(email: string): boolean {
  const now = Date.now();
  const entry = forgotAttempts.get(email);
  if (!entry || now > entry.resetAt) return true;
  return entry.count < MAX_FORGOT_ATTEMPTS;
}

function recordForgotAttempt(email: string): void {
  const now = Date.now();
  const entry = forgotAttempts.get(email);
  if (!entry || now > entry.resetAt) {
    forgotAttempts.set(email, { count: 1, resetAt: now + FORGOT_WINDOW_MS });
  } else {
    entry.count++;
  }
}

export async function POST(req: NextRequest) {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const { email } = body;
  if (!email) return NextResponse.json({ ok: true });

  const emailLc = email.toLowerCase().trim();

  if (!checkForgotRateLimit(emailLc)) {
    return NextResponse.json({ ok: true });
  }
  recordForgotAttempt(emailLc);

  try {
    const user = await getUserByEmail(emailLc);
    if (!user || user.status !== 'Active') return NextResponse.json({ ok: true });

    const token = randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600_000).toISOString();
    await setResetToken(emailLc, token, expires);

    const resend = new Resend(process.env.RESEND_API_KEY);
    const appUrl = (process.env.APP_URL ?? '').replace(/\/$/, '');
    const from = process.env.RESEND_FROM_EMAIL ?? 'noreply@hitchpartners.com';
    const resetLink = `${appUrl}/reset-password?token=${token}`;

    await resend.emails.send({
      from,
      to: emailLc,
      subject: 'Reset your Sloane PIN',
      html: `<p>Click the link below to reset your Sloane PIN. This link expires in 1 hour.</p><p><a href="${resetLink}">${resetLink}</a></p><p>If you did not request this, you can safely ignore this email.</p>`,
    });
  } catch (err) {
    console.error('[auth/forgot] error:', err);
  }

  return NextResponse.json({ ok: true });
}

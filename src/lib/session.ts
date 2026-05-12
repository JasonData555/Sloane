import { createHmac, timingSafeEqual } from 'crypto';

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function signSessionToken(email: string): string {
  const secret = process.env.LOGIN_SECRET ?? '';
  if (!secret) throw new Error('LOGIN_SECRET is not set');

  const payload = Buffer.from(
    JSON.stringify({ email: email.toLowerCase().trim(), exp: Date.now() + SESSION_TTL_MS })
  ).toString('base64url');

  const sig = createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string): { email: string } | null {
  const secret = process.env.LOGIN_SECRET ?? '';
  if (!secret) return null;

  const dotIdx = token.lastIndexOf('.');
  if (dotIdx === -1) return null;

  const payload = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);

  const expectedSig = createHmac('sha256', secret).update(payload).digest('hex');
  try {
    const a = Buffer.from(sig, 'hex');
    const b = Buffer.from(expectedSig, 'hex');
    if (a.length !== b.length) return null;
    if (!timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  let parsed: { email: string; exp: number };
  try {
    parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (!parsed.email || typeof parsed.exp !== 'number') return null;
  if (Date.now() > parsed.exp) return null;

  return { email: parsed.email };
}

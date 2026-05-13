import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/users', () => ({
  getUserByEmail: vi.fn(),
  createUser: vi.fn(),
}));

vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn().mockResolvedValue('$2b$10$hashedpin') },
}));

import { POST } from '../signup/route';
import { getUserByEmail, createUser } from '@/lib/users';

// Use a unique IP per request to avoid in-memory rate-limit accumulation across tests
let ipCounter = 0;
function makeRequest(body: Record<string, unknown>) {
  ipCounter++;
  return new Request('http://localhost/api/auth/signup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': `10.0.0.${ipCounter}`,
    },
    body: JSON.stringify(body),
  }) as unknown as import('next/server').NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getUserByEmail).mockResolvedValue(null);
  vi.mocked(createUser).mockResolvedValue(undefined);
});

describe('POST /api/auth/signup — domain validation', () => {
  it('rejects non-hitchpartners.com email with 400', async () => {
    const res = await POST(makeRequest({
      name: 'Test User', email: 'user@gmail.com', pin: '1234', confirmPin: '1234',
    }));
    expect(res.status).toBe(400);
    const data = await res.json() as { error: string };
    expect(data.error).toMatch(/hitchpartners\.com/);
  });

  it('accepts @hitchpartners.com email', async () => {
    const res = await POST(makeRequest({
      name: 'Test User', email: 'user@hitchpartners.com', pin: '1234', confirmPin: '1234',
    }));
    expect(res.status).toBe(201);
  });

  it('is case-insensitive on domain check', async () => {
    const res = await POST(makeRequest({
      name: 'Test User', email: 'User@HitchPartners.COM', pin: '1234', confirmPin: '1234',
    }));
    expect(res.status).toBe(201);
  });
});

describe('POST /api/auth/signup — PIN validation', () => {
  const base = { name: 'Test User', email: 'user@hitchpartners.com' };

  it('rejects mismatched PINs with 400', async () => {
    const res = await POST(makeRequest({ ...base, pin: '1234', confirmPin: '5678' }));
    expect(res.status).toBe(400);
    const data = await res.json() as { error: string };
    expect(data.error).toMatch(/match/i);
  });

  it('rejects PIN shorter than 4 digits', async () => {
    const res = await POST(makeRequest({ ...base, pin: '123', confirmPin: '123' }));
    expect(res.status).toBe(400);
  });

  it('rejects PIN with non-numeric characters', async () => {
    const res = await POST(makeRequest({ ...base, pin: 'abcd', confirmPin: 'abcd' }));
    expect(res.status).toBe(400);
  });

  it('accepts 4-digit PIN', async () => {
    const res = await POST(makeRequest({ ...base, pin: '1234', confirmPin: '1234' }));
    expect(res.status).toBe(201);
  });

  it('accepts 8-digit PIN', async () => {
    const res = await POST(makeRequest({ ...base, pin: '12345678', confirmPin: '12345678' }));
    expect(res.status).toBe(201);
  });

  it('rejects PIN longer than 8 digits', async () => {
    const res = await POST(makeRequest({ ...base, pin: '123456789', confirmPin: '123456789' }));
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/signup — duplicate check', () => {
  it('returns 409 when email already registered', async () => {
    vi.mocked(getUserByEmail).mockResolvedValue({
      id: 'rec1', name: 'Existing', email: 'user@hitchpartners.com',
      pinHash: 'hash', status: 'Active', resetToken: null, resetExpires: null,
    });
    const res = await POST(makeRequest({
      name: 'Test', email: 'user@hitchpartners.com', pin: '1234', confirmPin: '1234',
    }));
    expect(res.status).toBe(409);
  });
});

describe('POST /api/auth/signup — required fields', () => {
  it('returns 400 when name is missing', async () => {
    const res = await POST(makeRequest({ email: 'user@hitchpartners.com', pin: '1234', confirmPin: '1234' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when email is missing', async () => {
    const res = await POST(makeRequest({ name: 'Test', pin: '1234', confirmPin: '1234' }));
    expect(res.status).toBe(400);
  });
});

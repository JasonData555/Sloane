import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCreate, mockSelectAll, mockUpdate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockSelectAll: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock('airtable', () => {
  // Must use `function` keyword — arrow functions cannot be used as constructors
  const AirtableMock = vi.fn(function (this: unknown) {
    return {
      base: vi.fn().mockReturnValue(
        vi.fn(function () {
          return {
            create: mockCreate,
            select: vi.fn().mockReturnValue({ all: mockSelectAll }),
            update: mockUpdate,
          };
        })
      ),
    };
  });
  return { default: AirtableMock };
});

process.env.AIRTABLE_API_KEY = 'test-api-key';
process.env.AIRTABLE_BASE_ID = 'test-base-id';
process.env.AIRTABLE_USERS_TABLE_ID = 'test-table-id';

import {
  createUser,
  getUserByEmail,
  setResetToken,
  getUserByResetToken,
  updatePinHash,
  clearResetToken,
} from '../users';

const mockRecord = (overrides: Record<string, unknown> = {}) => ({
  id: 'rec123',
  fields: {
    'Name': 'Jane Smith',
    'Email': 'jane@hitchpartners.com',
    'Pin Hash': '$2b$10$hashedpin',
    'Status': 'Active',
    'Reset Token': null,
    'Reset Expires': null,
    ...overrides,
  },
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createUser', () => {
  it('calls Airtable create with correct fields', async () => {
    mockCreate.mockResolvedValue({});
    await createUser('Jane Smith', 'jane@hitchpartners.com', '$2b$10$hashedpin');
    expect(mockCreate).toHaveBeenCalledWith({
      'Name': 'Jane Smith',
      'Email': 'jane@hitchpartners.com',
      'Pin Hash': '$2b$10$hashedpin',
      'Status': 'Active',
    });
  });
});

describe('getUserByEmail', () => {
  it('returns a correctly shaped user when found', async () => {
    mockSelectAll.mockResolvedValue([mockRecord()]);
    const user = await getUserByEmail('jane@hitchpartners.com');
    expect(user).toMatchObject({
      id: 'rec123',
      name: 'Jane Smith',
      email: 'jane@hitchpartners.com',
      status: 'Active',
    });
  });

  it('returns null when no record found', async () => {
    mockSelectAll.mockResolvedValue([]);
    const user = await getUserByEmail('unknown@hitchpartners.com');
    expect(user).toBeNull();
  });
});

describe('setResetToken', () => {
  it('updates the record with token and expiry', async () => {
    mockSelectAll.mockResolvedValue([mockRecord()]);
    mockUpdate.mockResolvedValue({});
    await setResetToken('jane@hitchpartners.com', 'abc123token', '2026-05-14T00:00:00.000Z');
    expect(mockUpdate).toHaveBeenCalledWith('rec123', {
      'Reset Token': 'abc123token',
      'Reset Expires': '2026-05-14T00:00:00.000Z',
    });
  });

  it('does nothing when user not found', async () => {
    mockSelectAll.mockResolvedValue([]);
    await setResetToken('nobody@hitchpartners.com', 'token', 'expires');
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe('getUserByResetToken', () => {
  it('returns user when token matches', async () => {
    mockSelectAll.mockResolvedValue([
      mockRecord({ 'Reset Token': 'abc123token', 'Reset Expires': '2099-01-01T00:00:00.000Z' }),
    ]);
    const user = await getUserByResetToken('abc123token');
    expect(user).not.toBeNull();
    expect(user?.resetToken).toBe('abc123token');
  });

  it('returns null when token not found', async () => {
    mockSelectAll.mockResolvedValue([]);
    const user = await getUserByResetToken('nosuchtoken');
    expect(user).toBeNull();
  });
});

describe('updatePinHash', () => {
  it('calls update with new hash', async () => {
    mockUpdate.mockResolvedValue({});
    await updatePinHash('rec123', '$2b$10$newhash');
    expect(mockUpdate).toHaveBeenCalledWith('rec123', { 'Pin Hash': '$2b$10$newhash' });
  });
});

describe('clearResetToken', () => {
  it('clears token and expiry fields', async () => {
    mockUpdate.mockResolvedValue({});
    await clearResetToken('rec123');
    expect(mockUpdate).toHaveBeenCalledWith('rec123', {
      'Reset Token': '',
      'Reset Expires': '',
    });
  });
});

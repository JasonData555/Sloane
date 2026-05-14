import Airtable from 'airtable';

export interface AirtableUser {
  id: string;
  name: string;
  email: string;
  pinHash: string;
  status: 'Active' | 'Inactive';
  resetToken: string | null;
  resetExpires: string | null;
}

function getTable() {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableId = process.env.AIRTABLE_USERS_TABLE_ID ?? 'tblfQG7HXOZyjqpxu';
  if (!apiKey) throw new Error('AIRTABLE_API_KEY is not set');
  if (!baseId) throw new Error('AIRTABLE_BASE_ID is not set');
  return new Airtable({ apiKey }).base(baseId)(tableId);
}

function sanitize(value: string): string {
  return value.replace(/[{}"\\]/g, '').slice(0, 200);
}

function parseUser(r: Airtable.Record<Airtable.FieldSet>): AirtableUser {
  const f = r.fields as Record<string, unknown>;
  return {
    id: r.id,
    name: (f['Name'] as string) ?? '',
    email: (f['Email'] as string) ?? '',
    pinHash: (f['Pin Hash'] as string) ?? '',
    status: (f['Status'] as string) === 'Active' ? 'Active' : 'Inactive',
    resetToken: (f['Reset Token'] as string) || null,
    resetExpires: (f['Reset Expires'] as string) || null,
  };
}

export async function createUser(name: string, email: string, pinHash: string): Promise<void> {
  const table = getTable();
  await table.create({
    'Name': name,
    'Email': email,
    'Pin Hash': pinHash,
    'Status': 'Active',
  } as Airtable.FieldSet);
}

export async function getUserByEmail(email: string): Promise<AirtableUser | null> {
  const table = getTable();
  const records = await table.select({
    filterByFormula: `{Email} = "${sanitize(email)}"`,
    maxRecords: 1,
  }).all();
  return records.length > 0 ? parseUser(records[0]) : null;
}

export async function setResetToken(email: string, token: string, expiresIso: string): Promise<void> {
  const user = await getUserByEmail(email);
  if (!user) return;
  const table = getTable();
  await table.update(user.id, {
    'Reset Token': token,
    'Reset Expires': expiresIso,
  } as Airtable.FieldSet);
}

export async function getUserByResetToken(token: string): Promise<AirtableUser | null> {
  const table = getTable();
  const records = await table.select({
    filterByFormula: `{Reset Token} = "${sanitize(token)}"`,
    maxRecords: 1,
  }).all();
  return records.length > 0 ? parseUser(records[0]) : null;
}

export async function updatePinHash(recordId: string, pinHash: string): Promise<void> {
  const table = getTable();
  await table.update(recordId, { 'Pin Hash': pinHash } as Airtable.FieldSet);
}

export async function clearResetToken(recordId: string): Promise<void> {
  const table = getTable();
  await table.update(recordId, {
    'Reset Token': '',
    'Reset Expires': '',
  } as Airtable.FieldSet);
}

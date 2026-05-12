import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/session';
import { listSearches, getSloaneRecord } from '@/lib/airtable';

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get('sloane_session')?.value ?? '';
  if (!verifySessionToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const resource = searchParams.get('resource');

  if (resource === 'searches') {
    try {
      const searches = await listSearches();
      return NextResponse.json({ searches });
    } catch {
      return NextResponse.json(
        { error: "I'm having trouble connecting to Airtable right now. Please try again in a moment." },
        { status: 503 }
      );
    }
  }

  if (resource === 'conversation') {
    const searchId = searchParams.get('searchId');
    if (!searchId) return NextResponse.json({ error: 'searchId required' }, { status: 400 });
    try {
      const record = await getSloaneRecord(searchId);
      return NextResponse.json({
        messages: record?.conversationHistory ?? [],
        stage: record?.stage ?? 'Calibration',
      });
    } catch {
      return NextResponse.json({ messages: [], stage: 'Calibration' });
    }
  }

  return NextResponse.json({ error: 'Unknown resource' }, { status: 400 });
}

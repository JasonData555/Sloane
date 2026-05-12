import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { timingSafeEqual } from 'crypto';
import { z } from 'zod';
import {
  getSloaneRecordById,
  getSearchById,
  writeJdPdfToSloane,
  updateSloaneRecord,
} from '@/lib/airtable';
import { generateJdPdf } from '@/lib/pdf';

// ─── Auth ─────────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const provided = req.headers.get('x-internal-key') ?? '';
  const expected = process.env.INTERNAL_API_KEY ?? '';
  if (!expected) return process.env.NODE_ENV !== 'production'; // allow in dev if unset
  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ─── Request schema ───────────────────────────────────────────────────────────

const RequestSchema = z.object({
  sloaneRecordId: z.string().min(1),
});

// ─── POST /api/jd-pdf ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
  }

  const { sloaneRecordId } = parsed.data;

  const sloaneRecord = await getSloaneRecordById(sloaneRecordId).catch(() => null);
  if (!sloaneRecord) {
    return NextResponse.json({ error: `Sloane record not found: ${sloaneRecordId}` }, { status: 404 });
  }

  if (!sloaneRecord.jdWorkingCopy) {
    return NextResponse.json({ error: 'No JD working copy to render' }, { status: 400 });
  }

  const searchRecord = await getSearchById(sloaneRecord.searchId).catch(() => null);
  const clientName = searchRecord?.clientName ?? sloaneRecord.searchParameters.companyName ?? 'Unknown';
  const placementPos = searchRecord?.placementPos ?? sloaneRecord.searchParameters.role ?? 'Unknown';

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generateJdPdf({
      clientName,
      placementPos,
      jdContent: sloaneRecord.jdWorkingCopy,
      clientLogoUrl: searchRecord?.clientLogoUrl ?? null,
    });
  } catch (err) {
    console.error('[jd-pdf] PDF render error:', err);
    return NextResponse.json({ error: 'PDF render failed' }, { status: 500 });
  }

  const filename = `${clientName}_${placementPos}_JD.pdf`.replace(/[^a-zA-Z0-9_.-]/g, '_');

  let pdfUrl: string;
  try {
    const { url } = await put(`jd/${sloaneRecordId}/${filename}`, pdfBuffer, {
      access: 'public',
      contentType: 'application/pdf',
    });
    pdfUrl = url;
  } catch (err) {
    console.error('[jd-pdf] Blob upload error:', err);
    return NextResponse.json({ error: 'PDF upload failed' }, { status: 500 });
  }

  try {
    await writeJdPdfToSloane(sloaneRecordId, pdfUrl, filename);

    // Set permalink if not already set
    if (!sloaneRecord.jdPdfUrl) {
      await updateSloaneRecord(sloaneRecordId, { jdPdfUrl: pdfUrl });
    }
  } catch (err) {
    console.error('[jd-pdf] Airtable write error:', err);
    return NextResponse.json(
      { error: `PDF generated but Airtable write failed: ${pdfUrl}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ pdfUrl, filename, clientName, placementPos });
}

/**
 * PDF generation — TypeScript port of HitchAgent lib/pdf-render.js + lib/fetch-image.js.
 * Uses puppeteer-core + @sparticuz/chromium for Vercel/Lambda compatibility.
 * Local dev: set CHROME_EXECUTABLE_PATH in .env.local.
 * All images must be embedded as base64 data URIs — Chromium blocks external requests.
 */

import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

// ─── SSRF protection ──────────────────────────────────────────────────────────

const ALLOWED_HOSTS = [
  'airtable.com',
  'airtableusercontent.com',
  'raw.githubusercontent.com',
  'blob.vercel-storage.com',
];

export function assertSafeUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  if (parsed.protocol !== 'https:') {
    throw new Error(`Non-HTTPS URL blocked: ${parsed.protocol}`);
  }

  const hostname = parsed.hostname.toLowerCase();
  const allowed = ALLOWED_HOSTS.some(
    (h) => hostname === h || hostname.endsWith('.' + h)
  );

  if (!allowed) {
    throw new Error(`Disallowed host blocked: ${hostname}`);
  }
}

// ─── Image fetching ───────────────────────────────────────────────────────────

export function guessMimeType(url: string): string {
  if (!url) return 'image/png';
  const lower = url.toLowerCase();
  if (lower.includes('.jpg') || lower.includes('.jpeg')) return 'image/jpeg';
  if (lower.includes('.gif')) return 'image/gif';
  return 'image/png';
}

export async function imageToBase64(
  url: string,
  mimeType = 'image/png'
): Promise<string | null> {
  try {
    assertSafeUrl(url);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    let res: Response;
    try {
      res = await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    return `data:${mimeType};base64,${base64}`;
  } catch {
    return null;
  }
}

// ─── Chromium / Puppeteer ─────────────────────────────────────────────────────

const LOCAL_CHROME_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
];

const isLocalDev = Boolean(process.env.CHROME_EXECUTABLE_PATH);

async function getExecutablePath(): Promise<string> {
  if (isLocalDev) return process.env.CHROME_EXECUTABLE_PATH!;
  return chromium.executablePath();
}

// ─── HTML → PDF renderer ──────────────────────────────────────────────────────

export async function renderHtmlToPdf(
  htmlString: string,
  opts: { landscape?: boolean; bottomMargin?: string } = {}
): Promise<Buffer> {
  const { landscape = false, bottomMargin = '0.5in' } = opts;
  const executablePath = await getExecutablePath();

  const browser = await puppeteer.launch({
    args: isLocalDev ? LOCAL_CHROME_ARGS : chromium.args,
    defaultViewport: landscape
      ? { width: 1056, height: 816 }
      : { width: 816, height: 1056 },
    executablePath,
    headless: true,
  });

  let pdf: Buffer;
  try {
    const page = await browser.newPage();

    await page.goto('about:blank');

    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (req.url().startsWith('data:') || req.url() === 'about:blank') {
        req.continue();
      } else {
        req.abort();
      }
    });

    await page.emulateMediaType('print');
    await page.setContent(htmlString, { waitUntil: 'domcontentloaded' });

    const rawPdf = await page.pdf({
      format: 'Letter',
      landscape,
      printBackground: true,
      margin: { top: '0.5in', right: '0.5in', bottom: bottomMargin, left: '0.5in' },
    });

    pdf = Buffer.from(rawPdf);
  } finally {
    await browser.close();
  }

  return pdf;
}

// ─── JD HTML builder ──────────────────────────────────────────────────────────

interface JdHtmlData {
  clientName: string;
  placementPos: string;
  jdContent: string;
  hitchLogoDataUri: string | null;
  clientLogoDataUri: string | null;
}

// Minimal markdown-to-HTML: converts headings, bold, bullet lists, paragraphs.
function mdToHtml(md: string): string {
  return md
    .split('\n')
    .map((line) => {
      if (/^### /.test(line)) return `<h3>${line.slice(4)}</h3>`;
      if (/^## /.test(line)) return `<h2>${line.slice(3)}</h2>`;
      if (/^# /.test(line)) return `<h1>${line.slice(2)}</h1>`;
      if (/^[-*] /.test(line)) return `<li>${line.slice(2).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</li>`;
      if (line.trim() === '') return '<br>';
      return `<p>${line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</p>`;
    })
    .join('\n')
    .replace(/(<li>.*<\/li>(\n|$))+/g, (match) => `<ul>${match}</ul>`);
}

export function buildJdHtml(data: JdHtmlData): string {
  const { clientName, placementPos, jdContent, hitchLogoDataUri, clientLogoDataUri } = data;

  const hitchLogoHtml = hitchLogoDataUri
    ? `<img src="${hitchLogoDataUri}" alt="Hitch Partners" class="logo hitch-logo">`
    : `<span class="logo-text">Hitch Partners</span>`;

  const clientLogoHtml = clientLogoDataUri
    ? `<img src="${clientLogoDataUri}" alt="${clientName}" class="logo client-logo">`
    : `<span class="logo-text">${clientName}</span>`;

  const bodyHtml = mdToHtml(jdContent);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 10pt;
    line-height: 1.5;
    color: #1a1a2e;
    background: #ffffff;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 12pt;
    border-bottom: 2pt solid #0f3460;
    margin-bottom: 16pt;
  }
  .logo { max-height: 36pt; max-width: 120pt; object-fit: contain; }
  .logo-text {
    font-size: 11pt;
    font-weight: 600;
    color: #0f3460;
  }
  .title-block {
    margin-bottom: 20pt;
  }
  .title-block h1 {
    font-size: 18pt;
    font-weight: 700;
    color: #0f3460;
    margin-bottom: 4pt;
  }
  .title-block .company {
    font-size: 12pt;
    color: #555;
  }
  .body h2 {
    font-size: 12pt;
    font-weight: 700;
    color: #0f3460;
    margin-top: 16pt;
    margin-bottom: 6pt;
    border-bottom: 0.5pt solid #ddd;
    padding-bottom: 3pt;
  }
  .body h3 {
    font-size: 11pt;
    font-weight: 600;
    color: #333;
    margin-top: 10pt;
    margin-bottom: 4pt;
  }
  .body p {
    margin-bottom: 6pt;
    color: #333;
  }
  .body ul {
    margin: 6pt 0 8pt 16pt;
    padding: 0;
  }
  .body li {
    margin-bottom: 3pt;
    color: #333;
  }
  .body strong { color: #1a1a2e; }
  .footer {
    margin-top: 24pt;
    padding-top: 8pt;
    border-top: 0.5pt solid #ddd;
    font-size: 8pt;
    color: #999;
    text-align: center;
  }
</style>
</head>
<body>
  <div class="header">
    ${hitchLogoHtml}
    ${clientLogoHtml}
  </div>
  <div class="title-block">
    <h1>${placementPos}</h1>
    <div class="company">${clientName}</div>
  </div>
  <div class="body">
    ${bodyHtml}
  </div>
  <div class="footer">Prepared by Hitch Partners — Confidential</div>
</body>
</html>`;
}

// ─── Public entry point ───────────────────────────────────────────────────────

interface GenerateJdPdfOptions {
  clientName: string;
  placementPos: string;
  jdContent: string;
  clientLogoUrl: string | null;
}

export async function generateJdPdf(opts: GenerateJdPdfOptions): Promise<Buffer> {
  const { clientName, placementPos, jdContent, clientLogoUrl } = opts;

  const hitchLogoUrl = process.env.HITCH_LOGO_URL ?? null;

  const [hitchLogoDataUri, clientLogoDataUri] = await Promise.all([
    hitchLogoUrl
      ? imageToBase64(hitchLogoUrl, guessMimeType(hitchLogoUrl)).catch(() => null)
      : Promise.resolve(null),
    clientLogoUrl
      ? imageToBase64(clientLogoUrl, guessMimeType(clientLogoUrl)).catch(() => null)
      : Promise.resolve(null),
  ]);

  const html = buildJdHtml({
    clientName,
    placementPos,
    jdContent,
    hitchLogoDataUri,
    clientLogoDataUri,
  });

  return renderHtmlToPdf(html, { landscape: false, bottomMargin: '0.5in' });
}

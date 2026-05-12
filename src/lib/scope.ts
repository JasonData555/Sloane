import type { ScopeExtractionResult } from '@/types/sloane';
import { extractScope as claudeExtractScope } from '@/lib/claude';

// Re-export the Claude-level extractor so callers only need scope.ts
export { claudeExtractScope as extractScope };

// ─── Prompt rendering ─────────────────────────────────────────────────────────

export function renderScopePrompt(
  profileText: string,
  resumeText: string | null,
  targetTeamSize: number
): string {
  const template = process.env.SCOPE_EXTRACTION_PROMPT;
  if (!template) throw new Error('SCOPE_EXTRACTION_PROMPT is not set');

  return template
    .replace('{PROFILE_TEXT}', profileText)
    .replace('{RESUME_TEXT}', resumeText ?? 'null')
    .replace('{SEARCH_TARGET_TEAM_SIZE}', String(targetTeamSize));
}

// ─── Result parsing ───────────────────────────────────────────────────────────

export function parseScopeResult(raw: string): ScopeExtractionResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid scope extraction JSON: ${raw.slice(0, 200)}`);
  }

  const r = parsed as Record<string, unknown>;

  if (typeof r.rci_scope_score !== 'number') {
    throw new Error('Scope result missing rci_scope_score');
  }
  if (!Array.isArray(r.role_title_history)) {
    throw new Error('Scope result missing role_title_history');
  }

  return parsed as ScopeExtractionResult;
}

// ─── Resume text extraction ───────────────────────────────────────────────────

export async function fetchResumeText(resumeUrl: string): Promise<string | null> {
  try {
    // SSRF guard — only allow Airtable CDN attachment URLs
    const parsed = new URL(resumeUrl);
    if (parsed.protocol !== 'https:') return null;
    const hostname = parsed.hostname.toLowerCase();
    const allowed =
      hostname === 'airtableusercontent.com' ||
      hostname.endsWith('.airtableusercontent.com');
    if (!allowed) return null;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);

    let res: Response;
    try {
      res = await fetch(resumeUrl, { signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!res.ok) return null;

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Dynamically import pdf-parse to avoid issues with server-only module
    const pdfModule = await import('pdf-parse');
    const pdfParse = (pdfModule as unknown as { default: (buf: Buffer) => Promise<{ text: string }> }).default ?? pdfModule;
    const data = await (pdfParse as (buf: Buffer) => Promise<{ text: string }>)(buffer);
    return data.text?.trim() || null;
  } catch {
    return null;
  }
}

// ─── Concurrency limiter ──────────────────────────────────────────────────────

function createSemaphore(max: number) {
  let running = 0;
  const queue: Array<() => void> = [];

  return function acquire<T>(fn: () => Promise<T>): Promise<T> {
    const run = (): Promise<T> => {
      running++;
      return fn().finally(() => {
        running--;
        queue.shift()?.();
      });
    };

    if (running < max) return run();

    return new Promise<T>((resolve, reject) => {
      queue.push(() => run().then(resolve, reject));
    });
  };
}

// ─── Batch runner ─────────────────────────────────────────────────────────────

export interface CandidateInput {
  id: string;
  name: string;
  profileText: string;
  resumeUrl?: string;
}

export interface BatchResult {
  candidateId: string;
  scope: ScopeExtractionResult | null;
  error: string | null;
}

const BATCH_CONCURRENCY = 5;

export async function processBatch(
  candidates: CandidateInput[],
  targetTeamSize: number
): Promise<BatchResult[]> {
  const limit = createSemaphore(BATCH_CONCURRENCY);

  return Promise.all(
    candidates.map((c): Promise<BatchResult> =>
      limit(async () => {
        try {
          const resumeText = c.resumeUrl ? await fetchResumeText(c.resumeUrl) : null;
          const scope = await claudeExtractScope(c.profileText, resumeText, targetTeamSize);
          return { candidateId: c.id, scope, error: null };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`[scope] Failed for candidate ${c.id}: ${message}`);
          return { candidateId: c.id, scope: null, error: message };
        }
      })
    )
  );
}

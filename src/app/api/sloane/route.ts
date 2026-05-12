import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { z } from 'zod';
import { verifySessionToken } from '@/lib/session';
import { classifyIntent } from '@/lib/intent';
import {
  getSloaneRecord,
  createSloaneRecord,
  updateSloaneRecord,
  getSearchById,
  readRubric,
  queryPeopleByRCI,
  findPeopleByLinkedIn,
  findPeopleByLinkedInFull,
  writeSourcingQueueRecord,
  writeJdPdfToSloane,
} from '@/lib/airtable';
import {
  researchCompany,
  generateRCIBaseline,
  generateJD,
} from '@/lib/claude';
import { scoreCandidate, calculateScoutTarget } from '@/lib/rci';
import { getHelpText } from '@/config/commands';
import { processBatch } from '@/lib/scope';
import { generateJdPdf } from '@/lib/pdf';
import type {
  SloaneAPIResponse,
  ConversationMessage,
  SearchParameters,
  SearchStage,
  SloaneRecord,
  RCIBaseline,
  SlateEntry,
  TechnicalDepthLabel,
  ScoutSession,
  PeopleRecord,
} from '@/types/sloane';

// ─── Request schema ───────────────────────────────────────────────────────────

const RequestSchema = z.object({
  searchId: z.string().min(1),
  message: z.string().min(1).max(4000),
  userId: z.string().min(1).optional(),
});

// ─── POST /api/sloane ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Full HMAC session validation — middleware only checks cookie presence
  const token = req.cookies.get('sloane_session')?.value ?? '';
  const session = verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.email;

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

  const { searchId, message } = parsed.data;

  // Validate the searchId corresponds to a real Searches record
  const searchExists = await getSearchById(searchId).catch(() => null);
  if (!searchExists) {
    return NextResponse.json(
      { message: "I don't see that search set up in Airtable yet. Once the Searches record is created and linked, send me the command again and I'll get started.", intent: 'unknown', stage: 'Calibration' as SearchStage },
      { status: 200 }
    );
  }

  // Load or initialize Sloane record
  let sloaneRecord = await getSloaneRecord(searchId).catch(() => null);
  if (!sloaneRecord) {
    try {
      sloaneRecord = await createSloaneRecord(searchId);
    } catch {
      return NextResponse.json(
        { message: "I'm having trouble connecting to Airtable right now. Please try again in a moment.", intent: 'unknown', stage: 'Calibration' as SearchStage },
        { status: 200 }
      );
    }
  }

  // Load conversation history (reinitialize silently if malformed)
  let history = sloaneRecord.conversationHistory;
  if (!Array.isArray(history)) {
    console.error(`[sloane] Malformed conversation history for record ${sloaneRecord.id} — reinitializing`);
    history = [];
  }

  // Intent classification runs before all other logic
  const lastAssistant = [...history].reverse().find((m) => m.role === 'assistant');
  const intentResult = await classifyIntent(message, {
    activeSearchId: searchId,
    stage: sloaneRecord.stage,
    lastAssistantMessage: lastAssistant?.content,
  });

  // State-machine override: if we're in Calibration with company+role confirmed but
  // optional intake fields still missing, any non-unknown message is an intake response
  const awaitingOptionalAnswers =
    sloaneRecord.stage === 'Calibration' &&
    !!sloaneRecord.searchParameters.companyName &&
    sloaneRecord.searchParameters.builderOperatorPref === undefined &&
    sloaneRecord.searchParameters.boardReporting === undefined;
  if (awaitingOptionalAnswers && intentResult.intent === 'refine_search') {
    intentResult.intent = 'kickoff';
  }

  // Record user message — userId is the verified session email
  const userMessage: ConversationMessage = {
    role: 'user',
    content: message,
    timestamp: new Date().toISOString(),
    metadata: { intent: intentResult.intent, stage: sloaneRecord.stage, userId },
  };

  // ── SSE stream intents — handled before the switch ───────────────────────────

  if (intentResult.intent === 'run_vault_sweep') {
    const stream = buildVaultSweepStream(sloaneRecord, searchId, [...history, userMessage]);
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
      },
    });
  }

  if (intentResult.intent === 'run_scout') {
    const stream = buildExternalScoutStream(sloaneRecord, searchId, [...history, userMessage]);
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
      },
    });
  }

  // ── All other intents — JSON response ────────────────────────────────────────

  let responseText: string;
  let newStage = sloaneRecord.stage;

  try {
    switch (intentResult.intent) {
      case 'kickoff':
        ({ text: responseText, stage: newStage } = await handleKickoff(
          message,
          sloaneRecord.id,
          searchId,
          sloaneRecord.searchParameters ?? {},
          sloaneRecord.stage
        ));
        break;

      case 'status_request':
        responseText = buildStatusSummary(sloaneRecord.stage, sloaneRecord.searchParameters);
        break;

      case 'generate_jd':
        ({ text: responseText, stage: newStage } = await handleGenerateJD(sloaneRecord, searchId));
        break;

      case 'generate_pdf':
        ({ text: responseText } = await handleGeneratePDF(sloaneRecord, searchId));
        break;

      case 'refine_search': {
        const refinement: import('@/types/sloane').SearchRefinement = {
          type: 'other',
          value: message,
          appliedAt: new Date().toISOString(),
        };
        const updatedParams: SearchParameters = {
          ...sloaneRecord.searchParameters,
          refinements: [...(sloaneRecord.searchParameters.refinements ?? []), refinement],
        };
        await updateSloaneRecord(sloaneRecord.id, { searchParameters: updatedParams });
        responseText = "Noted. I've recorded that refinement — it will be applied when the next phase runs.";
        break;
      }

      case 'help':
        responseText = getHelpText();
        break;

      case 'unknown':
      default:
        responseText = "I didn't catch that — are you kicking off a new search, or do you need something on an existing one?";
        break;
    }
  } catch (err) {
    console.error('[sloane] Handler error:', err);
    responseText = "I ran into an issue on this step — please try the command again.";
  }

  // Persist conversation history
  const assistantMessage: ConversationMessage = {
    role: 'assistant',
    content: responseText,
    timestamp: new Date().toISOString(),
    metadata: { intent: intentResult.intent, stage: newStage },
  };

  try {
    const updatedHistory = [...history, userMessage, assistantMessage];
    await updateSloaneRecord(sloaneRecord.id, {
      conversationHistory: updatedHistory,
      ...(newStage !== sloaneRecord.stage ? { stage: newStage } : {}),
    });
  } catch (err) {
    console.error('[sloane] Failed to persist conversation history:', err);
  }

  const response: SloaneAPIResponse = {
    message: responseText,
    intent: intentResult.intent,
    stage: newStage,
  };

  return NextResponse.json(response);
}

// ─── Phase 1 runner ───────────────────────────────────────────────────────────

async function runPhase1(
  sloaneRecordId: string,
  searchId: string,
  params: SearchParameters
): Promise<{ text: string; stage: SearchStage }> {
  const companyName = params.companyName!;
  const role = params.role!;

  const [rubric, searchRecord] = await Promise.all([
    readRubric(searchId),
    getSearchById(searchId),
  ]);

  if (!rubric) {
    return {
      text: `I found the ${companyName} search record but the Rubric isn't complete yet. Once the ITI process is done and the Rubric is generated, I'm ready to go.`,
      stage: 'Calibration',
    };
  }

  const companyResearch = await researchCompany(companyName, role);
  const baseline = await generateRCIBaseline(rubric, companyResearch, params);

  const teamSizeStr = rubric.teamSizeToday ?? rubric.estTeamSize1824mo ?? null;

  await updateSloaneRecord(sloaneRecordId, {
    rciBaseline: baseline,
    teamSize: teamSizeStr ?? undefined,
    stage: 'JD Draft',
  });

  const confidenceNote =
    companyResearch.confidence === 'low'
      ? ` (company data confidence: low — using best available estimate)`
      : '';

  const text = [
    `Phase 1 complete. RCI Baseline for ${searchRecord?.clientName ?? companyName} — ${role}:`,
    ``,
    `Function: ${baseline.function}`,
    `Level: ${baseline.level}`,
    `Industry Tier: ${baseline.industryTier}${tierLabel(baseline.industryTier)}`,
    `Company Size: ${baseline.companySize}`,
    `Geography: ${baseline.geography}`,
    `Target Team Size: ${baseline.targetTeamSize}${teamSizeStr ? ` (from rubric: "${teamSizeStr}")` : ''}`,
    ``,
    `Company: ${companyResearch.notes}${confidenceNote}`,
    ``,
    `Ready for JD draft. Send "Draft the JD" when set.`,
  ].join('\n');

  return { text, stage: 'JD Draft' };
}

function tierLabel(tier: string): string {
  if (tier === 'A') return ' — FinServ / Defense / Crypto';
  if (tier === 'B') return ' — Tech / Healthcare / Infrastructure';
  if (tier === 'C') return ' — Retail / Gov / Education';
  return '';
}

// ─── Kickoff intake handler ───────────────────────────────────────────────────

async function handleKickoff(
  message: string,
  sloaneRecordId: string,
  searchId: string,
  existingParams: SearchParameters,
  currentStage: SearchStage
): Promise<{ text: string; stage: SearchStage }> {
  const extracted = extractKickoffInputs(message);

  // Resolve company and role from the Searches record if not already known
  const searchRecord = await getSearchById(searchId).catch(() => null);
  if (!searchRecord) {
    const companyHint = existingParams.companyName ?? extracted.companyName ?? 'this company';
    return {
      text: `I don't see a ${companyHint} search set up in Airtable yet. Once the Searches record is created and linked, send me the command again and I'll get started.`,
      stage: currentStage,
    };
  }

  const params: SearchParameters = {
    ...existingParams,
    // Populate company and role from Searches record as canonical source
    companyName: existingParams.companyName ?? searchRecord.clientName,
    role: existingParams.role ?? (searchRecord.placementPos || undefined),
    ...(extracted.builderOperatorPref ? { builderOperatorPref: extracted.builderOperatorPref } : {}),
    ...(extracted.boardReporting !== undefined ? { boardReporting: extracted.boardReporting } : {}),
    ...(extracted.northStarUrls?.length ? { northStarUrls: extracted.northStarUrls } : {}),
  };

  // Hard blocker — Rubric URL must be present on the Searches record before proceeding
  if (params.companyName && params.role) {
    if (!searchRecord.rubricUrl) {
      return {
        text: `I found the ${params.companyName} search record but the Rubric isn't complete yet. Once the ITI process is done and the Rubric is generated, I'm ready to go.`,
        stage: currentStage,
      };
    }
  }

  // Completeness check — max 2 questions per response
  const missing: string[] = [];
  if (!params.companyName) missing.push('company');
  if (!params.role) missing.push('role');

  if (missing.includes('company') && missing.includes('role')) {
    return {
      text: "What company and role are we filling? (e.g. \"BreachRx CISO\")",
      stage: currentStage,
    };
  }
  if (missing.includes('company')) {
    return { text: "What company is this search for?", stage: currentStage };
  }
  if (missing.includes('role')) {
    return { text: `What role are we filling at ${params.companyName}?`, stage: currentStage };
  }

  // Optional fields — ask as a pair if both missing
  const needsOptional = params.builderOperatorPref === undefined && params.boardReporting === undefined;
  if (needsOptional) {
    await updateSloaneRecord(sloaneRecordId, { searchParameters: params });
    return {
      text: `Got it. Before I run calibration — two quick questions:\n\n1. Builder, Operator, or Hybrid profile?\n2. Is board-level reporting a hard requirement?\n\nAlso, any North Star LinkedIn URLs to work from?`,
      stage: currentStage,
    };
  }

  // All inputs collected — persist and run Phase 1
  const northStarNote = !params.northStarUrls?.length
    ? " No North Stars provided — running in Inference mode."
    : '';

  await updateSloaneRecord(sloaneRecordId, {
    searchParameters: params,
    stage: 'Calibration',
    ...(params.northStarUrls?.[0] ? { northStarUrl: params.northStarUrls[0] } : {}),
  });

  // Run Phase 1 inline
  try {
    const phase1Result = await runPhase1(sloaneRecordId, searchId, params);
    if (northStarNote) {
      phase1Result.text = northStarNote.trim() + '\n\n' + phase1Result.text;
    }
    return phase1Result;
  } catch (err) {
    console.error('[sloane] Phase 1 error:', err);
    const firstLine = `Running calibration for ${params.companyName} — ${params.role}.${northStarNote}`;
    return {
      text: `${firstLine}\n\nI'm taking longer than expected on this step. Give me a moment.\n\nIf this persists, send "Start ${params.companyName}" again.`,
      stage: 'Calibration',
    };
  }
}

// ─── Kickoff input extraction ─────────────────────────────────────────────────

function extractKickoffInputs(message: string): Partial<SearchParameters> {
  const result: Partial<SearchParameters> = {};

  const urlMatches = message.match(/https?:\/\/(?:www\.)?linkedin\.com\/in\/[^\s,]+/gi);
  if (urlMatches?.length) result.northStarUrls = urlMatches;

  const lc = message.toLowerCase();
  if (/\bbuilder[- ]operator\b|\bhybrid\b/.test(lc)) result.builderOperatorPref = 'Hybrid';
  else if (/\boperator[- ]builder\b/.test(lc)) result.builderOperatorPref = 'Hybrid';
  else if (/\bbuilder\b/.test(lc)) result.builderOperatorPref = 'Builder';
  else if (/\boperator\b/.test(lc)) result.builderOperatorPref = 'Operator';

  if (/board[- ]level reporting|report(?:s|ing)? (?:to )?(?:the )?board|board reporting\s*(?:yes|required|true|\byes\b)|yes\s+(?:on|to)\s+board\s+reporting|\bboard\b.{0,20}\byes\b|\byes\b.{0,20}\bboard\b/i.test(message)) {
    result.boardReporting = true;
  } else if (/no board reporting|board reporting\s*no|\bno\b.{0,20}\bboard\b|\bboard\b.{0,20}\bno\b/i.test(lc)) {
    result.boardReporting = false;
  }

  return result;
}

// ─── Phase 2 — JD Draft ───────────────────────────────────────────────────────

async function handleGenerateJD(
  sloaneRecord: SloaneRecord,
  searchId: string
): Promise<{ text: string; stage: SearchStage }> {
  const { rciBaseline, searchParameters: params } = sloaneRecord;

  if (!rciBaseline) {
    const company = params.companyName ?? 'this search';
    return {
      text: `I need to run calibration before drafting the JD. Send "Start ${company}" to kick off Phase 1.`,
      stage: sloaneRecord.stage,
    };
  }

  const [rubric, searchRecord] = await Promise.all([
    readRubric(searchId),
    getSearchById(searchId),
  ]);

  if (!rubric) {
    return {
      text: "I can't find the rubric for this search. Make sure it's linked and try again.",
      stage: sloaneRecord.stage,
    };
  }

  const companyResearch = rciBaseline.companyResearch ?? {
    industryTier: rciBaseline.industryTier,
    companySizeBand: rciBaseline.companySize,
    fundingStage: 'Unknown',
    estimatedSecurityTeamSize: rciBaseline.targetTeamSize,
    confidence: 'low' as const,
    notes: '',
  };

  function formatContact(name: string | null, email: string | null, phone: string | null): string {
    return [name, email, phone].filter(Boolean).join('\n') || '(not specified)';
  }

  const contacts = {
    partner1: formatContact(searchRecord?.partner1Name ?? null, searchRecord?.partner1Email ?? null, searchRecord?.partner1Phone ?? null),
    partner2: formatContact(searchRecord?.partner2Name ?? null, searchRecord?.partner2Email ?? null, searchRecord?.partner2Phone ?? null),
    pm: formatContact(searchRecord?.pmName ?? null, searchRecord?.pmEmail ?? null, searchRecord?.pmPhone ?? null),
  };

  const jdText = await generateJD(rubric, rciBaseline, companyResearch, params, contacts);

  const updates: Parameters<typeof updateSloaneRecord>[1] = {
    jdWorkingCopy: jdText,
    jdStatus: 'Draft',
    stage: 'JD Draft',
  };

  // Write-once: only set JD Draft-Sloane if not already written
  if (!sloaneRecord.jdDraftSloane) {
    updates.jdDraftSloane = jdText;
  }

  await updateSloaneRecord(sloaneRecord.id, updates);

  // Generate and store PDF
  let pdfUrl: string | null = null;
  try {
    const clientName = searchRecord?.clientName ?? params.companyName ?? 'Unknown';
    const placementPos = searchRecord?.placementPos ?? params.role ?? 'Unknown';
    const pdfBuffer = await generateJdPdf({
      clientName,
      placementPos,
      jdContent: jdText,
      clientLogoUrl: searchRecord?.clientLogoUrl ?? null,
    });

    const filename = `${clientName}_${placementPos}_JD.pdf`.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const { url } = await put(`jd/${sloaneRecord.id}/${filename}`, pdfBuffer, {
      access: 'public',
      contentType: 'application/pdf',
      allowOverwrite: true,
    });
    pdfUrl = url;

    await writeJdPdfToSloane(sloaneRecord.id, url, filename);

    // Set JD-url permalink once — never regenerate
    if (!sloaneRecord.jdPdfUrl) {
      await updateSloaneRecord(sloaneRecord.id, { jdPdfUrl: url });
    }
  } catch (err) {
    console.error('[sloane] PDF generation error:', err);
    // Non-fatal — JD text is already written
  }

  const pdfNote = pdfUrl
    ? '\n\nPDF is attached to the Sloane record in Airtable.'
    : '\n\n(PDF generation encountered an issue — the draft text is saved in Airtable.)';

  return {
    text: `JD draft is ready. Review and edit the working copy in the JD Review interface in Airtable. When you're ready for the final PDF, just let me know.${pdfNote}`,
    stage: 'JD Draft',
  };
}

// ─── Phase 2 — PDF generation ─────────────────────────────────────────────────

async function handleGeneratePDF(
  sloaneRecord: SloaneRecord,
  searchId: string
): Promise<{ text: string }> {
  if (!sloaneRecord.jdWorkingCopy) {
    return { text: "There's no JD working copy to render yet. Draft the JD first." };
  }

  const searchRecord = await getSearchById(searchId);
  const clientName = searchRecord?.clientName ?? sloaneRecord.searchParameters.companyName ?? 'Unknown';
  const placementPos = searchRecord?.placementPos ?? sloaneRecord.searchParameters.role ?? 'Unknown';

  try {
    const pdfBuffer = await generateJdPdf({
      clientName,
      placementPos,
      jdContent: sloaneRecord.jdWorkingCopy,
      clientLogoUrl: searchRecord?.clientLogoUrl ?? null,
    });

    const filename = `${clientName}_${placementPos}_JD.pdf`.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const { url } = await put(`jd/${sloaneRecord.id}/${filename}`, pdfBuffer, {
      access: 'public',
      contentType: 'application/pdf',
      allowOverwrite: true,
    });

    await writeJdPdfToSloane(sloaneRecord.id, url, filename);

    return { text: `PDF generated. It's attached to the Sloane record in Airtable.` };
  } catch (err) {
    console.error('[sloane] generate_pdf error:', err);
    return { text: "I ran into an issue generating the PDF — please try the command again." };
  }
}

// ─── Phase 3 — Vault Sweep (SSE stream) ──────────────────────────────────────

function buildVaultSweepStream(
  sloaneRecord: SloaneRecord,
  searchId: string,
  historyWithUser: ConversationMessage[]
): ReadableStream {
  const encoder = new TextEncoder();

  function sseEvent(data: Record<string, unknown>): Uint8Array {
    return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
  }

  return new ReadableStream({
    async start(controller) {
      let summaryText = '';

      try {
        const baseline = sloaneRecord.rciBaseline;
        if (!baseline) {
          controller.enqueue(sseEvent({
            type: 'error',
            message: "I need an RCI Baseline before running the vault sweep. Run Phase 1 first.",
          }));
          controller.close();
          return;
        }

        const people = await queryPeopleByRCI(baseline);

        if (people.length === 0) {
          summaryText = "No candidates in the People database matched the search criteria.";
          controller.enqueue(sseEvent({ type: 'complete', summary: summaryText, total: 0, high: 0, calibration: 0, stretch: 0 }));
          await persistSweepComplete(sloaneRecord, historyWithUser, summaryText, [], baseline);
          controller.close();
          return;
        }

        const targetTeamSize = parseTeamSize(sloaneRecord.teamSize) ?? baseline.targetTeamSize;
        const batchSize = 10;
        const batches: typeof people[] = [];
        for (let i = 0; i < people.length; i += batchSize) {
          batches.push(people.slice(i, i + batchSize));
        }

        let errorCount = 0;
        const allSlateEntries: SlateEntry[] = [];
        const tierCounts = { high: 0, calibration: 0, stretch: 0 };

        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
          const batch = batches[batchIndex];

          const inputs = batch.map((p) => ({
            id: p.id,
            name: p.name,
            profileText: p.resumeText ?? p.currentTitle ?? 'No profile data available',
            resumeUrl: p.resumeUrl,
          }));

          const results = await processBatch(inputs, targetTeamSize);

          // Score + write each candidate in this batch
          const batchCandidates: Array<{
            name: string;
            rciScore: number;
            matchTier: string;
          }> = [];

          // Serialize writes to stay within Airtable's 5 req/s rate limit.
          // Each candidate makes 3 API calls (People lookup + dedup + create/update).
          for (const result of results) {
              if (result.error) {
                errorCount++;
                continue;
              }

              const person = batch.find((p) => p.id === result.candidateId)!;
              const rciResult = scoreCandidate(person, baseline, result.scope);

              // Track tier counts
              if (rciResult.matchTier === 'High') tierCounts.high++;
              else if (rciResult.matchTier === 'Calibration') tierCounts.calibration++;
              else tierCounts.stretch++;

              // People table lookup (person already in DB — link if possible)
              const linkedId = person.linkedinUrl
                ? await findPeopleByLinkedIn(person.linkedinUrl).catch(() => null)
                : null;

              const scope = result.scope;
              const sqId = await writeSourcingQueueRecord({
                candidateNameRaw: person.name,
                linkedinUrlRaw: person.linkedinUrl ?? '',
                searchId,
                source: 'Sweep',
                candidateLinkedId: linkedId ?? undefined,
                databaseMatchStatus: linkedId ? 'Matched' : 'Unmatched',
                rciScore: rciResult.total,
                adjRankScore: rciResult.total,
                matchTier: rciResult.matchTier,
                builderSignal: coerceBuilderSignal(scope?.builder_signal?.category),
                technicalDepth: coerceTechnicalDepth(scope?.technical_depth?.label),
                scopeConfidence: scope?.overall_confidence
                  ? (['high', 'medium', 'low'].includes(scope.overall_confidence)
                    ? ({ high: 'High', medium: 'Medium', low: 'Low' }[scope.overall_confidence] as 'High' | 'Medium' | 'Low')
                    : 'Low')
                  : 'Low',
                technicalDepthScore: scope?.technical_depth_score ?? 50,
                rciScopeScore: scope?.rci_scope_score ?? 0,
                anomalyFlag: scope?.team_size?.anomaly_flag ?? false,
                anomalyNote: scope?.team_size?.anomaly_note ?? undefined,
                tourOfDutySignal: scope?.tour_of_duty_signal ?? false,
                shortTenureFlag: scope?.short_tenure_flag ?? false,
                roleTitleHistory: scope?.role_title_history ?? [],
                sloaneMatchRationale: buildRationale(person.name, rciResult, scope?.overall_confidence ?? null),
                programDomains: scope?.program_breadth?.domains ?? [],
              }).catch((err) => {
                console.error('[sloane] Sourcing Queue write error:', err);
                return null;
              });

              if (sqId) {
                allSlateEntries.push({
                  sourcingQueueId: sqId,
                  linkedinUrl: person.linkedinUrl ?? '',
                  name: person.name,
                  rciScore: rciResult.total,
                  matchTier: rciResult.matchTier,
                  candidateId: linkedId ?? undefined,
                });
              }

              batchCandidates.push({
                name: person.name,
                rciScore: rciResult.total,
                matchTier: rciResult.matchTier,
              });
          }

          controller.enqueue(sseEvent({
            type: 'batch_complete',
            batchIndex: batchIndex + 1,
            total_batches: batches.length,
            candidates: batchCandidates,
          }));
        }

        // Sort slate by score descending
        allSlateEntries.sort((a, b) => b.rciScore - a.rciScore);

        // Persist internal slate + Scout Limiter fields in one write
        const vaultSweepCount = allSlateEntries.length;
        const existingCap = sloaneRecord.scoutSessionCap;
        await updateSloaneRecord(sloaneRecord.id, {
          internalSlate: allSlateEntries,
          stage: 'Vault Sweep',
          vaultSweepCount,
          scoutTarget: Math.max(0, 50 - vaultSweepCount),
          ...(existingCap == null || existingCap <= 0 ? { scoutSessionCap: 25 } : {}),
        });

        summaryText = buildSweepSummary(
          allSlateEntries,
          tierCounts,
          errorCount,
          sloaneRecord.rciBaseline
        );

        controller.enqueue(sseEvent({
          type: 'complete',
          summary: summaryText,
          total: allSlateEntries.length,
          ...tierCounts,
        }));

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[sloane] Vault sweep error:', msg.slice(0, 300));
        summaryText = "I ran into an issue on this step — please try the command again.";
        controller.enqueue(sseEvent({ type: 'error', message: summaryText }));
      }

      // Persist conversation history
      await persistSweepComplete(
        sloaneRecord,
        historyWithUser,
        summaryText,
        [],
        sloaneRecord.rciBaseline
      );

      controller.close();
    },
  });
}

async function persistSweepComplete(
  sloaneRecord: SloaneRecord,
  historyWithUser: ConversationMessage[],
  summaryText: string,
  _slateEntries: SlateEntry[],
  _baseline: RCIBaseline | null
): Promise<void> {
  const assistantMessage: ConversationMessage = {
    role: 'assistant',
    content: summaryText,
    timestamp: new Date().toISOString(),
    metadata: { intent: 'run_vault_sweep', stage: 'Vault Sweep' },
  };

  try {
    await updateSloaneRecord(sloaneRecord.id, {
      conversationHistory: [...historyWithUser, assistantMessage],
    });
  } catch (err) {
    console.error('[sloane] Failed to persist vault sweep conversation history:', err);
  }
}

function parseTeamSize(teamSizeStr: string | null): number | null {
  if (!teamSizeStr) return null;
  // Handles: "15 - 20" → 17, "10+" → 10, "12" → 12
  const rangeMatch = teamSizeStr.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (rangeMatch) {
    return Math.round((parseInt(rangeMatch[1]) + parseInt(rangeMatch[2])) / 2);
  }
  const singleMatch = teamSizeStr.match(/(\d+)/);
  if (singleMatch) return parseInt(singleMatch[1]);
  return null;
}

function buildRationale(
  name: string,
  rciResult: { total: number; matchTier: string; breakdown: Record<string, number> },
  confidence: string | null
): string {
  const { total, matchTier, breakdown } = rciResult;
  const parts: string[] = [`${name} — RCI ${total} (${matchTier})`];
  if (breakdown.function > 0) parts.push(`Function: ${breakdown.function}/30`);
  if (breakdown.level > 0) parts.push(`Level: ${breakdown.level}/20`);
  if (breakdown.scope > 0) parts.push(`Scope: ${breakdown.scope}/50`);
  if (confidence) parts.push(`Confidence: ${confidence}`);
  return parts.join(' | ');
}

function buildSweepSummary(
  slate: SlateEntry[],
  tiers: { high: number; calibration: number; stretch: number },
  errorCount: number,
  baseline: RCIBaseline | null
): string {
  const total = slate.length;
  const lines: string[] = [
    `Vault sweep complete. I pulled ${total + errorCount} internal candidate${total + errorCount !== 1 ? 's' : ''} and scored them against the ${baseline ? `${baseline.function} at ${baseline.companySize} baseline` : 'search baseline'}.`,
    ``,
    `— High Match (${tiers.high}): ${slate.filter((s) => s.matchTier === 'High').map((s) => s.name).join(', ') || 'none'}`,
    `— Calibration (${tiers.calibration}): ${slate.filter((s) => s.matchTier === 'Calibration').map((s) => s.name).join(', ') || 'none'}`,
    `— Stretch (${tiers.stretch}): ${slate.filter((s) => s.matchTier === 'Stretch').map((s) => s.name).slice(0, 5).join(', ') || 'none'}`,
  ];

  if (errorCount > 0) {
    lines.push(``, `I wasn't able to score ${errorCount} candidate${errorCount !== 1 ? 's' : ''} due to incomplete profile data — they've been excluded from the slate.`);
  }

  if (!baseline || !baseline.function) {
    lines.push(``, `Note: Function/Level/Industry fields aren't populated on People records yet — scores reflect scope extraction only. Results will sharpen once those fields are filled in.`);
  }

  lines.push(``, `Results are in Airtable → Sourcing Queue.`);

  return lines.join('\n');
}

// ─── Phase 4 — External Scout (SSE stream) ───────────────────────────────────

interface ApifyProfileData {
  name: string;
  headline: string | null;
  profileText: string;
  linkedinUrl: string;
}

// Sprint 3: replace with actual Apify REST API call (one profile per invocation)
async function scrapeLinkedInProfile(_linkedinUrl: string): Promise<ApifyProfileData | null> {
  // TODO (Sprint 3): POST to https://api.apify.com/v2/acts/{APIFY_ACTOR_ID}/run-sync
  // with { "linkedinUrl": _linkedinUrl } and return structured profile data.
  // Match the existing HitchAgent pattern exactly.
  return null;
}

// Sprint 3: replace with LinkedIn search to get candidate URL queue based on mode
async function getCandidateUrlQueue(
  _mode: 'north_star' | 'calibration',
  _sloaneRecord: SloaneRecord,
  _limit: number
): Promise<string[]> {
  // TODO (Sprint 3): In north_star mode, derive similar profiles from northStarUrl.
  // In calibration mode, use scopeFingerprint dimensions as LinkedIn search params.
  // Return up to _limit LinkedIn profile URLs.
  return [];
}

function buildExternalScoutStream(
  sloaneRecord: SloaneRecord,
  searchId: string,
  historyWithUser: ConversationMessage[]
): ReadableStream {
  const encoder = new TextEncoder();

  function sseEvent(data: Record<string, unknown>): Uint8Array {
    return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
  }

  return new ReadableStream({
    async start(controller) {
      let summaryText = '';

      try {
        const vaultSweepCount = sloaneRecord.vaultSweepCount ?? 0;
        const sessionCap = (sloaneRecord.scoutSessionCap != null && sloaneRecord.scoutSessionCap > 0)
          ? sloaneRecord.scoutSessionCap
          : 25;
        const limiter = calculateScoutTarget(vaultSweepCount, sessionCap);

        // BRANCH A — internal slate filled all 50 slots
        if (limiter.slateIsFull) {
          summaryText = "The internal slate filled the target at 50 candidates. Want me to run an external scout for additional options?";
          controller.enqueue(sseEvent({ type: 'complete', summary: summaryText }));
          await updateSloaneRecord(sloaneRecord.id, { stage: 'PM Review' });
          await persistScoutComplete(sloaneRecord, historyWithUser, summaryText);
          controller.close();
          return;
        }

        // Determine scout mode
        const mode: 'north_star' | 'calibration' | 'inference' = sloaneRecord.northStarUrl
          ? 'north_star'
          : sloaneRecord.scopeFingerprint
            ? 'calibration'
            : 'inference';

        // INFERENCE MODE — ask two questions before scraping
        if (mode === 'inference') {
          summaryText = [
            "Before I run the external scout, I need a couple of things:",
            "",
            "1. What seniority level and function are you targeting? (e.g. 'VP of Security, Financial Services')",
            "2. Are there any companies you want me to prioritize or exclude?",
          ].join('\n');
          controller.enqueue(sseEvent({ type: 'complete', summary: summaryText }));
          await persistScoutComplete(sloaneRecord, historyWithUser, summaryText);
          controller.close();
          return;
        }

        // BRANCH B or C — pre-scrape notification
        let preMessage: string;
        if (!limiter.sessionCapApplies) {
          preMessage = `Running external scout. Looking for ${limiter.scoutTarget} candidates to reach 50 total.`;
        } else {
          preMessage = `Running external scout. I found ${vaultSweepCount} internal candidates. Looking for ${limiter.scoutTarget} more externally — I'll source up to ${sessionCap} profiles this session and check back with you before continuing.`;
        }
        controller.enqueue(sseEvent({ type: 'status', message: preMessage }));

        // Initialize session tracker
        const session: ScoutSession = {
          sessionLimit: limiter.sessionLimit,
          scoutTarget: limiter.scoutTarget,
          sessionCap,
          profilesScraped: 0,
          candidatesWritten: 0,
          tierCounts: { high: 0, calibration: 0, stretch: 0 },
          consecutiveJsonErrors: 0,
        };

        const targetTeamSize = parseTeamSize(sloaneRecord.teamSize) ?? sloaneRecord.rciBaseline?.targetTeamSize ?? 0;
        const baseline = sloaneRecord.rciBaseline;
        const allExternalEntries: SlateEntry[] = [];

        const candidateUrls = await getCandidateUrlQueue(mode, sloaneRecord, limiter.sessionLimit);

        for (const linkedinUrl of candidateUrls) {
          if (session.profilesScraped >= limiter.sessionLimit) break;

          // Scrape one profile via Apify
          let profileData: ApifyProfileData | null = null;
          try {
            profileData = await scrapeLinkedInProfile(linkedinUrl);
          } catch (err) {
            console.error('[sloane] Apify scrape error for', linkedinUrl, err);
            session.profilesScraped++;
            continue;
          }

          session.profilesScraped++;
          if (!profileData) continue;

          // DNC check — must happen before any write
          const peopleMatch = await findPeopleByLinkedInFull(linkedinUrl);
          if (peopleMatch?.doNotContact) continue;

          // Scope extraction (batch of 1 — concurrency limit still applies)
          let scopeResult = null;
          try {
            const batchResults = await processBatch([{
              id: linkedinUrl,
              name: profileData.name,
              profileText: profileData.profileText,
            }], targetTeamSize);
            scopeResult = batchResults[0]?.scope ?? null;
            session.consecutiveJsonErrors = 0;
          } catch {
            session.consecutiveJsonErrors++;
            if (session.consecutiveJsonErrors >= 3) {
              summaryText = `I ran into repeated issues extracting scope data. Stopping the session after ${session.candidatesWritten} candidates.`;
              controller.enqueue(sseEvent({ type: 'error', message: summaryText }));
              break;
            }
            continue;
          }

          if (!scopeResult || !baseline) continue;

          // Score — external candidates have no structured RCI fields; scope is the primary signal
          const syntheticPerson: PeopleRecord = {
            id: linkedinUrl,
            name: profileData.name,
            currentTitle: profileData.headline ?? undefined,
            linkedinUrl,
            doNotContact: false,
          };
          const rciResult = scoreCandidate(syntheticPerson, baseline, scopeResult);

          // Write to Sourcing Queue (dedup handled inside writeSourcingQueueRecord)
          const sourcingQueueId = await writeSourcingQueueRecord({
            candidateNameRaw: profileData.name,
            linkedinUrlRaw: linkedinUrl,
            searchId,
            source: 'Scout',
            candidateLinkedId: peopleMatch?.id,
            databaseMatchStatus: peopleMatch ? 'Matched' : 'Unmatched',
            rciScore: rciResult.total,
            adjRankScore: rciResult.total,
            matchTier: rciResult.matchTier,
            builderSignal: coerceBuilderSignal(scopeResult.builder_signal.category),
            technicalDepth: coerceTechnicalDepth(scopeResult.technical_depth.label),
            scopeConfidence: capitalize(scopeResult.overall_confidence) as 'High' | 'Medium' | 'Low',
            technicalDepthScore: scopeResult.technical_depth_score,
            rciScopeScore: scopeResult.rci_scope_score,
            anomalyFlag: false,
            tourOfDutySignal: scopeResult.tour_of_duty_signal,
            shortTenureFlag: scopeResult.short_tenure_flag,
            roleTitleHistory: scopeResult.role_title_history,
            sloaneMatchRationale: buildRationale(profileData.name, rciResult, scopeResult.overall_confidence),
            programDomains: scopeResult.program_breadth.domains,
          });

          allExternalEntries.push({
            sourcingQueueId,
            linkedinUrl,
            name: profileData.name,
            candidateId: peopleMatch?.id,
            rciScore: rciResult.total,
            matchTier: rciResult.matchTier,
          });
          session.candidatesWritten++;

          if (rciResult.matchTier === 'High') session.tierCounts.high++;
          else if (rciResult.matchTier === 'Calibration') session.tierCounts.calibration++;
          else session.tierCounts.stretch++;

          // Progress update every 5 profiles scraped
          if (session.profilesScraped % 5 === 0) {
            controller.enqueue(sseEvent({
              type: 'progress',
              message: `Sourced ${session.profilesScraped} of ${limiter.sessionLimit} external profiles so far. ${session.tierCounts.high} High Match, ${session.tierCounts.calibration} Calibration, ${session.tierCounts.stretch} Stretch.`,
            }));
          }
        }

        // Persist external slate
        await updateSloaneRecord(sloaneRecord.id, {
          externalSlate: allExternalEntries,
          stage: 'Scout',
        });

        const totalCount = vaultSweepCount + session.candidatesWritten;

        if (!limiter.sessionCapApplies || session.candidatesWritten < sessionCap) {
          // BRANCH B — session complete
          summaryText = [
            `External scout complete. Found ${session.candidatesWritten} candidates.`,
            `Combined slate: ${totalCount} total (${vaultSweepCount} internal, ${session.candidatesWritten} external).`,
            `${session.tierCounts.high} High Match · ${session.tierCounts.calibration} Calibration · ${session.tierCounts.stretch} Stretch`,
          ].join('\n');
          controller.enqueue(sseEvent({
            type: 'complete',
            summary: summaryText,
            total: totalCount,
            ...session.tierCounts,
          }));
        } else {
          // BRANCH C — hit session cap, ask PM to confirm continuation
          const remaining = limiter.scoutTarget - session.candidatesWritten;
          summaryText = [
            `I sourced ${session.candidatesWritten} external candidates this session.`,
            `${session.tierCounts.high} High Match · ${session.tierCounts.calibration} Calibration · ${session.tierCounts.stretch} Stretch`,
            ``,
            `Still need ${remaining} more to reach the target. Want me to continue sourcing?`,
          ].join('\n');
          controller.enqueue(sseEvent({
            type: 'cap_reached',
            summary: summaryText,
            sessionCount: session.candidatesWritten,
            remaining,
            ...session.tierCounts,
          }));
        }

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[sloane] External scout error:', msg.slice(0, 300));
        summaryText = "I ran into an issue on this step — please try the command again.";
        controller.enqueue(sseEvent({ type: 'error', message: summaryText }));
      }

      await persistScoutComplete(sloaneRecord, historyWithUser, summaryText);
      controller.close();
    },
  });
}

async function persistScoutComplete(
  sloaneRecord: SloaneRecord,
  historyWithUser: ConversationMessage[],
  summaryText: string
): Promise<void> {
  const assistantMessage: ConversationMessage = {
    role: 'assistant',
    content: summaryText,
    timestamp: new Date().toISOString(),
    metadata: { intent: 'run_scout', stage: 'Scout' },
  };
  try {
    await updateSloaneRecord(sloaneRecord.id, {
      conversationHistory: [...historyWithUser, assistantMessage],
    });
  } catch (err) {
    console.error('[sloane] Failed to persist scout conversation history:', err);
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Coerce scope extraction values to valid Airtable singleSelect options.
// Claude occasionally returns non-standard strings (e.g. "Unclear", "Undetermined").
function coerceBuilderSignal(raw: string | undefined): 'Builder' | 'Operator' | 'Hybrid' {
  if (raw === 'Builder' || raw === 'Operator' || raw === 'Hybrid') return raw;
  return 'Hybrid';
}

function coerceTechnicalDepth(raw: string | undefined): TechnicalDepthLabel {
  if (
    raw === 'Engineering-Led' ||
    raw === 'Technical-Adjacent' ||
    raw === 'Governance-Led' ||
    raw === 'Hybrid'
  ) return raw;
  return 'Governance-Led';
}

// ─── Status summary ───────────────────────────────────────────────────────────

function buildStatusSummary(stage: SearchStage, params: SearchParameters): string {
  const company = params.companyName ?? 'this search';
  const role = params.role ?? 'the role';
  return `${company} — ${role}. Current stage: ${stage}.`;
}

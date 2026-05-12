import Airtable from 'airtable';
import { v4 as uuidv4 } from 'uuid';
import type {
  SearchRecord,
  SloaneRecord,
  ConversationMessage,
  RCIBaseline,
  RubricRecord,
  PeopleRecord,
  SourcingQueueWrite,
  SourcingQueueRecord,
  SearchStage,
  SlateEntry,
  ScopeFingerprint,
  FeedbackContext,
  SearchParameters,
} from '@/types/sloane';

// ─── Client ───────────────────────────────────────────────────────────────────

function getClient() {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!apiKey) throw new Error('AIRTABLE_API_KEY is not set');
  if (!baseId) throw new Error('AIRTABLE_BASE_ID is not set');
  return new Airtable({ apiKey }).base(baseId);
}

// Retry once after 3s on connectivity failure
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    await new Promise((r) => setTimeout(r, 3000));
    return fn();
  }
}

// ─── Formula safety ───────────────────────────────────────────────────────────

// Strips characters that can escape Airtable formula string context and caps length.
function sanitizeFormulaValue(value: string): string {
  return value.replace(/[{}"\\]/g, '').slice(0, 200);
}

// ─── Attachment helpers ───────────────────────────────────────────────────────

export function getAttachmentUrl(
  fields: Record<string, unknown>,
  fieldName: string
): string | null {
  const val = fields[fieldName];
  if (!val) return null;
  // Direct attachment array: [{url, ...}, ...]
  if (Array.isArray(val) && val.length > 0) {
    const first = val[0];
    if (typeof first === 'object' && first !== null && 'url' in first) {
      return (first as { url: string }).url;
    }
    // Lookup field (array of arrays): [[{url,...}], ...]
    if (Array.isArray(first) && first.length > 0) {
      const inner = first[0];
      if (typeof inner === 'object' && inner !== null && 'url' in inner) {
        return (inner as { url: string }).url;
      }
    }
  }
  return null;
}

// ─── Searches table ───────────────────────────────────────────────────────────

export async function listSearches(): Promise<SearchRecord[]> {
  return withRetry(async () => {
    const base = getClient();
    const records = await base('Searches').select({
      filterByFormula: '{Status} = "Active"',
      fields: ['client_name', 'PlacementPos', 'client_logo', 'rubric_url (from Rubric)'],
      sort: [{ field: 'client_name', direction: 'asc' }],
    }).all();

    return records.map((r) => {
      const f = r.fields as Record<string, unknown>;
      const rubricUrlVal = f['rubric_url (from Rubric)'];
      const rubricUrl = Array.isArray(rubricUrlVal) && rubricUrlVal.length > 0 && rubricUrlVal[0]
        ? String(rubricUrlVal[0])
        : null;
      return {
        id: r.id,
        clientName: (f['client_name'] as string) ?? '',
        placementPos: (f['PlacementPos'] as string) ?? '',
        clientLogoUrl: getAttachmentUrl(f, 'client_logo'),
        rubricComplete: !!rubricUrl,
        rubricUrl,
        partner1Name: null,
        partner1Email: null,
        partner1Phone: null,
        partner2Name: null,
        partner2Email: null,
        partner2Phone: null,
        pmName: null,
        pmEmail: null,
        pmPhone: null,
      };
    });
  });
}

export async function getSearch(clientName: string): Promise<SearchRecord | null> {
  return withRetry(async () => {
    const base = getClient();
    const records = await base('Searches').select({
      filterByFormula: `{client_name} = "${sanitizeFormulaValue(clientName)}"`,
      fields: [
        'client_name', 'PlacementPos', 'client_logo', 'rubric_url (from Rubric)',
        'Partner 1 Name', 'Partner 1 Email', 'Partner 1 Phone',
        'Partner 2 Name', 'Partner 2 Email', 'Partner 2 Phone',
        'PM Name', 'PM Email', 'PM Phone',
      ],
      maxRecords: 1,
    }).all();

    if (records.length === 0) return null;
    const r = records[0];
    const f = r.fields as Record<string, unknown>;
    const rubricUrlVal = f['rubric_url (from Rubric)'];
    const rubricUrl = Array.isArray(rubricUrlVal) && rubricUrlVal.length > 0 && rubricUrlVal[0]
      ? String(rubricUrlVal[0])
      : null;
    return {
      id: r.id,
      clientName: (f['client_name'] as string) ?? '',
      placementPos: (f['PlacementPos'] as string) ?? '',
      clientLogoUrl: getAttachmentUrl(f, 'client_logo'),
      rubricComplete: !!rubricUrl,
      rubricUrl,
      partner1Name: (f['Partner 1 Name'] as string) ?? null,
      partner1Email: (f['Partner 1 Email'] as string) ?? null,
      partner1Phone: (f['Partner 1 Phone'] as string) ?? null,
      partner2Name: (f['Partner 2 Name'] as string) ?? null,
      partner2Email: (f['Partner 2 Email'] as string) ?? null,
      partner2Phone: (f['Partner 2 Phone'] as string) ?? null,
      pmName: (f['PM Name'] as string) ?? null,
      pmEmail: (f['PM Email'] as string) ?? null,
      pmPhone: (f['PM Phone'] as string) ?? null,
    };
  });
}

export async function getSearchById(searchId: string): Promise<SearchRecord | null> {
  return withRetry(async () => {
    const base = getClient();
    try {
      const r = await base('Searches').find(searchId);
      const f = r.fields as Record<string, unknown>;
      const rubricUrlVal = f['rubric_url (from Rubric)'];
      const rubricUrl = Array.isArray(rubricUrlVal) && rubricUrlVal.length > 0 && rubricUrlVal[0]
        ? String(rubricUrlVal[0])
        : null;
      return {
        id: r.id,
        clientName: (f['client_name'] as string) ?? '',
        placementPos: (f['PlacementPos'] as string) ?? '',
        clientLogoUrl: getAttachmentUrl(f, 'client_logo'),
        rubricComplete: !!rubricUrl,
        rubricUrl,
        partner1Name: (f['Partner 1 Name'] as string) ?? null,
        partner1Email: (f['Partner 1 Email'] as string) ?? null,
        partner1Phone: (f['Partner 1 Phone'] as string) ?? null,
        partner2Name: (f['Partner 2 Name'] as string) ?? null,
        partner2Email: (f['Partner 2 Email'] as string) ?? null,
        partner2Phone: (f['Partner 2 Phone'] as string) ?? null,
        pmName: (f['PM Name'] as string) ?? null,
        pmEmail: (f['PM Email'] as string) ?? null,
        pmPhone: (f['PM Phone'] as string) ?? null,
      };
    } catch {
      return null;
    }
  });
}

// ─── Rubric ───────────────────────────────────────────────────────────────────

export async function checkRubricComplete(searchId: string): Promise<boolean> {
  return withRetry(async () => {
    const base = getClient();
    const searchRecord = await base('Searches').find(searchId);
    const rubricIds = searchRecord.fields['Rubric'] as string[] | undefined;
    if (!rubricIds?.length) return false;
    const rubric = await base('Rubric').find(rubricIds[0]);
    const status = rubric.fields['Rubric Draft Status'] as string | undefined;
    return status === 'Draft Ready' || status === 'Approved';
  });
}

export async function readRubric(searchId: string): Promise<RubricRecord | null> {
  return withRetry(async () => {
    const base = getClient();
    const searchRecord = await base('Searches').find(searchId);
    const rubricIds = searchRecord.fields['Rubric'] as string[] | undefined;
    if (!rubricIds?.length) return null;
    const r = await base('Rubric').find(rubricIds[0]);
    const f = r.fields as Record<string, unknown>;
    return {
      id: r.id,
      rubricDraftStatus: (f['Rubric Draft Status'] as string) ?? null,
      location: (f['Location'] as string) ?? null,
      teamSizeToday: (f['Team Size Today'] as string) ?? null,
      estTeamSize1824mo: (f['Est Team Size 18 - 24 mo'] as string) ?? null,
      successInRole: (f['Success in the Role'] as string) ?? null,
      functionalResponsibilities: (f['Functional Responsibilities'] as string) ?? null,
      mustHave: (f['Must Have'] as string) ?? null,
      niceToHave: (f['Nice to Have'] as string) ?? null,
      redFlags: (f['Red Flags'] as string) ?? null,
      conflictNarrative: (f['Conflict Narrative'] as string) ?? null,
      rubricMatrixJson: (f['Rubric Matrix JSON'] as string) ?? null,
      rubricPdfUrl: getAttachmentUrl(f, 'Rubric PDF'),
      rubricUrl: (f['rubric_url'] as string) ?? null,
    };
  });
}

// ─── Sloane table ─────────────────────────────────────────────────────────────

function parseSloaneRecord(r: Airtable.Record<Airtable.FieldSet>): SloaneRecord {
  const f = r.fields as Record<string, unknown>;

  const parseJSON = <T>(val: unknown): T | null => {
    if (!val || typeof val !== 'string') return null;
    try { return JSON.parse(val) as T; } catch { return null; }
  };

  return {
    id: r.id,
    searchId: Array.isArray(f['Search Project']) ? (f['Search Project'] as string[])[0] : ((f['Search Project'] as string) ?? ''),
    sessionId: (f['Session ID'] as string) ?? '',
    stage: ((f['Stage'] as string) ?? 'Calibration') as SearchStage,
    searchParameters: parseJSON<SearchParameters>(f['Search Parameters'] as string) ?? {},
    conversationHistory: parseJSON<ConversationMessage[]>(f['Conversation History'] as string) ?? [],
    lastActive: (f['Last Active'] as string) ?? new Date().toISOString(),
    jdDraftSloane: (f['JD Draft-Sloane'] as string) ?? null,
    jdWorkingCopy: (f['JD Draft-WorkingCopy'] as string) ?? null,
    jdStatus: (f['JD-Status'] as SloaneRecord['jdStatus']) ?? null,
    jdPdfUrl: (f['JD-url'] as string) ?? null,
    rciBaseline: parseJSON(f['RCI-Baseline'] as string),
    teamSize: (f['Team-Size'] as string) ?? null,
    northStarUrl: (f['NorthStar-url'] as string) ?? null,
    scopeFingerprint: parseJSON(f['Scope-Fingerprint'] as string),
    internalSlate: parseJSON<SlateEntry[]>(f['Internal-Slate'] as string),
    externalSlate: parseJSON<SlateEntry[]>(f['External-Slate'] as string),
    feedbackContext: parseJSON<FeedbackContext>(f['Feedback-Context'] as string),
    vaultSweepCount: typeof f['Vault Sweep Count'] === 'number' ? f['Vault Sweep Count'] as number : null,
    scoutTarget: typeof f['Scout Target'] === 'number' ? f['Scout Target'] as number : null,
    scoutSessionCap: typeof f['Scout Session Cap'] === 'number' ? f['Scout Session Cap'] as number : null,
  };
}

export async function getSloaneRecord(searchId: string): Promise<SloaneRecord | null> {
  return withRetry(async () => {
    const base = getClient();
    // Airtable filterByFormula can't filter linked records by ID (uses display names).
    // Fetch all and filter in JS — the JS SDK returns linked record IDs as strings.
    const records = await base('Sloane').select().all();
    const match = records.find((r) => {
      const sp = r.fields['Search Project'];
      if (!Array.isArray(sp)) return false;
      return sp.some((entry) => {
        if (typeof entry === 'string') return entry === searchId;
        if (typeof entry === 'object' && entry !== null && 'id' in entry) {
          return (entry as { id: string }).id === searchId;
        }
        return false;
      });
    });
    return match ? parseSloaneRecord(match) : null;
  });
}

export async function getSloaneRecordById(recordId: string): Promise<SloaneRecord | null> {
  return withRetry(async () => {
    const base = getClient();
    try {
      const r = await base('Sloane').find(recordId);
      return parseSloaneRecord(r);
    } catch {
      return null;
    }
  });
}

export async function createSloaneRecord(searchId: string): Promise<SloaneRecord> {
  return withRetry(async () => {
    const base = getClient();
    const sessionId = uuidv4();
    const r = await base('Sloane').create({
      'Search Project': [searchId],
      'Session ID': sessionId,
      'Stage': 'Calibration',
      'Search Parameters': JSON.stringify({}),
      'Conversation History': JSON.stringify([]),
      'Last Active': new Date().toISOString().slice(0, 10),
    });
    return parseSloaneRecord(r);
  });
}

export async function updateSloaneRecord(
  recordId: string,
  fields: Partial<{
    stage: SearchStage;
    searchParameters: SearchParameters;
    conversationHistory: ConversationMessage[];
    jdDraftSloane: string;
    jdWorkingCopy: string;
    jdStatus: 'Draft' | 'In Review' | 'Final';
    jdPdfUrl: string;
    rciBaseline: RCIBaseline;
    teamSize: string;
    northStarUrl: string;
    scopeFingerprint: ScopeFingerprint;
    internalSlate: SlateEntry[];
    externalSlate: SlateEntry[];
    feedbackContext: FeedbackContext;
    vaultSweepCount: number;
    scoutTarget: number;
    scoutSessionCap: number;
  }>
): Promise<void> {
  return withRetry(async () => {
    const base = getClient();
    const airtableFields: Record<string, unknown> = {};

    if (fields.stage !== undefined) airtableFields['Stage'] = fields.stage;
    if (fields.searchParameters !== undefined) airtableFields['Search Parameters'] = JSON.stringify(fields.searchParameters);
    if (fields.conversationHistory !== undefined) airtableFields['Conversation History'] = JSON.stringify(fields.conversationHistory);
    if (fields.jdDraftSloane !== undefined) airtableFields['JD Draft-Sloane'] = fields.jdDraftSloane;
    if (fields.jdWorkingCopy !== undefined) airtableFields['JD Draft-WorkingCopy'] = fields.jdWorkingCopy;
    if (fields.jdStatus !== undefined) airtableFields['JD-Status'] = fields.jdStatus;
    if (fields.jdPdfUrl !== undefined) airtableFields['JD-url'] = fields.jdPdfUrl;
    if (fields.rciBaseline !== undefined) airtableFields['RCI-Baseline'] = JSON.stringify(fields.rciBaseline);
    if (fields.teamSize !== undefined) airtableFields['Team-Size'] = fields.teamSize;
    if (fields.northStarUrl !== undefined) airtableFields['NorthStar-url'] = fields.northStarUrl;
    if (fields.scopeFingerprint !== undefined) airtableFields['Scope-Fingerprint'] = JSON.stringify(fields.scopeFingerprint);
    if (fields.internalSlate !== undefined) airtableFields['Internal-Slate'] = JSON.stringify(fields.internalSlate);
    if (fields.externalSlate !== undefined) airtableFields['External-Slate'] = JSON.stringify(fields.externalSlate);
    if (fields.feedbackContext !== undefined) airtableFields['Feedback-Context'] = JSON.stringify(fields.feedbackContext);
    if (fields.vaultSweepCount !== undefined) airtableFields['Vault Sweep Count'] = fields.vaultSweepCount;
    if (fields.scoutTarget !== undefined) airtableFields['Scout Target'] = fields.scoutTarget;
    if (fields.scoutSessionCap !== undefined) airtableFields['Scout Session Cap'] = fields.scoutSessionCap;

    airtableFields['Last Active'] = new Date().toISOString().slice(0, 10);

    await base('Sloane').update(recordId, airtableFields as Airtable.FieldSet);
  });
}

export async function appendConversationMessage(
  recordId: string,
  message: ConversationMessage
): Promise<void> {
  const record = await getSloaneRecordById(recordId);
  const history = record?.conversationHistory ?? [];
  history.push(message);
  await updateSloaneRecord(recordId, { conversationHistory: history });
}

export async function writeJdPdfToSloane(
  recordId: string,
  blobUrl: string,
  filename: string
): Promise<void> {
  return withRetry(async () => {
    const base = getClient();
    // Cast through unknown — Airtable accepts {url, filename} for attachment writes
    // even though the TypeScript type requires full Attachment shape.
    await base('Sloane').update(recordId, { 'JD-PDF': [{ url: blobUrl, filename }] } as unknown as Airtable.FieldSet);
  });
}

// ─── People table ─────────────────────────────────────────────────────────────

export async function findPeopleByLinkedIn(linkedinUrl: string): Promise<string | null> {
  return withRetry(async () => {
    const base = getClient();
    // Strip trailing slash for substring matching so we handle both
    // "https://linkedin.com/in/handle" and "https://linkedin.com/in/handle/"
    const normalized = linkedinUrl.trim().replace(/\/$/, '');
    const records = await base('People').select({
      filterByFormula: `FIND("${sanitizeFormulaValue(normalized)}", {LinkedIn}) > 0`,
      fields: ['LinkedIn'],
      maxRecords: 1,
    }).all();
    return records.length > 0 ? records[0].id : null;
  });
}

export async function findPeopleByLinkedInFull(
  linkedinUrl: string
): Promise<{ id: string; doNotContact: boolean } | null> {
  return withRetry(async () => {
    const base = getClient();
    const normalized = linkedinUrl.trim().replace(/\/$/, '');
    const records = await base('People').select({
      filterByFormula: `FIND("${sanitizeFormulaValue(normalized)}", {LinkedIn}) > 0`,
      fields: ['LinkedIn', 'Do Not Include in Search'],
      maxRecords: 1,
    }).all();
    if (records.length === 0) return null;
    return {
      id: records[0].id,
      doNotContact: !!(records[0].fields['Do Not Include in Search'] as boolean),
    };
  });
}

export async function queryPeopleByRCI(baseline: RCIBaseline): Promise<PeopleRecord[]> {
  // baseline param reserved for future pre-filtering once RCI fields are populated
  void baseline;
  return withRetry(async () => {
    const base = getClient();
    // Pull all non-DNC people. RCI dimension fields (Function/Level/etc.) are not
    // in the live base yet — scoring falls back to scope extraction until populated.
    const records = await base('People').select({
      filterByFormula: `AND({Do Not Include in Search} != TRUE(), {LinkedIn} != "")`,
      fields: ['FullName', 'LinkedIn', 'Do Not Include in Search', 'title_dropdown', 'Industry', 'Current Company Size'],
      maxRecords: 20,
    }).all();

    return records
      .filter((r) => !(r.fields['Do Not Include in Search'] as boolean))
      .map((r) => {
        const title = (r.fields['title_dropdown'] as string) ?? '';
        const rawIndustry = r.fields['Industry'];
        const industry = Array.isArray(rawIndustry) ? (rawIndustry as string[]).join(', ') : String(rawIndustry ?? '');
        const rawSize = r.fields['Current Company Size'];
        const companySize = Array.isArray(rawSize) ? (rawSize as string[]).join(', ') : String(rawSize ?? '');
        const linkedin = (r.fields['LinkedIn'] as string) ?? '';
        const profileText = [title, industry, companySize].filter(Boolean).join('. ') || linkedin;
        return {
          id: r.id,
          name: (r.fields['FullName'] as string) ?? '',
          currentTitle: title || undefined,
          linkedinUrl: linkedin || undefined,
          resumeText: profileText || undefined,
          doNotContact: !!(r.fields['Do Not Include in Search'] as boolean),
          // RCI dimension fields (Function/Level/etc.) not yet in live base
          // Scoring falls back to scope extraction scores until those fields are populated.
        };
      });
  });
}

// ─── Sourcing Queue table ─────────────────────────────────────────────────────

export async function findSourcingQueueByName(
  candidateName: string,
  searchId: string
): Promise<string | null> {
  return withRetry(async () => {
    const base = getClient();
    const safeName = sanitizeFormulaValue(candidateName.trim());
    // Filter by name in formula; then JS-filter by searchId because Airtable formula
    // context for linked record fields returns display names, not record IDs.
    const records = await base('Sourcing Que').select({
      filterByFormula: `{Candidate-Name-Raw} = "${safeName}"`,
      fields: ['Candidate-Name-Raw', 'Search'],
      maxRecords: 10,
    }).all();
    const match = records.find((r) => {
      const links = r.fields['Search'];
      if (!Array.isArray(links)) return false;
      return links.some((entry) => {
        if (typeof entry === 'string') return entry === searchId;
        if (typeof entry === 'object' && entry !== null && 'id' in entry) {
          return (entry as { id: string }).id === searchId;
        }
        return false;
      });
    });
    return match ? match.id : null;
  });
}

export async function writeSourcingQueueRecord(data: SourcingQueueWrite): Promise<string> {
  return withRetry(async () => {
    const base = getClient();

    // Dedup check by name + search (LinkedIn URL is a lookup — not writable by Sloane)
    const existingId = await findSourcingQueueByName(data.candidateNameRaw, data.searchId);

    const fields: Record<string, unknown> = {
      // Raw fields first — always succeed
      'Name': data.candidateNameRaw,
      'Candidate-Name-Raw': data.candidateNameRaw,
      'Search': [data.searchId],
      'Source': data.source === 'Sweep' ? 'Sweep' : 'Scout',
      // Match-Status is the PM review status (Pending/Relevant/Not Relevant).
      // DB match is indicated by Candidate linked record being populated.
      'Match-Status': 'Pending',
      'RCI-Score': data.rciScore,
      'Adj-Rank-Score': data.adjRankScore,
      'Match-Tier': data.matchTier,
      'Builder-Signal': data.builderSignal,
      'Technical-Depth': data.technicalDepth,
      'Scope-Confidence': data.scopeConfidence,
      'Technical-Depth-Score': String(data.technicalDepthScore),
      'RCI-Scope-Score': data.rciScopeScore,
      'Anomaly-Flag': data.anomalyFlag,
      'Tour-of-Duty-Signal': data.tourOfDutySignal,
      'Short-Tenure-Flag': data.shortTenureFlag,
      'Role-Title-History': JSON.stringify(data.roleTitleHistory),
      'Sloane-Match-Rationale': data.sloaneMatchRationale,
      'Program-Domains': JSON.stringify(data.programDomains),
      'PM-Decision': 'Pending',
    };

    if (data.anomalyNote) fields['Anomaly-Note'] = data.anomalyNote;

    // Attempt linked record write after raw fields are set
    if (data.candidateLinkedId) {
      fields['Candidate'] = [data.candidateLinkedId];
    }

    if (existingId) {
      await base('Sourcing Que').update(existingId, fields as Airtable.FieldSet);
      return existingId;
    } else {
      const r = await base('Sourcing Que').create(fields as Airtable.FieldSet);
      return r.id;
    }
  });
}

export async function getSourcingQueueDecided(
  functionFilter: string,
  levelFilter: string
): Promise<SourcingQueueRecord[]> {
  return withRetry(async () => {
    const base = getClient();
    const records = await base('Sourcing Que').select({
      filterByFormula: `AND({PM-Decision} != "Pending", {PM-Decision} != "")`,
      fields: ['Candidate-Name-Raw', 'PM-Decision',
               'Rejection-Reason', 'Builder-Signal', 'Technical-Depth',
               'RCI-Score', 'Match-Tier', 'Scope-Confidence'],
    }).all();

    return records.map((r) => ({
      id: r.id,
      candidateNameRaw: (r.fields['Candidate-Name-Raw'] as string) ?? '',
      linkedinUrlRaw: '',
      searchId: '',
      source: 'Scout' as const,
      databaseMatchStatus: 'Unmatched' as const,
      rciScore: (r.fields['RCI-Score'] as number) ?? 0,
      adjRankScore: (r.fields['RCI-Score'] as number) ?? 0,
      matchTier: (r.fields['Match-Tier'] as SourcingQueueRecord['matchTier']) ?? 'Stretch',
      builderSignal: (r.fields['Builder-Signal'] as SourcingQueueRecord['builderSignal']) ?? 'Operator',
      technicalDepth: (r.fields['Technical-Depth'] as SourcingQueueRecord['technicalDepth']) ?? 'Governance-Led',
      scopeConfidence: (r.fields['Scope-Confidence'] as SourcingQueueRecord['scopeConfidence']) ?? 'Low',
      technicalDepthScore: 50,
      rciScopeScore: 0,
      anomalyFlag: false,
      tourOfDutySignal: false,
      shortTenureFlag: false,
      roleTitleHistory: [],
      sloaneMatchRationale: '',
      programDomains: [],
      pmDecision: (r.fields['PM-Decision'] as SourcingQueueRecord['pmDecision']) ?? 'Pending',
      rejectionReason: r.fields['Rejection-Reason'] as string | undefined,
      createdAt: '',
    }));
  });
}

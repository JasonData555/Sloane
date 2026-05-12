import Anthropic from '@anthropic-ai/sdk';
import type {
  RubricRecord,
  RCIBaseline,
  ScopeExtractionResult,
  SearchParameters,
  CompanyResearch,
  SecurityFunction,
  SecurityLevel,
  IndustryTier,
  CompanySize,
  GeographyTier,
} from '@/types/sloane';

// ─── Client ───────────────────────────────────────────────────────────────────

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

const MODEL = 'claude-sonnet-4-6';

// ─── General completion ───────────────────────────────────────────────────────

async function complete(
  systemPrompt: string,
  userContent: string,
  options: { maxTokens?: number; temperature?: number } = {}
): Promise<string> {
  const client = getClient();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: options.maxTokens ?? 4096,
    temperature: options.temperature ?? 0,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
  });

  const block = response.content[0];
  if (block.type !== 'text') throw new Error('Unexpected non-text response from Claude');
  return block.text;
}

// ─── Company research ─────────────────────────────────────────────────────────

const RESEARCH_SYSTEM = `You are a B2B market intelligence analyst specializing in cybersecurity companies.
Given a company name and target role, return a JSON object with your best assessment of the company.
Base your analysis on your training knowledge. Be transparent when confidence is low.

Return ONLY valid JSON — no markdown fences, no commentary.

Schema:
{
  "industryTier": "A" | "B" | "C",
  "companySizeBand": "Startup (<200)" | "Mid-Market (200-2K)" | "Enterprise (2K-10K)" | "Large (10K-50K)" | "Global (50K+)",
  "fundingStage": string,
  "estimatedSecurityTeamSize": number,
  "confidence": "high" | "medium" | "low",
  "notes": string
}

Industry tiers:
  A = Financial Services, Defense/Gov Contractor, Crypto/Blockchain
  B = Technology/SaaS, Healthcare, Critical Infrastructure
  C = Retail/eCommerce, Government/Public Sector, Education/Non-profit`;

export async function researchCompany(
  companyName: string,
  role: string
): Promise<CompanyResearch> {
  const raw = await complete(
    RESEARCH_SYSTEM,
    `Company: ${companyName}\nTarget role: ${role}`,
    { maxTokens: 512 }
  );

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    console.error('[claude] researchCompany parse error, raw (truncated):', raw.slice(0, 200));
    return {
      industryTier: 'B',
      companySizeBand: 'Mid-Market (200-2K)',
      fundingStage: 'Unknown',
      estimatedSecurityTeamSize: 10,
      confidence: 'low',
      notes: 'Research unavailable — using defaults.',
    };
  }

  return {
    industryTier: (parsed.industryTier as IndustryTier) ?? 'B',
    companySizeBand: (parsed.companySizeBand as CompanySize) ?? 'Mid-Market (200-2K)',
    fundingStage: (parsed.fundingStage as string) ?? 'Unknown',
    estimatedSecurityTeamSize: (parsed.estimatedSecurityTeamSize as number) ?? 10,
    confidence: (parsed.confidence as 'high' | 'medium' | 'low') ?? 'low',
    notes: (parsed.notes as string) ?? '',
  };
}

// ─── RCI Baseline generation ──────────────────────────────────────────────────

const BASELINE_SYSTEM = `You are an executive search specialist building a Role Complexity Index (RCI) Baseline.
Given rubric data and company research, extract the target candidate profile across six dimensions.

Respond ONLY with valid JSON — no markdown fences.

Schema:
{
  "function": one of ["Security Engineering","SecOps","GRC","Offensive Security","Cloud Security","IAM","Threat Intelligence","Security Architecture","Leadership / CISO"],
  "level": one of ["IC-I","IC-II","IC-III","Lead","Manager","Director","VP/CISO"],
  "industryTier": "A" | "B" | "C",
  "companySize": one of ["Startup (<200)","Mid-Market (200-2K)","Enterprise (2K-10K)","Large (10K-50K)","Global (50K+)"],
  "geography": "Tier 1" | "Tier 2" | "Tier 3" | "International",
  "targetTeamSize": number,
  "confidence": "high" | "medium" | "low"
}

Geography tiers:
  Tier 1 = CA, NY, WA, MA, DC
  Tier 2 = TX, IL, CO, GA, VA
  Tier 3 = all other US states
  International = outside US

For targetTeamSize: use the Team Size Today value (parse the midpoint of ranges like "15-20" → 17, "10+" → 15).
For geography: derive from the Location field or company HQ.`;

export async function generateRCIBaseline(
  rubric: RubricRecord,
  companyResearch: CompanyResearch,
  params: SearchParameters
): Promise<RCIBaseline> {
  const prompt = `
RUBRIC DATA:
Role: ${params.role ?? 'Unknown'}
Location: ${rubric.location ?? 'Not specified'}
Team Size Today: ${rubric.teamSizeToday ?? 'Not specified'}
Est Team Size 18-24mo: ${rubric.estTeamSize1824mo ?? 'Not specified'}
Functional Responsibilities: ${rubric.functionalResponsibilities ?? 'Not specified'}
Must Have: ${rubric.mustHave ?? 'Not specified'}
Success in Role: ${rubric.successInRole ?? 'Not specified'}
Red Flags: ${rubric.redFlags ?? 'Not specified'}

COMPANY RESEARCH:
Company: ${params.companyName ?? 'Unknown'}
Industry Tier: ${companyResearch.industryTier}
Company Size: ${companyResearch.companySizeBand}
Funding Stage: ${companyResearch.fundingStage}
Est Security Team Size: ${companyResearch.estimatedSecurityTeamSize}
Notes: ${companyResearch.notes}
`.trim();

  const raw = await complete(BASELINE_SYSTEM, prompt, { maxTokens: 512 });

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    console.error('[claude] generateRCIBaseline parse error, raw (truncated):', raw.slice(0, 200));
    throw new Error('RCI Baseline generation returned invalid JSON');
  }

  return {
    function: (parsed.function as SecurityFunction) ?? 'Leadership / CISO',
    level: (parsed.level as SecurityLevel) ?? 'VP/CISO',
    industryTier: (parsed.industryTier as IndustryTier) ?? companyResearch.industryTier,
    companySize: (parsed.companySize as CompanySize) ?? companyResearch.companySizeBand,
    geography: (parsed.geography as GeographyTier) ?? 'Tier 2',
    targetTeamSize: (parsed.targetTeamSize as number) ?? companyResearch.estimatedSecurityTeamSize,
    confidence: (parsed.confidence as 'high' | 'medium' | 'low') ?? 'medium',
    companyResearch,
  };
}

// ─── JD generation ────────────────────────────────────────────────────────────

export async function generateJD(
  rubric: RubricRecord,
  baseline: RCIBaseline,
  companyResearch: CompanyResearch,
  params: SearchParameters,
  contacts: { partner1: string; partner2: string; pm: string }
): Promise<string> {
  const template = process.env.JD_DRAFT_PROMPT;
  if (!template) throw new Error('JD_DRAFT_PROMPT environment variable is not set');

  const companyResearchText = [
    `Industry Tier: ${companyResearch.industryTier}`,
    `Company Size Band: ${companyResearch.companySizeBand}`,
    `Funding Stage: ${companyResearch.fundingStage}`,
    `Estimated Security Team Size: ${companyResearch.estimatedSecurityTeamSize}`,
    `Confidence: ${companyResearch.confidence}`,
    `Research Notes:\n${companyResearch.notes}`,
  ].join('\n');

  const rubricText = [
    `Location: ${rubric.location ?? 'Not specified'}`,
    `Team Size Today: ${rubric.teamSizeToday ?? 'Not specified'}`,
    `Est. Team Size 18-24mo: ${rubric.estTeamSize1824mo ?? 'Not specified'}`,
    `Functional Responsibilities:\n${rubric.functionalResponsibilities ?? 'Not specified'}`,
    `Success in Role:\n${rubric.successInRole ?? 'Not specified'}`,
    `Must Have:\n${rubric.mustHave ?? 'Not specified'}`,
    `Nice to Have:\n${rubric.niceToHave ?? 'Not specified'}`,
    `Red Flags:\n${rubric.redFlags ?? 'Not specified'}`,
  ].join('\n\n');

  const prompt = template
    .replace('{COMPANY_NAME}', params.companyName ?? 'Unknown')
    .replace('{PLACEMENT_POS}', params.role ?? 'Unknown')
    .replace('{COMPANY_RESEARCH}', companyResearchText)
    .replace('{RCI_BASELINE}', JSON.stringify(baseline, null, 2))
    .replace('{RUBRIC_CONTENT}', rubricText)
    .replace('{PARTNER_CONTACT_1}', contacts.partner1)
    .replace('{PARTNER_CONTACT_2}', contacts.partner2)
    .replace('{PM_CONTACT}', contacts.pm);

  return complete('You are a senior executive search writer for Hitch Partners.', prompt, { maxTokens: 4096 });
}

// ─── Scope extraction ─────────────────────────────────────────────────────────

const PROFILE_MAX_CHARS = 5000;

export async function extractScope(
  profileText: string,
  resumeText: string | null,
  targetTeamSize: number
): Promise<ScopeExtractionResult> {
  const promptTemplate = process.env.SCOPE_EXTRACTION_PROMPT;
  if (!promptTemplate) throw new Error('SCOPE_EXTRACTION_PROMPT is not set');

  // Truncate and wrap in delimiters to prevent prompt injection from
  // user-controlled profile/resume content.
  const safeProfile = `<profile_text>\n${profileText.slice(0, PROFILE_MAX_CHARS)}\n</profile_text>`;
  const safeResume = resumeText
    ? `<resume_text>\n${resumeText.slice(0, PROFILE_MAX_CHARS)}\n</resume_text>`
    : 'null';

  const rendered = promptTemplate
    .replace('{PROFILE_TEXT}', safeProfile)
    .replace('{RESUME_TEXT}', safeResume)
    .replace('{SEARCH_TARGET_TEAM_SIZE}', String(targetTeamSize));

  const raw = await complete(
    'You are a scope extraction engine. Respond only with valid JSON.',
    rendered,
    { maxTokens: 3000 }
  );

  const clean = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '');

  let parsed: unknown;
  try {
    parsed = JSON.parse(clean);
  } catch {
    throw new Error(`Scope extraction returned invalid JSON: ${clean.slice(0, 200)}`);
  }

  return parsed as ScopeExtractionResult;
}

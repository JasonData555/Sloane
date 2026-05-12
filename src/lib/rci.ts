import type {
  SecurityFunction,
  SecurityLevel,
  IndustryTier,
  CompanySize,
  GeographyTier,
  MatchTier,
  RCIBaseline,
  RCIResult,
  ScoutLimiterResult,
  PeopleRecord,
  ScopeExtractionResult,
} from '@/types/sloane';

// ─── Function (30 pts) ────────────────────────────────────────────────────────

export function scoreFunction(
  candidate: SecurityFunction | undefined,
  target: SecurityFunction
): number {
  if (!candidate) return 0;
  return candidate === target ? 30 : 0;
}

// ─── Level (20 pts) ───────────────────────────────────────────────────────────

const LEVEL_ORDER: SecurityLevel[] = [
  'IC-I', 'IC-II', 'IC-III', 'Lead', 'Manager', 'Director', 'VP/CISO',
];

export function scoreLevel(
  candidate: SecurityLevel | undefined,
  target: SecurityLevel
): number {
  if (!candidate) return 0;
  const ci = LEVEL_ORDER.indexOf(candidate);
  const ti = LEVEL_ORDER.indexOf(target);
  if (ci === -1 || ti === -1) return 0;
  const gap = Math.abs(ci - ti);
  if (gap === 0) return 20;
  if (gap === 1) return 10;
  return 0;
}

// ─── Industry Tier (15 pts) ───────────────────────────────────────────────────

const INDUSTRY_ORDER: IndustryTier[] = ['A', 'B', 'C'];

export function scoreIndustryTier(
  candidate: IndustryTier | undefined,
  target: IndustryTier
): number {
  if (!candidate) return 0;
  const ci = INDUSTRY_ORDER.indexOf(candidate);
  const ti = INDUSTRY_ORDER.indexOf(target);
  if (ci === -1 || ti === -1) return 0;
  const gap = Math.abs(ci - ti);
  if (gap === 0) return 15;
  if (gap === 1) return 8;
  return 0;
}

// ─── Company Size (15 pts) ────────────────────────────────────────────────────

const SIZE_ORDER: CompanySize[] = [
  'Startup (<200)',
  'Mid-Market (200-2K)',
  'Enterprise (2K-10K)',
  'Large (10K-50K)',
  'Global (50K+)',
];

export function scoreCompanySize(
  candidate: CompanySize | undefined,
  target: CompanySize
): number {
  if (!candidate) return 0;
  const ci = SIZE_ORDER.indexOf(candidate);
  const ti = SIZE_ORDER.indexOf(target);
  if (ci === -1 || ti === -1) return 0;
  const gap = Math.abs(ci - ti);
  if (gap === 0) return 15;
  if (gap === 1) return 8;
  return 0;
}

// ─── Geography (10 pts) ───────────────────────────────────────────────────────

// Matrix: [candidateTier][targetTier] → points
const GEO_MATRIX: Record<GeographyTier, Record<GeographyTier, number>> = {
  'Tier 1':       { 'Tier 1': 10, 'Tier 2': 7,  'Tier 3': 3, 'International': 0 },
  'Tier 2':       { 'Tier 1': 7,  'Tier 2': 7,  'Tier 3': 5, 'International': 0 },
  'Tier 3':       { 'Tier 1': 3,  'Tier 2': 5,  'Tier 3': 3, 'International': 0 },
  'International':{ 'Tier 1': 0,  'Tier 2': 0,  'Tier 3': 0, 'International': 10 },
};

export function scoreGeography(
  candidate: GeographyTier | undefined,
  target: GeographyTier
): number {
  if (!candidate) return 0;
  return GEO_MATRIX[candidate]?.[target] ?? 0;
}

// ─── Scope (50 pts) ───────────────────────────────────────────────────────────

export function scoreScopeDimension(
  scope: ScopeExtractionResult,
  targetTeamSize: number
): number {
  // The scope extraction prompt calculates rci_scope_score internally.
  // We use it directly — capped at 50.
  // If the score is already provided and reasonable, use it.
  const raw = scope.rci_scope_score ?? 0;
  return Math.min(50, Math.max(0, raw));
}

// ─── Composite scorer ─────────────────────────────────────────────────────────

function matchTier(total: number): MatchTier {
  if (total >= 75) return 'High';
  if (total >= 50) return 'Calibration';
  return 'Stretch';
}

export function scoreCandidate(
  candidate: PeopleRecord,
  baseline: RCIBaseline,
  scope: ScopeExtractionResult | null
): RCIResult {
  const fn    = scoreFunction(candidate.function, baseline.function);
  const lvl   = scoreLevel(candidate.level, baseline.level);
  const ind   = scoreIndustryTier(candidate.industryTier, baseline.industryTier);
  const size  = scoreCompanySize(candidate.companySize, baseline.companySize);
  const geo   = scoreGeography(candidate.geography, baseline.geography);
  const sc    = scope ? scoreScopeDimension(scope, baseline.targetTeamSize) : 0;

  const total = fn + lvl + ind + size + geo + sc;

  return {
    total: Math.min(100, total),
    breakdown: {
      function: fn,
      level: lvl,
      industryTier: ind,
      companySize: size,
      geography: geo,
      scope: sc,
    },
    matchTier: matchTier(total),
  };
}

// ─── Scout Limiter ────────────────────────────────────────────────────────────

export function calculateScoutTarget(
  vaultSweepCount: number,
  sessionCap: number = 25
): ScoutLimiterResult {
  const scoutTarget = Math.max(0, 50 - vaultSweepCount);
  const slateIsFull = vaultSweepCount >= 50;
  const sessionLimit = slateIsFull ? 0 : Math.min(scoutTarget, sessionCap);
  const sessionCapApplies = !slateIsFull && scoutTarget > sessionCap;
  return { scoutTarget, sessionLimit, slateIsFull, sessionCapApplies };
}

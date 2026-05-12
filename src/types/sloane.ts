// ─── Intent ──────────────────────────────────────────────────────────────────

export type Intent =
  | 'kickoff'
  | 'generate_jd'
  | 'generate_pdf'
  | 'run_vault_sweep'
  | 'run_scout'
  | 'refine_search'
  | 'status_request'
  | 'help'
  | 'unknown';

export interface IntentResult {
  intent: Intent;
  confidence: 'high' | 'low';
  entities: Record<string, string>;
}

// ─── Conversation ─────────────────────────────────────────────────────────────

export type MessageRole = 'user' | 'assistant';

export interface ConversationMessage {
  role: MessageRole;
  content: string;
  timestamp: string; // ISO 8601
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  intent?: Intent;
  stage?: SearchStage;
  userId?: string;
  candidates?: CandidateCardData[];
  isStatusCard?: boolean;
  isCheckpoint?: boolean;
}

// ─── Search Stage ─────────────────────────────────────────────────────────────

export type SearchStage =
  | 'Calibration'
  | 'JD Draft'
  | 'Vault Sweep'
  | 'Scout'
  | 'PM Review'
  | 'Complete';

// ─── Search Parameters (collected during kickoff intake) ──────────────────────

export interface SearchParameters {
  companyName?: string;
  role?: string;
  builderOperatorPref?: 'Builder' | 'Operator' | 'Hybrid';
  boardReporting?: boolean;
  northStarUrls?: string[];
  refinements?: SearchRefinement[];
}

export interface SearchRefinement {
  type: 'level' | 'industry' | 'builder_signal' | 'exclusion' | 'other';
  value: string;
  appliedAt: string; // ISO 8601
}

// ─── Airtable Records ─────────────────────────────────────────────────────────

export interface SearchRecord {
  id: string;
  clientName: string;
  placementPos: string;
  clientLogoUrl: string | null;
  rubricComplete: boolean;
  rubricUrl: string | null;
  partner1Name: string | null;
  partner1Email: string | null;
  partner1Phone: string | null;
  partner2Name: string | null;
  partner2Email: string | null;
  partner2Phone: string | null;
  pmName: string | null;
  pmEmail: string | null;
  pmPhone: string | null;
}

export interface SloaneRecord {
  id: string;
  // Links
  searchId: string; // Searches record ID
  // Session & State
  sessionId: string;
  stage: SearchStage;
  searchParameters: SearchParameters;
  conversationHistory: ConversationMessage[];
  lastActive: string;
  // JD Outputs
  jdDraftSloane: string | null;    // Write-once baseline
  jdWorkingCopy: string | null;    // PM edits this
  jdStatus: 'Draft' | 'In Review' | 'Final' | null;
  jdPdfUrl: string | null;         // Permalink — set once, never regenerated
  // Sourcing Intelligence
  rciBaseline: RCIBaseline | null;
  teamSize: string | null;  // singleLineText — accommodates ranges like "15 - 20" or "10+"
  northStarUrl: string | null;
  scopeFingerprint: ScopeFingerprint | null;
  internalSlate: SlateEntry[] | null;
  externalSlate: SlateEntry[] | null;
  feedbackContext: FeedbackContext | null;
  // Scout Limiter
  vaultSweepCount: number | null;
  scoutTarget: number | null;
  scoutSessionCap: number | null;
}

export interface SlateEntry {
  candidateId?: string; // People record ID (if matched)
  sourcingQueueId: string;
  linkedinUrl: string;
  name: string;
  rciScore: number;
  matchTier: MatchTier;
}

// ─── RCI Scoring ──────────────────────────────────────────────────────────────

export type SecurityFunction =
  | 'Security Engineering'
  | 'SecOps'
  | 'GRC'
  | 'Offensive Security'
  | 'Cloud Security'
  | 'IAM'
  | 'Threat Intelligence'
  | 'Security Architecture'
  | 'Leadership / CISO';

export type SecurityLevel =
  | 'IC-I'
  | 'IC-II'
  | 'IC-III'
  | 'Lead'
  | 'Manager'
  | 'Director'
  | 'VP/CISO';

export type IndustryTier = 'A' | 'B' | 'C';

export type CompanySize =
  | 'Startup (<200)'
  | 'Mid-Market (200-2K)'
  | 'Enterprise (2K-10K)'
  | 'Large (10K-50K)'
  | 'Global (50K+)';

export type GeographyTier = 'Tier 1' | 'Tier 2' | 'Tier 3' | 'International';

export type MatchTier = 'High' | 'Calibration' | 'Stretch';

export interface RCIBaseline {
  function: SecurityFunction;
  level: SecurityLevel;
  industryTier: IndustryTier;
  companySize: CompanySize;
  geography: GeographyTier;
  targetTeamSize: number;
  confidence: 'high' | 'medium' | 'low';
  companyResearch?: CompanyResearch;
}

export interface CompanyResearch {
  industryTier: IndustryTier;
  companySizeBand: CompanySize;
  fundingStage: string;
  estimatedSecurityTeamSize: number;
  confidence: 'high' | 'medium' | 'low';
  notes: string;
}

export interface RCIResult {
  total: number; // 0–100
  breakdown: {
    function: number;
    level: number;
    industryTier: number;
    companySize: number;
    geography: number;
    scope: number;
  };
  matchTier: MatchTier;
}

export interface ScoutLimiterResult {
  scoutTarget: number;
  sessionLimit: number;
  slateIsFull: boolean;
  sessionCapApplies: boolean;
}

export interface ScoutSession {
  sessionLimit: number;
  scoutTarget: number;
  sessionCap: number;
  profilesScraped: number;
  candidatesWritten: number;
  tierCounts: { high: number; calibration: number; stretch: number };
  consecutiveJsonErrors: number;
}

// ─── Scope Extraction (matches PRD §10 JSON schema) ──────────────────────────

export interface RoleTitleEntry {
  title: string;
  company: string;
  company_size_estimate: '<500' | '500-999' | '1000-4999' | '5000-9999' | '10000+';
  start_year: number;
  end_year: number | 'present';
  tenure_months: number;
  arc_tag: 'Builder' | 'Operator' | 'Hybrid';
}

export interface TeamSizeResult {
  value: number | null;
  confidence: 'explicit' | 'inferred';
  evidence: string | null;
  federation: boolean;
  federated_functions: string[] | null;
  anomaly_flag: boolean;
  anomaly_note: string | null;
  score: number;
}

export interface ReportingLineResult {
  reported_to: string | null;
  score: number;
  confidence: 'explicit' | 'inferred' | 'unclear';
  evidence: string | null;
}

export interface ProgramBreadthResult {
  domains: string[];
  score: number;
}

export interface BuilderSignalResult {
  category: 'Builder' | 'Operator' | 'Hybrid';
  temporal_sequence: 'builder_first' | 'operator_first' | 'concurrent' | null;
  evidence_builder: string[];
  evidence_operator: string[];
  confidence: 'high' | 'medium' | 'low';
}

export interface BoardExposureResult {
  value: boolean;
  score: number;
  confidence: 'explicit' | 'implied' | 'absent';
  evidence: string | null;
}

export type TechnicalDepthTier = 1 | 2 | 3 | 4;
export type TechnicalDepthLabel =
  | 'Engineering-Led'
  | 'Technical-Adjacent'
  | 'Governance-Led'
  | 'Hybrid';

export interface TechnicalDepthResult {
  tier: TechnicalDepthTier;
  label: TechnicalDepthLabel;
  degree_signal: string | null;
  cert_signals: string[];
  career_arc_summary: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface ScopeExtractionResult {
  resume_available: boolean;
  role_title_history: RoleTitleEntry[];
  tour_of_duty_signal: boolean;
  short_tenure_flag: boolean;
  team_size: TeamSizeResult;
  reporting_line: ReportingLineResult;
  program_breadth: ProgramBreadthResult;
  builder_signal: BuilderSignalResult;
  board_exposure: BoardExposureResult;
  technical_depth: TechnicalDepthResult;
  rci_scope_score: number;
  technical_depth_score: number;
  overall_confidence: 'high' | 'medium' | 'low';
}

export interface ScopeFingerprint {
  targetBuilderSignal: 'Builder' | 'Operator' | 'Hybrid' | null;
  targetTechnicalDepth: TechnicalDepthLabel | null;
  targetDomains: string[];
  targetTeamSize: number;
  targetReportingLine: string | null;
  derivedFrom: 'north_star' | 'calibration' | 'inference';
  sourceUrls?: string[];
}

// ─── Sourcing Queue ───────────────────────────────────────────────────────────

export type DatabaseMatchStatus = 'Pending' | 'Matched' | 'Unmatched';
export type PMDecision = 'Pending' | 'Add to Search' | 'Reject';

export interface SourcingQueueWrite {
  // Always written (two-column pattern — raw fields first)
  candidateNameRaw: string;
  linkedinUrlRaw: string;
  searchId: string;
  source: 'Sweep' | 'Scout';
  // Database match (written after People lookup)
  candidateLinkedId?: string; // People record ID if matched
  databaseMatchStatus: DatabaseMatchStatus;
  // RCI & Scope
  rciScore: number;
  adjRankScore: number;
  matchTier: MatchTier;
  builderSignal: 'Builder' | 'Operator' | 'Hybrid';
  technicalDepth: TechnicalDepthLabel;
  scopeConfidence: 'High' | 'Medium' | 'Low';
  technicalDepthScore: number;
  rciScopeScore: number;
  // Flags
  anomalyFlag: boolean;
  anomalyNote?: string;
  tourOfDutySignal: boolean;
  shortTenureFlag: boolean;
  // Evidence
  roleTitleHistory: RoleTitleEntry[];
  sloaneMatchRationale: string;
  programDomains: string[];
}

export interface SourcingQueueRecord extends SourcingQueueWrite {
  id: string;
  pmDecision: PMDecision;
  rejectionReason?: string;
  rejectionNotes?: string;
  createdAt: string;
}

// ─── Candidate Card (UI) ─────────────────────────────────────────────────────

export interface CandidateCardData {
  sourcingQueueId: string;
  name: string;
  currentTitle?: string;
  company?: string;
  rciScore: number;
  adjRankScore?: number;
  matchTier: MatchTier;
  builderSignal: 'Builder' | 'Operator' | 'Hybrid';
  technicalDepth: TechnicalDepthLabel;
  scopeConfidence: 'High' | 'Medium' | 'Low';
  anomalyFlag: boolean;
  anomalyNote?: string;
  tourOfDutySignal: boolean;
  airtableUrl?: string;
}

// ─── Rubric Table ────────────────────────────────────────────────────────────

export interface RubricRecord {
  id: string;
  // Completeness gate — Phase 1 will not proceed unless 'Draft Ready' | 'Approved'
  rubricDraftStatus: string | null;
  // Role parameters (RCI inputs)
  location: string | null;
  teamSizeToday: string | null;
  estTeamSize1824mo: string | null;
  // JD content fields (Phase 2 inputs)
  successInRole: string | null;
  functionalResponsibilities: string | null;
  mustHave: string | null;
  niceToHave: string | null;
  redFlags: string | null;          // Also used as Phase 3/4 exclusion filter
  conflictNarrative: string | null;
  rubricMatrixJson: string | null;  // Full rubric as structured JSON — authoritative source
  // Artifacts
  rubricPdfUrl: string | null;
  rubricUrl: string | null;
}

// ─── People Table ─────────────────────────────────────────────────────────────

export interface PeopleRecord {
  id: string;
  name: string;
  currentTitle?: string;
  linkedinUrl?: string;
  resumeUrl?: string;
  resumeText?: string;
  doNotContact: boolean;
  function?: SecurityFunction;
  level?: SecurityLevel;
  industryTier?: IndustryTier;
  companySize?: CompanySize;
  geography?: GeographyTier;
}

// ─── RLHF / Feedback Context ──────────────────────────────────────────────────

export type FeedbackConfidence = 'High' | 'Medium' | 'Low' | 'None';

export interface AcceptancePattern {
  category: string;
  totalDecided: number;
  accepted: number;
  rejected: number;
  acceptanceRate: number;
  multiplier: number; // 0.7–1.3
}

export interface FeedbackContext {
  confidence: FeedbackConfidence;
  totalDecidedRecords: number;
  builderSignalPatterns: AcceptancePattern[];
  technicalDepthPatterns: AcceptancePattern[];
  plainLanguageSummary: string;
}

// ─── Phase Results ────────────────────────────────────────────────────────────

export interface Phase1Result {
  rciBaseline: RCIBaseline;
  scopeFingerprint: ScopeFingerprint | null;
  chatSummary: string;
}

export interface Phase2Result {
  jdText: string;
  pdfUrl: string;
  chatMessage: string;
}

export interface VaultSweepUpdate {
  type: 'batch_progress' | 'complete';
  batchNumber?: number;
  batchResults?: { high: number; calibration: number; stretch: number };
  totalCandidates?: number;
  tierBreakdown?: { high: number; calibration: number; stretch: number };
  message: string;
}

export interface ScoutUpdate {
  type: 'mode_set' | 'scraping' | 'batch_progress' | 'complete';
  message: string;
  candidates?: CandidateCardData[];
  totalCandidates?: number;
  tierBreakdown?: { high: number; calibration: number; stretch: number };
  anomalyCount?: number;
}

// ─── API Request / Response ───────────────────────────────────────────────────

export interface SloaneAPIRequest {
  searchId: string;
  message: string;
  userId: string;
}

export interface SloaneAPIResponse {
  message: string;
  intent: Intent;
  stage: SearchStage;
  metadata?: MessageMetadata;
}

export interface CandidateInput {
  name: string;
  linkedinUrl: string;
  profileText: string;
  resumeText: string | null;
  peopleRecordId?: string;
}

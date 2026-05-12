# Sloane — Claude Code Instructions

## Project Overview

Sloane is Hitch Partners' agentic research system for cybersecurity executive search. It automates the search standup process — drafting JDs and sourcing candidate slates for Partners and PMs.

**Pipeline:** Sloane feeds downstream agents (Rubric Agent, Candidate Tile Agent). It does not replace them.  
**Interface:** Chat is command-layer only. All work product lives in Airtable. PMs review and approve in Airtable, not in chat.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router) |
| Deployment | Vercel |
| Database / CRM | Airtable (base: `app8IuY5nHuUvrri4`) |
| AI | Anthropic Claude API (`claude-sonnet-4-20250514`) |
| External Sourcing | Apify — LinkedIn scraper (Sprint 3) |
| PDF | Match Tile/Rubric pipeline exactly |
| Language | TypeScript |

---

## Architecture — Locked Decisions

Do not propose alternatives without explicit instruction.

1. **Server-side prompts only** — All Claude prompts live in API routes, loaded from env vars at runtime. Never in client components, logs, or response payloads.
2. **Write boundary** — Sloane writes to Sloane table and Sourcing Queue only. Searches, People, ProjStat, ITI Input are read-only. Never write to canonical tables.
3. **One Sloane record per search** — Single record linked to the Searches record. All outputs, history, and JD artifacts go here.
4. **Two-column linked record pattern** — Write `Candidate-Name-Raw` + raw LinkedIn URL first (always succeed), then attempt People lookup. If matched: write record ID to `Candidate` + set `Match-Status = Matched`. Never auto-create People records.
5. **Conversation state in Airtable** — History persisted to `Conversation History` (JSON array) after every exchange. No in-memory state across requests.
6. **No client-side Airtable writes** — All Airtable ops go through API routes.
7. **Sourcing Queue dedup** — Before every write, check for existing record by `Candidate-Name-Raw` + Search. Update if found; create if not.
8. **Session auth on every route** — Every browser-facing API route calls `verifySessionToken` before any business logic. Proxy only checks cookie presence.

---

## Environment Variables

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API |
| `AIRTABLE_API_KEY` | Airtable access |
| `AIRTABLE_BASE_ID` | Target base |
| `LOGIN_SECRET` | 32-char hex — HMAC-signs session tokens. Required in all envs. |
| `INTERNAL_API_KEY` | 32-char hex — server-to-server auth for `/api/jd-pdf`. Fails closed if unset. |
| `ALLOWED_USERS` | Comma-separated permitted emails |
| `USER_PINS` | JSON: `{"email":"pin"}` — plaintext for now; add bcrypt before external exposure |
| `SCOPE_EXTRACTION_PROMPT` | Core IP prompt — never expose to client |
| `INTENT_CLASSIFICATION_PROMPT` | Intent routing prompt — never expose. Must include `help` triggers. |
| `SLOANE_HELP_TEXT` | Command reference returned on `help` intent. Overrides hardcoded fallback in `src/config/commands.ts`. Update in Vercel to change without a code deploy. |
| `APIFY_API_KEY` | LinkedIn scraper (Sprint 3) |

Full reference: `docs/environment-variables.md`

---

## Airtable Table Reference

Full schema: `docs/airtable-schema.md`

| Table | ID | Access | Purpose |
|---|---|---|---|
| Searches | `tbl3Rxp2k7PwPku80` | Read only | ClientName, PlacementPos, logo, rubric_url lookup |
| Rubric | `tblH7zYMvIJq34B2R` | Read only | JD content fields, RCI inputs, completeness gate |
| People | `tblnVLxo1bfjAS8De` | Read only | Internal candidate database |
| ProjStat | `tblZNG7hhQVHZb6YY` | Read only | Project-level candidate tracking |
| ITI Input | `tblbmfWRzG3VZtD88` | Read only | Interviewer scores → Rubric Agent source |
| Sloane | `tbllD6a10ozwqPMi6` | Read + Write | One record per search. All Sloane outputs. |
| Sourcing Queue | `tblMjCnWktY2rMRpV` | Read + Write | All sourced candidates. PM review layer. |

> Live Sourcing Queue table name is `Sourcing Que`. Always use the table ID.

### Live Field Name Corrections (where live name differs from spec)

| Table | Spec name | Live field name |
|---|---|---|
| People | `Do Not Contact` | `Do Not Include in Search` |
| People | `LinkedIn URL` | `LinkedIn` |
| People | `Current Title` | `Title` |
| People | `Name` | `FullName` |
| Sloane | `Search` | `Search Project` |
| Sloane | `JD Working Copy` | `JD Draft-WorkingCopy` |
| Sloane | `JD Status` | `JD-Status` |
| Sloane | `JD PDF` | `JD-PDF` |
| Sloane | `JD PDF URL` | `JD-url` |
| Sloane | `RCI Baseline` | `RCI-Baseline` |
| Sloane | `North Star URL` | `NorthStar-url` |
| Sloane | `Scope Fingerprint` | `Scope-Fingerprint` |
| Sourcing Queue | `Search (Linked)` | `Search` |
| Sourcing Queue | `Candidate Name (Raw)` | `Candidate-Name-Raw` |
| Sourcing Queue | `Database Match Status` | `Match-Status` |

---

## Intent Taxonomy

Runs on **every** message before any other logic. Lightweight Claude API call (`claude-haiku-4-5-20251001`). Never regex or keyword matching.

| Intent | Example Triggers | Handler |
|---|---|---|
| `kickoff` | "Start BreachRx CISO", "Kick off", "Stand up", "New search" | Kickoff intake → Phase 1 |
| `generate_jd` | "Draft the JD", "Write the JD", "Generate JD" | Phase 2 |
| `generate_pdf` | "Generate the PDF", "PDF please", "JD looks good, go ahead" | PDF generation |
| `run_vault_sweep` | "Run the vault sweep", "Check internal candidates" | Phase 3 (SSE stream) |
| `run_scout` | "Run the scout", "Find external candidates", "Search LinkedIn" | Phase 4 (SSE stream) |
| `refine_search` | "Too senior", "Focus on FinServ", "Builder profile only", "Only scrape N profiles" | RLHF refinement |
| `status_request` | "Where are we on BreachRx", "What's the status" | Status summary |
| `help` | "help", "?", "commands", "what can you do", "/help" | Command reference (`SLOANE_HELP_TEXT`) |
| `unknown` | Anything not matching above | "I didn't catch that…" |

> `INTENT_CLASSIFICATION_PROMPT` env var must include `help` triggers. Update it whenever the intent list changes.

---

## Kickoff Intake Flow

**Required inputs:** Company Name, Role (always pull from Searches record as canonical source — don't ask if the record exists)  
**Optional:** Builder/Operator preference + Board Reporting (always asked together as a pair), North Star LinkedIn URLs

Rules:
- Max 2 questions per response
- Company + Role both missing → ask together in one message
- Builder/Operator + Board Reporting → always asked as a pair in one message
- North Star URLs optional — if absent, note Inference mode and proceed
- Partial inputs registered immediately — never re-ask confirmed inputs

**Hard blockers — never proceed past these:**
- No Searches record: `"I don't see a [Company] search set up in Airtable yet. Once the Searches record is created and linked, send me the command again and I'll get started."`
- No Rubric URL: `"I found the [Company] search record but the Rubric isn't complete yet. Once the ITI process is done and the Rubric is generated, I'm ready to go."`
  - **Gate:** `searchRecord.rubricUrl` (from `rubric_url (from Rubric)` lookup field, `fldVWsc08jOoMkiUH`) must be non-null
  - `searchRecord` is already loaded in `handleKickoff` — check directly, do not call `checkRubricComplete()`

---

## Phase Workflow

```
Phase 1 — Contextual Calibration
  Gate: searchRecord.rubricUrl non-null
  Actions: readRubric() → researchCompany() → generateRCIBaseline()
           → scope extraction on North Star URLs if provided → scopeFingerprint
  Output: RCI Baseline written to Sloane record. Checkpoint in chat before Phase 2.

Phase 2 — JD Draft
  Trigger: generate_jd intent
  Actions: generateJD(rubric, baseline, research, params, contacts)
           → write JD Draft-Sloane (write-once — skip if already set)
           → write JD Draft-WorkingCopy
           → generateJdPdf() → Vercel Blob put() → writeJdPdfToSloane()
           → set JD-url permalink once (never regenerate)
           → set JD-Status = Draft
  Note: PDF is generated at JD draft time AND again on generate_pdf command.
        JD-url permalink never changes; JD-PDF attachment overwrites each time.

Phase 3 — Vault Sweep (SSE stream)
  Trigger: run_vault_sweep intent
  Actions: queryPeopleByRCI() → processBatch() in batches of 10 (concurrency ≤ 5)
           → stream batch_complete events → scoreCandidate() → writeSourcingQueueRecord()
           → on complete: write vaultSweepCount, scoutTarget (50 - count), scoutSessionCap (default 25)
  Output: Internal slate in Sourcing Queue. Summary in chat.

Phase 4 — External Scout (SSE stream)
  Trigger: run_scout intent
  Modes: north_star (northStarUrl set) | calibration (scopeFingerprint set) | inference (ask 2 Qs first)
  Actions: getCandidateUrlQueue() → scrapeLinkedInProfile() [Apify — stub]
           → DNC check → processBatch() → scoreCandidate() → writeSourcingQueueRecord()
           → fill to 50 total; High Match first → Calibration → Stretch
  Output: Sourcing Queue at 50 candidates. Chat summary with tier breakdown.
```

---

## RCI Scoring

| Dimension | Max | Notes |
|---|---|---|
| Function | 30 | Exact match only |
| Level | 20 | Adjacent = 10 pts |
| Industry Tier | 15 | Adjacent = 8 pts |
| Company Size | 15 | Adjacent = 8 pts |
| Geography | 10 | Partial by tier proximity |
| Scope | 50 | Via scope extraction prompt |

Match tiers: **High** (75–100) / **Calibration** (50–74) / **Stretch** (<50)  
Full spec: `docs/rci-scoring-logic.md`

---

## PDF Generation

1. Fetch `client_logo` attachment from Searches record
2. Render: logo header + ClientName + PlacementPos title block + JD Working Copy body
3. Filename: `{ClientName}_{PlacementPos}_JD.pdf` — no version number, no suffix
4. Upload to Vercel Blob with `allowOverwrite: true`
5. Write to `JD-PDF` attachment field on Sloane record (overwrites every time)
6. `JD-url` permalink — set once at record creation, never regenerated

Match Tile/Rubric pipeline implementation exactly.

---

## Error States

| Error | User-facing message | Recovery |
|---|---|---|
| Airtable unreachable | "I'm having trouble connecting to Airtable right now. Please try again in a moment." | Retry once after 3s |
| Search not found | "I don't see a [Company] search set up in Airtable yet…" | Wait |
| Rubric not complete | "I found the [Company] search record but the Rubric isn't complete yet…" | Wait |
| Claude API timeout | "I'm taking longer than expected on this step. Give me a moment." | Retry once |
| Malformed history | Log server-side. Reinitialize as `[]`. Don't surface. | Continue |
| Apify zero results | "The external scout didn't return any results… Want me to try broadening?" | Surface, wait |
| Scope extraction bad JSON | Log, skip candidate. After batch: "I wasn't able to score [n] candidates…" | Continue |

---

## Sprint Status

| Sprint | Status | What's implemented |
|---|---|---|
| Sprint 1 — Shell & Plumbing | ✓ Complete | Chat UI, session auth (HMAC), intent routing, kickoff intake, Airtable R/W, security hardening |
| Sprint 2 — Core Intelligence | ✓ Complete | Claude API, Phase 1 (RCI Baseline), Phase 2 (JD + PDF), Phase 3 (Vault Sweep + SSE) |
| Sprint 3 — External Scout | 🔄 In progress | Phase 4 structure complete; Apify stub at `scrapeLinkedInProfile()` in `route.ts` — replace with real API call |
| Sprint 4 — Polish & RLHF L2 | Pending | Phase indicator UI, candidate cards, RLHF refinement, feedback context injection |

**Post-sprint updates applied:**
- **Update 3:** Active-only filter on search selector (`{Status} = "Active"`); rubric URL link in UI; `help` intent + command reference (`src/config/commands.ts`); rubric gate now uses `searchRecord.rubricUrl` instead of `checkRubricComplete()`

**Current sprint: Sprint 3**

---

## Sloane Persona

Tenured senior research associate — methodical, decisive, precise.
- First person: "I found 8 matches" not "8 results were returned"
- Data-backed conclusions with evidence
- Transparent about confidence gaps — states them, never apologizes
- Max 2 questions per response
- Never refers to itself as an AI, chatbot, or tool

---

## Key Rules

1. Never write to Searches, People, ProjStat, or ITI Input tables
2. Never expose prompts to the client
3. Never hardcode env vars or log secrets
4. Never auto-create People records for unmatched candidates
5. Always write raw fields before attempting linked record writes
6. Always persist conversation history to Airtable after each exchange
7. **Phase 1 gate:** check `searchRecord.rubricUrl` — do not call `checkRubricComplete()`
8. `JD Draft-Sloane` is write-once — skip if already set
9. `JD-url` is a permalink — set once, never regenerated
10. Scope extraction: batches of 10, concurrency ≤ 5, stream results progressively
11. Deduplicate before every Sourcing Queue write
12. Check `Do Not Include in Search` before writing any candidate to Sourcing Queue
13. Intent classification runs before all other logic on every message
14. Max 2 questions per Sloane response
15. Every API route calls `verifySessionToken` before business logic
16. Never include `LOGIN_SECRET` or `INTERNAL_API_KEY` in responses, logs, or client code

---

## File Structure

```
/src
  proxy.ts                         ← Middleware: cookie presence check → /login redirect
  /app
    /api
      /sloane/route.ts             ← Message handler + intent router + all phase logic
      /airtable/route.ts           ← Searches list + conversation history read
      /jd-pdf/route.ts             ← PDF generation trigger (INTERNAL_API_KEY auth)
      /auth/route.ts               ← PIN auth + session token issuance
    /chat/page.tsx                 ← Chat UI (search selector, thread, input bar, ? help button)
    /login/page.tsx
  /components/chat
    ChatThread.tsx
    MessageBubble.tsx
    InputBar.tsx
    SearchSelector.tsx             ← Active-only filter; rubric URL link display
    CandidateCard.tsx
    ThemeToggle.tsx
  /config
    commands.ts                    ← getHelpText() — reads SLOANE_HELP_TEXT env var, hardcoded fallback
  /lib
    airtable.ts                    ← All Airtable helpers; formula injection safety via sanitizeFormulaValue
    claude.ts                      ← researchCompany(), generateRCIBaseline(), generateJD()
    intent.ts                      ← classifyIntent() using Haiku
    session.ts                     ← HMAC-SHA256 sign/verify
    rci.ts                         ← scoreCandidate(), calculateScoutTarget()
    scope.ts                       ← processBatch() with concurrency limit (p-limit, cap 5)
    pdf.ts                         ← generateJdPdf()
  /types
    sloane.ts                      ← All shared TypeScript types
/docs
  airtable-schema.md
  environment-variables.md
  rci-scoring-logic.md
```

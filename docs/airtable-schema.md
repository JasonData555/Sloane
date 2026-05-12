# Airtable Schema Reference

Base: Hitch Partners (`app8IuY5nHuUvrri4`)

Sloane may **read** from: Searches, People, ProjStat, ITI Input.  
Sloane may **write** to: Sloane table, Sourcing Queue table only.

---

## Existing Tables (Read Only)

### Searches
**Table ID:** `tbl3Rxp2k7PwPku80`

| Field | Field ID | Type | Notes |
|---|---|---|---|
| ClientName | `fld7sZRMpwbxnzLeF` | multipleRecordLinks | Company name. Live type is a linked record to Organizations — use lookup `client_name` (formula) for display. |
| PlacementPos | `fld6CSDAc6O5BxUty` | singleLineText | Role title (e.g. "CISO") |
| client_logo | `fld0rEaHlwUmEZab9` | multipleAttachments | Company logo for PDF |
| client_name | `fldVERYL3ENg6U6Xr` | formula | <!-- FOUND IN LIVE BASE: not in PRD spec, confirm inclusion --> Derived display name for the client. Use for display/PDF rendering. |
| Rubric | `fldv54gpjC82QNosr` | multipleRecordLinks | <!-- FOUND IN LIVE BASE: not in PRD spec, confirm inclusion --> Link to Rubric records. Used by Sloane to check Rubric completeness. |
| Sloane | `fldTSiUdjJyytMvts` | multipleRecordLinks | <!-- FOUND IN LIVE BASE: not in PRD spec, confirm inclusion --> Back-link to Sloane table records for this search. |
| Sourcing Que | `fldCyWhVuXsD171Q6` | multipleRecordLinks | <!-- FOUND IN LIVE BASE: not in PRD spec, confirm inclusion --> Back-link to Sourcing Que records for this search. |
| rubric_url (from Rubric) | `fldVWsc08jOoMkiUH` | multipleLookupValues | <!-- FOUND IN LIVE BASE: not in PRD spec, confirm inclusion --> Lookup of the Rubric PDF URL. |
| Partner 1 Name | *(pending field ID)* | singleLineText | Lead Partner on the search. Read-only from Sloane. Populated manually per search. |
| Partner 1 Email | *(pending field ID)* | email | Lead Partner email. Read-only from Sloane. |
| Partner 1 Phone | *(pending field ID)* | phoneNumber | Lead Partner phone. Read-only from Sloane. |
| Partner 2 Name | *(pending field ID)* | singleLineText | Second Partner on the search (if applicable). Read-only from Sloane. |
| Partner 2 Email | *(pending field ID)* | email | Second Partner email. Read-only from Sloane. |
| Partner 2 Phone | *(pending field ID)* | phoneNumber | Second Partner phone. Read-only from Sloane. |
| PM Name | *(pending field ID)* | singleLineText | Program Manager on the search. Read-only from Sloane. |
| PM Email | *(pending field ID)* | email | Program Manager email. Read-only from Sloane. |
| PM Phone | *(pending field ID)* | phoneNumber | Program Manager phone. Read-only from Sloane. |

### People
**Table ID:** `tblnVLxo1bfjAS8De`

| Field | Field ID | Type | Notes |
|---|---|---|---|
| FullName | `fldoL70hjsgVDnLix` | formula | Candidate full name. **Live field name is `FullName`, not `Name`.** |
| Title | `fldu6YfH4ekHaGL6I` | singleLineText | Current role. **Live field name is `Title`, not `Current Title`.** |
| LinkedIn | `flddLPk3PhVj5q9LY` | url | Used for database match lookup. **Live field name is `LinkedIn`, not `LinkedIn URL`.** |
| Resume | `fldTbNM3s6318gECo` | multipleAttachments | PDF/DOCX for scope extraction |
| Do Not Include in Search | `fldVvScyvGZbLkFAM` | checkbox | Exclude silently if true — never surface to user. **Live field name is `Do Not Include in Search`, not `Do Not Contact`.** |
| Function | — | — | <!-- TO CREATE: field not found in live base --> RCI dimension — security function category |
| Level | — | — | <!-- TO CREATE: field not found in live base --> RCI dimension — seniority level |
| Industry Tier | — | — | <!-- TO CREATE: field not found in live base --> RCI dimension — A / B / C |
| Company Size | — | — | <!-- TO CREATE: field not found in live base --> RCI dimension — size band |
| Geography | — | — | <!-- TO CREATE: field not found in live base --> RCI dimension — Tier 1 / 2 / 3 |

### ITI Input
**Table ID:** `tblbmfWRzG3VZtD88`

| Field | Field ID | Type | Notes |
|---|---|---|---|
| Search Project | `fldgT0ZS6AjSWZhgh` | multipleRecordLinks | Parent search. **Live field name is `Search Project`, not `Search`.** |
| (rubric fields) | — | Various | Source for Rubric Agent. Sloane reads to check completeness. See full field list below. |

#### ITI Input — Full Field List (for completeness checks)
| Field | Field ID | Type |
|---|---|---|
| Interviewer_SearchProject | `fld0KygQyXJQd7kIA` | formula |
| search_project | `fldMcc8GGa37FPjTb` | formula |
| Interviewer | `fldxLua428sOl9EdI` | multipleRecordLinks |
| Interview Order | `fld8iz9GqvVddWmYK` | multipleSelects |
| panel_member | `fldv2pgrBGYRiZhvM` | formula |
| panel_member_title | `fldAoMVddOLY4IJfu` | multipleLookupValues |
| Reports To | `fldOAxJzfpHrwaNpP` | singleSelect |
| Location Requirement | `fldnQzPoVMHCg9gGb` | singleLineText |
| team_size_today | `fldXZjg3NguQGZJQr` | singleLineText |
| team_size_18months | `fld0oyUmutnQUi5Ks` | singleLineText |
| Manage IT | `fldC4yLTj3WikMQ2e` | singleSelect |
| ProdSec_AppSec | `fldWX1zaUkWb3hF8K` | singleSelect |
| AI Security | `fldlgngAE6Tww4JQJ` | singleSelect |
| GRC | `fldsm0TxwCwqQXrra` | singleSelect |
| Security Architecture | `fldTiDP9fjDHKzM0p` | singleSelect |
| Network and Infrastructure Security | `fldztFdqNsmyUhDk3` | singleSelect |
| TPRM | `fldXPUGI97bh3e4H5` | singleSelect |
| Data Protection and Privacy | `fldBj0Q0mAIp6lvGY` | singleSelect |
| IAM | `fldngzFC8oXTXjQ6I` | singleSelect |
| Cloud Security | `fldGjgZWMZw1K0Wli` | singleSelect |
| Security Operations | `fld7NeEHLVrgSNnXq` | singleSelect |
| External Communication | `fldIfNZUKI4fGg97S` | singleSelect |
| Team Bldg and Leadership | `fldKlJcoFrPALg1Cs` | singleSelect |
| Notes | `fldtbSU3PcaMm7WbG` | multilineText |
| Interview Schedule | `fldoj2VtkIfuPedUK` | multipleRecordLinks |

### Rubric
**Table ID:** `tblH7zYMvIJq34B2R`

Sloane navigates here via the `Rubric` linked field (`fldv54gpjC82QNosr`) on the Searches record. All five JD-content fields live here. `Rubric Draft Status` is the completeness gate — Sloane will not proceed past kickoff unless status is `Draft Ready` or `Approved`.

#### Identity & Links
| Field | Field ID | Type | Notes |
|---|---|---|---|
| Search | `fldrj86TAo95eewHo` | formula | Display name for the linked search |
| Client | `fldhKW0IDPlhBgi5Q` | multipleRecordLinks | Linked to Organizations |
| client_name | `fld2hqdgoSDTy2vTV` | formula | Client display name |
| client_logo | `fldaJhPbfI5Za7VTA` | multipleLookupValues | Logo lookup from Client |

#### Role Parameters (RCI inputs)
| Field | Field ID | Type | Notes |
|---|---|---|---|
| Location | `fldh7FtsSJM34hHlz` | singleLineText | Role geography — maps to RCI Geography dimension |
| Team Size Today | `fldcLvk22ei0Swc1p` | singleLineText | Current team headcount — scope extraction input |
| Est Team Size 18 - 24 mo | `fldvSjvtNnbHhm7Vd` | singleLineText | Projected headcount — scope extraction input |

#### JD Content Fields (Phase 2 inputs — all richText)
| Field | Field ID | Type | Notes |
|---|---|---|---|
| Success in the Role | `fldct38eXHU1sjvF9` | richText | What good looks like in year 1–2 |
| Functional Responsibilities | `flddsIZBhaS2saf3z` | richText | Day-to-day scope and ownership areas |
| Must Have | `fldlOgjqO81hUcrxF` | richText | Hard requirements — no exceptions |
| Nice to Have | `fldx6eqySwYzUCRcH` | richText | Preferred but not blocking |
| Red Flags | `fldODIY6gxMfPyC2I` | richText | Exclusion criteria — also used in Phase 3/4 filtering |
| Conflict Narrative | `fldxmLFgpgGuUkcWd` | richText | Conflict-of-interest context, if applicable |
| Rubric Matrix JSON | `fldy2f2w16YXIL4rh` | multilineText | Full rubric as structured JSON — authoritative source |

#### Status & Artifacts
| Field | Field ID | Type | Notes |
|---|---|---|---|
| Rubric Draft Status | `fldMESseYrVVEuEx4` | singleSelect | **Completeness gate.** Sloane requires `Draft Ready` or `Approved` before Phase 1. |
| Rubric PDF | `fldTher5KDZ2gtT89` | multipleAttachments | Generated PDF artifact |
| rubric_url | `fldB6voP0oBU36hcf` | url | Permalink to the hosted Rubric PDF |

---

### ProjStat
**Table ID:** `tblZNG7hhQVHZb6YY`

| Field | Field ID | Type | Notes |
|---|---|---|---|
| Name | `fldNg4kdfxERZ8evF` | formula | Auto-generated display name |
| Candidate | `fldkD5cbg67WbPOZC` | multipleRecordLinks | Linked to People |
| Stage | `fldp4AxJ1zXVwmq8H` | singleSelect | Project-level candidate stage |

---

## New Tables (Read + Write)

### Sloane Table
**Table ID:** `tbllD6a10ozwqPMi6`

One record per search engagement. **Never create more than one per Search record.**

#### Primary Field
| Field | Field ID | Type | Notes |
|---|---|---|---|
| Name | `fldMAPsd9RpXeA78x` | singleLineText | <!-- FOUND IN LIVE BASE: not in PRD spec, confirm inclusion --> Primary field. Set to a meaningful label at record creation (e.g. ClientName + PlacementPos). |

#### Links
| Field | Field ID | Type | Notes |
|---|---|---|---|
| Search Project | `fldvVWz2HvLxyl7O9` | multipleRecordLinks | Primary link. **Live field name is `Search Project`, not `Search`.** |
| Project Status | `fldPcqZHS433aV37r` | multipleRecordLinks | Optional |

#### Session & State
| Field | Field ID | Type | Notes |
|---|---|---|---|
| Session ID | *(pending field ID)* | singleLineText | UUID generated at record creation |
| Stage | `fldg5g4UgUR8MUb1W` | singleSelect | Calibration / JD Draft / Vault Sweep / Scout / PM Review / Complete |
| Search Parameters | `fldBnHZNWTbqEu4Kx` | multilineText | JSON — kickoff inputs + refinements |
| Conversation History | `fldgMvZXSPlcObUJd` | multilineText | JSON array of ConversationMessage objects |
| Last Active | `fldhA87ENdtsMttSd` | date | Updated on every message. **Live type is `date`, not `dateTime` — confirm precision is sufficient.** |

#### JD Outputs
| Field | Field ID | Type | Notes |
|---|---|---|---|
| JD Draft-Sloane | `fld6IA8S10hVnfdVy` | multilineText | **Write-once.** Never overwrite after Phase 2. |
| JD Working Copy | `fldk7BHHwkmPdsIPD` | multilineText | PM edits here in Airtable Interface. **Live field name is `JD Draft-WorkingCopy`.** |
| JD Status | `flduniYjSp9UvPBPs` | singleSelect | Draft / In Review / Final. **Live field name is `JD-Status`.** |
| JD PDF | `fldiqVhiebwTK6NiE` | multipleAttachments | Overwritten on each PDF generation command. **Live field name is `JD-PDF`.** |
| JD PDF URL | `fldaqXpHb6RvkCA1y` | url | **Permalink — set once at record creation. Never regenerate.** Live field name is `JD-url`. |

#### Sourcing Intelligence
| Field | Field ID | Type | Notes |
|---|---|---|---|
| RCI Baseline | `fldS5csOpSppMmE2V` | multilineText | JSON — six-dimension baseline from Phase 1. **Live field name is `RCI-Baseline`.** |
| Team Size | `fldttSmMI2n1G9uJd` | singleLineText | Target team size for scope extraction scoring. Stored as text to accommodate range values (e.g. "15 - 20", "10+"). |
| North Star URL | `fldeCFCp9KKGQxxrc` | url | Optional — from kickoff. **Live field name is `NorthStar-url`.** |
| Scope Fingerprint | `fldULe2spayQaBOlB` | multilineText | JSON — from North Star / calibration / inference. **Live field name is `Scope-Fingerprint`.** |
| Internal-Slate | `fldXqfAG2VHvyrKi6` | multilineText | JSON array of SlateEntry objects |
| External-Slate | `fldvzMZrPwXbB6mMg` | multilineText | JSON array of SlateEntry objects |
| Feedback-Context | `fldT9WNGLqQz64bte` | multilineText | JSON — Level 2 RLHF context (Sprint 4) |

#### Scout Limiter
| Field | Field ID | Type | Notes |
|---|---|---|---|
| Vault Sweep Count | `fld7aNqiPVwdiSuZH` | number | Count of candidates successfully written to Sourcing Queue during Phase 3. Written at Phase 3 completion. |
| Scout Target | `fld2IhuSVJrtRztNf` | number | 50 minus Vault Sweep Count (minimum 0). Calculated and written at Phase 3 completion. |
| Scout Session Cap | `fldWlLqOFobWAhv72` | number | Maximum profiles Apify scrapes in one Scout session. Default: 25. Configurable per search by PM. Never exceeds Scout Target. |

---

### Sourcing Queue Table
**Table ID:** `tblMjCnWktY2rMRpV`

All Sloane-sourced candidates. PM reviews here. **Sloane never writes to canonical tables.**

> **Note:** Live table name in Airtable is `Sourcing Que` (not `Sourcing Queue`). Use the table ID `tblMjCnWktY2rMRpV` in all API calls.

#### Primary Field
| Field | Field ID | Type | Notes |
|---|---|---|---|
| Name | `fldgPFg9APjw1xhak` | singleLineText | <!-- FOUND IN LIVE BASE: not in PRD spec, confirm inclusion --> Primary field. |

#### Two-Column Pattern (always write raw before linked)
| Field | Field ID | Type | Notes |
|---|---|---|---|
| Candidate | `fldiPrByRS83JSffq` | multipleRecordLinks | Populated when LinkedIn URL match confirmed. Do NOT enable "allow creating new records." |
| Candidate Name (Raw) | `fldKDyFNLNa2Lfil0` | singleLineText | **Always written first.** Never empty. **Live field name is `Candidate-Name-Raw`.** |
| Database Match Status | `fldA20eCbTbDOu836` | singleSelect | Pending / Matched / Unmatched. **Live field name is `Match-Status`.** |

#### Search Context
| Field | Field ID | Type | Notes |
|---|---|---|---|
| Search (Linked) | `fld74rp0F5mqEA5v5` | multipleRecordLinks | Which search this candidate was sourced for. **Live field name is `Search`.** |
| Source | `fld8JAa1ja14LFI8K` | singleSelect | Sweep (Internal) / Scout (External) |
| Created | `fldmEBquVO8WTfwXD` | createdTime | Auto-set by Airtable |

#### RCI & Scope
| Field | Field ID | Type | Notes |
|---|---|---|---|
| RCI-Score | `fldrp1MKEtYlSAidj` | number | 0–100 base score |
| Adj-Rank-Score | `fldbMMcVcAmKKqGa3` | number | Base score modified by RLHF multipliers (Sprint 4) |
| Match-Tier | `fldNP3E09MqJdWHem` | singleSelect | High / Calibration / Stretch |
| Builder-Signal | `fldJiWwUapLkEHPUX` | singleSelect | Builder / Operator / Hybrid |
| Technical-Depth | `fldTtStEgQnXSWgnD` | singleSelect | Engineering-Led / Technical-Adjacent / Governance-Led / Hybrid |
| Scope-Confidence | `fld53UZ5VXRY0JhRJ` | singleSelect | High / Medium / Low |
| Technical Depth Score | `flddkTqc9Zs4OohdB` | singleLineText | 100 / 90 / 75 / 50 by tier. **Live type is `singleLineText`, not `number`. Live field name is `Technical-Depth-Score`.** |
| RCI-Scope-Score | `fldnE9DwSVRFN8Hmj` | number | Sum of scope sub-dimension scores. Max 50. |

#### Flags & Signals
| Field | Field ID | Type | Notes |
|---|---|---|---|
| Anomaly-Flag | `fld6ZOQ1sYdGf2X3z` | checkbox | 5K–9.9K company + team size < 50 |
| Anomaly-Note | `fldHwLCiNu3uicu9C` | multilineText | PM-facing probe guidance from Sloane |
| Tour-of-Duty-Signal | `fldxNzF7Dei5vz6T8` | checkbox | 2+ consecutive 24–42 month tenures |
| Short-Tenure-Flag | `fldPBfPIdkUIAhosf` | checkbox | Any role under 18 months |

#### Evidence & PM Decision
| Field | Field ID | Type | Notes |
|---|---|---|---|
| Role-Title-History | `fldKBPW36mldLZnv3` | multilineText | JSON array from scope extraction |
| Sloane-Match-Rationale | `fldnhUCPuGVzu3s1w` | multilineText | Evidence snippets from scope extraction |
| Program-Domains | `fldQBYVPFAajCg8BA` | multilineText | JSON array of security domains |
| PM-Decision | `fldUJMLBejqmcp25C` | singleSelect | **Pending** / Add to Search / Reject. Default: Pending. |
| Rejection-Reason | `fldHGm4sFPzjx2ldl` | singleSelect | Too Sr / Too Jr / Wrong Function / Wrong Industry / Governance-Led (need Eng) / Engineering-Led (need Governance) / Builder only (need Hybrid/Operator) / Tenure concern / Relationship conflict / Client conflict / Other |
| Rejection-Notes | `fld1M8uH2k2svnJnI` | multilineText | Free-text RLHF feedback. Pairs with Rejection-Reason for Level 2 aggregation. |

#### Additional Live Fields
| Field | Field ID | Type | Notes |
|---|---|---|---|
| LinkedIn | `fldOLICvCJfPJBwXs` | multipleLookupValues | <!-- FOUND IN LIVE BASE: not in PRD spec, confirm inclusion --> Lookup of LinkedIn URL from linked People record. Read-only. Not a substitute for `LinkedIn URL (Raw)`. |
| Previous-Searches | `fldgPaRgZRdpxPQhw` | multipleLookupValues | <!-- FOUND IN LIVE BASE: not in PRD spec, confirm inclusion --> Lookup showing prior searches this candidate appeared in. |
| Title | `fldPuXvs00ng25GMp` | multipleLookupValues | <!-- FOUND IN LIVE BASE: not in PRD spec, confirm inclusion --> Lookup of candidate title from People. |

# RCI Scoring Logic

The Role Complexity Index (RCI) is Sloane's primary matching intelligence. Every candidate scored against the search's RCI Baseline across six dimensions (max 100 points).

## Dimensions

| Dimension | Max | File | Sprint |
|---|---|---|---|
| Function | 30 | `src/lib/rci.ts` | 2 |
| Level | 20 | `src/lib/rci.ts` | 2 |
| Industry Tier | 15 | `src/lib/rci.ts` | 2 |
| Company Size | 15 | `src/lib/rci.ts` | 2 |
| Geography | 10 | `src/lib/rci.ts` | 2 |
| Scope | 50 | `src/lib/scope.ts` + `src/lib/rci.ts` | 2 |

Match tiers: **High** (75–100) / **Calibration** (50–74) / **Stretch** (<50)

## Function (30 pts)

Exact match only = 30. No partial credit.

Functions: Security Engineering, SecOps, GRC, Offensive Security, Cloud Security, IAM, Threat Intelligence, Security Architecture, Leadership / CISO

## Level (20 pts)

| Result | Points |
|---|---|
| Exact match | 20 |
| Adjacent level | 10 |
| Non-adjacent | 0 |

Adjacent pairs: IC-III ↔ Lead, Lead ↔ Manager, Manager ↔ Director, Director ↔ VP/CISO

## Industry Tier (15 pts)

| Result | Points |
|---|---|
| Exact tier | 15 |
| Adjacent tier | 8 |
| Non-adjacent | 0 |

Tiers: A (FinServ/Defense/Crypto) → B (Tech/Healthcare/Infra) → C (Retail/Gov/Edu)

## Company Size (15 pts)

| Result | Points |
|---|---|
| Exact band | 15 |
| Adjacent band | 8 |
| Non-adjacent | 0 |

Bands (ordered): Startup (<200) → Mid-Market (200–2K) → Enterprise (2K–10K) → Large (10K–50K) → Global (50K+)

## Geography (10 pts)

| Candidate / Target | Tier 1 | Tier 2 | Tier 3 | International |
|---|---|---|---|---|
| **Tier 1** | 10 | 7 | 3 | 0 |
| **Tier 2** | 7 | 7 | 5 | 0 |
| **Tier 3** | 3 | 5 | 3 | 0 |

Tiers: 1 = CA/NY/WA/MA/DC, 2 = TX/IL/CO/GA/VA, 3 = all other US

## Scope (50 pts)

Extracted via `SCOPE_EXTRACTION_PROMPT`. Sub-dimensions:

| Sub-dimension | Max |
|---|---|
| Team Size (proximity to target) | 10 |
| Reporting Line | 10 |
| Program Breadth (2 pts/domain, cap 20) | 20 |
| Board Exposure | 10 |

`rci_scope_score` = team_size.score + reporting_line.score + program_breadth.score + board_exposure.score

## Adjusted Rank Score (Sprint 4)

Base RCI score preserved and always shown to PM. Adjusted score used for ordering only.
Multipliers applied per `builder_signal` and `technical_depth` category from Level 2 RLHF context.
Multiplier range: 0.7×–1.3×. Clamped to 0–100.

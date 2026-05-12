# Environment Variables

All variables must be set in `.env.local` (local dev) and in the Vercel project dashboard (production). Never hardcode values or commit secrets to git.

## Sprint 1 — Required

| Variable | Description | Required |
|---|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude API calls | Yes |
| `AIRTABLE_API_KEY` | Airtable personal access token | Yes |
| `AIRTABLE_BASE_ID` | Base ID for the Hitch Partners Airtable base (starts with `app`) | Yes |
| `INTENT_CLASSIFICATION_PROMPT` | Server-side intent classification system prompt. Never expose to client. | Yes |
| `INTERNAL_API_KEY` | Simple API key for internal route protection. Any random string ≥ 32 chars. | Optional (dev) |
| `ALLOWED_USERS` | Comma-separated email list for auth. Leave empty to disable in dev. | Optional (dev) |
| `USER_PINS` | JSON object mapping email → PIN. Example: `{"jason@hitchpartners.com":"1234"}` | Optional (dev) |
| `LOGIN_SECRET` | Secret for session cookie signing. Random string ≥ 32 chars. | Yes |

## Sprint 2 — Added

| Variable | Description | Required |
|---|---|---|
| `SCOPE_EXTRACTION_PROMPT` | Core IP scope extraction system prompt. Server-side only. Never commit. | Yes |
| `JD_DRAFT_PROMPT` | Position Profile generation prompt. Server-side only. Never expose to client. Placeholders: `{COMPANY_NAME}`, `{PLACEMENT_POS}`, `{COMPANY_RESEARCH}`, `{RCI_BASELINE}`, `{RUBRIC_CONTENT}`, `{PARTNER_CONTACT_1}`, `{PARTNER_CONTACT_2}`, `{PM_CONTACT}`. | Yes |
| `HITCH_LOGO_URL` | Public HTTPS URL to Hitch Partners logo (PNG/SVG). Used in PDF header. | Yes |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob storage access token. From Vercel dashboard → Storage. | Yes |

## Sprint 3 — Added

| Variable | Description | Required |
|---|---|---|
| `APIFY_API_KEY` | Apify API key for LinkedIn scraper | Yes |
| `APIFY_ACTOR_ID` | Apify actor ID for the LinkedIn profile scraper | Yes |

## Local .env.local Template

```
# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Airtable
AIRTABLE_API_KEY=pat...
AIRTABLE_BASE_ID=app...

# Prompts (server-side only — never commit)
INTENT_CLASSIFICATION_PROMPT=<paste prompt here>
SCOPE_EXTRACTION_PROMPT=<paste prompt here — Sprint 2>
JD_DRAFT_PROMPT=<paste prompt here — Sprint 2>

# Auth
LOGIN_SECRET=<random-32-char-string>
INTERNAL_API_KEY=<random-32-char-string>
ALLOWED_USERS=jason@hitchpartners.com,partner@hitchpartners.com
USER_PINS={"jason@hitchpartners.com":"1234"}

# PDF (Sprint 2)
HITCH_LOGO_URL=https://...
BLOB_READ_WRITE_TOKEN=vercel_blob_...

# Apify (Sprint 3)
APIFY_API_KEY=apify_api_...
APIFY_ACTOR_ID=...
```

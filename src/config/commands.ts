export function getHelpText(): string {
  return process.env.SLOANE_HELP_TEXT ?? DEFAULT_HELP_TEXT;
}

const DEFAULT_HELP_TEXT = `Here's what I understand:

SEARCH SETUP
"Kick off [Company] [Role]" — start a new search
"Start the [Company] search" — same as above
"Stand up [Company] [Role]" — same as above

JOB DESCRIPTION
"Draft the JD" — generate the Job Description
"Generate the JD" — same as above
"Generate the PDF" — create the branded PDF from working copy
"JD looks good, go ahead" — same as generate PDF
"PDF please" — same as generate PDF

SOURCING
"Run the vault sweep" — search internal candidate database
"Check internal candidates" — same as above
"Run the scout" — search LinkedIn for external candidates
"Find external candidates" — same as above

REFINING THE SEARCH
"Too senior / Too junior" — adjust seniority targeting
"Builder profile only" — filter to builder candidates
"Operator profile" — filter to operator candidates
"Hybrid profile" — filter to hybrid candidates
"Focus on [Industry]" — narrow by industry
"Ignore [criteria]" — exclude from results
"Only scrape [n] profiles this session" — set scout cap

APPROVALS
"Approve [candidate name]" — mark as Add to Search
"Reject [candidate name]" — mark as Reject

STATUS
"What's the status" — summary of current search progress
"Where are we on [Company]" — same as above

OTHER
"Help" or "?" — show this list`;

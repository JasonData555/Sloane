// Sprint 3 — full implementation. Sprint 1 stub for type safety.
import type { CandidateCardData } from '@/types/sloane';

const TIER_COLORS = {
  High: 'bg-teal-100 text-teal-700 border-teal-200',
  Calibration: 'bg-beige-200 text-stone-500 border-beige-300',
  Stretch: 'bg-[#FFFBEB] text-[#92400E] border-[#92400E]/30',
};

interface Props {
  candidate: CandidateCardData;
}

export default function CandidateCard({ candidate }: Props) {
  return (
    <div className={`rounded-xl border p-4 my-2 ${candidate.anomalyFlag ? 'bg-[#FFFBEB] border-[#92400E]/30' : 'bg-beige-50 border-beige-300'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-stone-900">{candidate.name}</p>
          {candidate.currentTitle && (
            <p className="text-xs text-stone-400 mt-0.5">{candidate.currentTitle}{candidate.company ? ` · ${candidate.company}` : ''}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${TIER_COLORS[candidate.matchTier]}`}>
            {candidate.matchTier}
          </span>
          <span className="text-xs text-stone-400 font-mono">{candidate.rciScore}/100</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        <span className="text-xs text-stone-500 bg-beige-200 px-2 py-0.5 rounded">
          {candidate.builderSignal}
        </span>
        <span className="text-xs text-stone-500 bg-beige-200 px-2 py-0.5 rounded">
          {candidate.technicalDepth}
        </span>
        <span className="text-xs text-stone-500 bg-beige-200 px-2 py-0.5 rounded">
          {candidate.scopeConfidence} confidence
        </span>
      </div>

      {candidate.anomalyFlag && candidate.anomalyNote && (
        <div className="mt-3 text-xs text-[#991B1B] bg-[#FEF2F2] rounded-lg px-3 py-2 border border-[#991B1B]/30">
          ⚠ {candidate.anomalyNote}
        </div>
      )}

      {candidate.tourOfDutySignal && (
        <p className="mt-2 text-xs text-[#92400E]">Tour of duty pattern detected</p>
      )}

      {candidate.airtableUrl && (
        <a
          href={candidate.airtableUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-xs text-teal-700 hover:text-teal-600 underline"
        >
          View in Airtable →
        </a>
      )}
    </div>
  );
}

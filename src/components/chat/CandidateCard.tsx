// Sprint 3 — full implementation. Sprint 1 stub for type safety.
import type { CandidateCardData } from '@/types/sloane';

const TIER_COLORS = {
  High: 'bg-green-50 dark:bg-green-900 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700',
  Calibration: 'bg-yellow-50 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700',
  Stretch: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-300 border-gray-300 dark:border-gray-600',
};

interface Props {
  candidate: CandidateCardData;
}

export default function CandidateCard({ candidate }: Props) {
  return (
    <div className={`rounded-xl border p-4 my-2 ${candidate.anomalyFlag ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{candidate.name}</p>
          {candidate.currentTitle && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{candidate.currentTitle}{candidate.company ? ` · ${candidate.company}` : ''}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${TIER_COLORS[candidate.matchTier]}`}>
            {candidate.matchTier}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">{candidate.rciScore}/100</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        <span className="text-xs text-gray-600 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded">
          {candidate.builderSignal}
        </span>
        <span className="text-xs text-gray-600 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded">
          {candidate.technicalDepth}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded">
          {candidate.scopeConfidence} confidence
        </span>
      </div>

      {candidate.anomalyFlag && candidate.anomalyNote && (
        <div className="mt-3 text-xs text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-900/50 rounded-lg px-3 py-2 border border-red-200 dark:border-red-800">
          ⚠ {candidate.anomalyNote}
        </div>
      )}

      {candidate.tourOfDutySignal && (
        <p className="mt-2 text-xs text-yellow-500 dark:text-yellow-400">Tour of duty pattern detected</p>
      )}

      {candidate.airtableUrl && (
        <a
          href={candidate.airtableUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-xs text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 underline"
        >
          View in Airtable →
        </a>
      )}
    </div>
  );
}

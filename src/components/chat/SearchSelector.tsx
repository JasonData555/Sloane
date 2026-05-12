'use client';

import { useEffect, useState } from 'react';
import type { SearchRecord } from '@/types/sloane';

interface Props {
  selectedId: string | null;
  onSelect: (search: SearchRecord) => void;
}

export default function SearchSelector({ selectedId, onSelect }: Props) {
  const [searches, setSearches] = useState<SearchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/airtable?resource=searches')
      .then((r) => r.json())
      .then((data: { searches?: SearchRecord[]; error?: string }) => {
        if (data.searches) {
          setSearches(data.searches);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const selected = searches.find((s) => s.id === selectedId);

  return (
    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
      <div className="relative">
        <select
          value={selectedId ?? ''}
          onChange={(e) => {
            const s = searches.find((s) => s.id === e.target.value);
            if (s) onSelect(s);
          }}
          disabled={loading || error}
          className="w-full appearance-none bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg px-4 py-2.5 pr-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
        >
          <option value="" disabled>
            {loading ? 'Loading searches…' : error ? 'Error loading searches' : 'Select a search'}
          </option>
          {searches.map((s) => (
            <option key={s.id} value={s.id}>
              {s.clientName} — {s.placementPos}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      {!loading && !error && searches.length === 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5 px-1">
          No active searches found. Create a search in Airtable to get started.
        </p>
      )}
      {selected && (
        <p className="text-xs mt-1.5 px-1">
          {selected.rubricUrl ? (
            <a
              href={selected.rubricUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              Rubric: Ready →
            </a>
          ) : (
            <span className="text-gray-400 dark:text-gray-500">Rubric: Pending</span>
          )}
        </p>
      )}
    </div>
  );
}

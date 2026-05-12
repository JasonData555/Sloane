'use client';

import { useState, useCallback } from 'react';
import SearchSelector from '@/components/chat/SearchSelector';
import ChatThread from '@/components/chat/ChatThread';
import InputBar from '@/components/chat/InputBar';
import ThemeToggle from '@/components/chat/ThemeToggle';
import type { SearchRecord, ConversationMessage, SloaneAPIResponse, SearchStage } from '@/types/sloane';

export default function ChatPage() {
  const [selectedSearch, setSelectedSearch] = useState<SearchRecord | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [stage, setStage] = useState<SearchStage>('Calibration');
  const [isLoading, setIsLoading] = useState(false);

  const handleSearchSelect = useCallback(async (search: SearchRecord) => {
    setSelectedSearch(search);
    setMessages([]);
    setIsLoading(true);

    // Load existing conversation history for this search
    try {
      const res = await fetch(`/api/airtable?resource=conversation&searchId=${search.id}`);
      if (res.ok) {
        const data = await res.json() as { messages?: ConversationMessage[]; stage?: SearchStage };
        setMessages(data.messages ?? []);
        setStage(data.stage ?? 'Calibration');
      }
    } catch {
      // No history — start fresh
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSend = useCallback(async (text: string) => {
    if (!selectedSearch) return;

    const userMsg: ConversationMessage = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const res = await fetch('/api/sloane', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          searchId: selectedSearch.id,
          message: text,
          userId: 'pm',
        }),
      });

      const contentType = res.headers.get('Content-Type') ?? '';

      if (contentType.includes('text/event-stream')) {
        // SSE streaming response (vault sweep)
        setIsLoading(false); // show content as it arrives, not spinner
        const reader = res.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;

            let event: Record<string, unknown>;
            try {
              event = JSON.parse(jsonStr) as Record<string, unknown>;
            } catch {
              continue;
            }

            const eventType = event.type as string;

            if (eventType === 'batch_complete') {
              const batchIndex = event.batchIndex as number;
              const totalBatches = event.total_batches as number;
              const candidates = event.candidates as Array<{ name: string; rciScore: number; matchTier: string }>;
              const batchMsg: ConversationMessage = {
                role: 'assistant',
                content: `Batch ${batchIndex}/${totalBatches} scored — ${candidates.length} candidate${candidates.length !== 1 ? 's' : ''}: ${candidates.map((c) => `${c.name} (${c.matchTier}, ${c.rciScore})`).join(', ')}`,
                timestamp: new Date().toISOString(),
                metadata: { intent: 'run_vault_sweep', stage },
              };
              setMessages((prev) => [...prev, batchMsg]);
            } else if (eventType === 'complete') {
              const summary = event.summary as string;
              const finalMsg: ConversationMessage = {
                role: 'assistant',
                content: summary,
                timestamp: new Date().toISOString(),
                metadata: { intent: 'run_vault_sweep', stage: 'Vault Sweep' },
              };
              setMessages((prev) => [...prev, finalMsg]);
              setStage('Vault Sweep');
            } else if (eventType === 'error') {
              const errMsg: ConversationMessage = {
                role: 'assistant',
                content: (event.message as string) ?? "Something went wrong with the vault sweep.",
                timestamp: new Date().toISOString(),
              };
              setMessages((prev) => [...prev, errMsg]);
            }
          }
        }
      } else {
        // Standard JSON response
        const data = await res.json() as SloaneAPIResponse;
        const assistantMsg: ConversationMessage = {
          role: 'assistant',
          content: data.message,
          timestamp: new Date().toISOString(),
          metadata: { intent: data.intent, stage: data.stage },
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setStage(data.stage);
      }
    } catch {
      const errMsg: ConversationMessage = {
        role: 'assistant',
        content: "I'm having trouble connecting right now. Please try again in a moment.",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedSearch, stage]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center">
            <span className="text-xs font-semibold text-white">S</span>
          </div>
          <span className="text-sm font-semibold text-gray-900 dark:text-white">Sloane</span>
        </div>
        <div className="flex items-center gap-2">
          {selectedSearch && (
            <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">
              {stage}
            </span>
          )}
          <button
            onClick={() => handleSend('help')}
            disabled={!selectedSearch || isLoading}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 w-6 h-6 rounded-full border border-gray-300 dark:border-gray-600 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Show command reference"
          >
            ?
          </button>
          <ThemeToggle />
        </div>
      </div>

      {/* Search selector */}
      <SearchSelector selectedId={selectedSearch?.id ?? null} onSelect={handleSearchSelect} />

      {/* Chat thread */}
      <ChatThread messages={messages} isLoading={isLoading} />

      {/* Input bar */}
      <InputBar
        onSend={handleSend}
        disabled={isLoading || !selectedSearch}
        placeholder={selectedSearch ? 'Message Sloane…' : 'Select a search to begin'}
      />
    </div>
  );
}

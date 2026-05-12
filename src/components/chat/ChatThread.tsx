'use client';

import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
import type { ConversationMessage } from '@/types/sloane';

interface Props {
  messages: ConversationMessage[];
  isLoading: boolean;
}

export default function ChatThread({ messages, isLoading }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center mx-auto mb-4">
            <span className="text-xl font-semibold text-white">S</span>
          </div>
          <p className="text-gray-600 dark:text-gray-300 font-medium">Sloane</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
            Select a search above, then type a command to get started.
          </p>
          <p className="text-gray-400 dark:text-gray-600 text-xs mt-3">
            Try: &quot;Kick off the BreachRx CISO search&quot;
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      {messages.map((msg, i) => (
        <MessageBubble key={i} message={msg} />
      ))}
      {isLoading && (
        <div className="flex justify-start mb-3">
          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center mr-2 mt-0.5">
            <span className="text-xs font-semibold text-white">S</span>
          </div>
          <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-bl-sm px-4 py-3">
            <div className="flex gap-1 items-center h-4">
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}

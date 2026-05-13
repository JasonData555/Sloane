import type { ConversationMessage } from '@/types/sloane';

interface Props {
  message: ConversationMessage;
}

export default function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user';
  const isStatusCard = message.metadata?.isStatusCard;
  const isCheckpoint = message.metadata?.isCheckpoint;

  if (isStatusCard || isCheckpoint) {
    return (
      <div className="flex justify-center my-2">
        <div className="bg-beige-200 border border-beige-300 rounded-xl px-4 py-2.5 max-w-sm text-center">
          <p className="text-sm text-stone-500 whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      {!isUser && (
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-teal-700 flex items-center justify-center mr-2 mt-0.5">
          <span className="text-xs font-semibold text-white">S</span>
        </div>
      )}
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-teal-700 text-white rounded-br-sm'
            : 'bg-beige-200 border border-beige-400 text-stone-900 rounded-bl-sm'
        }`}
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        <p className={`text-xs mt-1.5 ${isUser ? 'text-white/80' : 'text-stone-400'}`}>
          {formatTime(message.timestamp)}
        </p>
      </div>
    </div>
  );
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

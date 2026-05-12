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
        <div className="bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-2.5 max-w-sm text-center">
          <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      {!isUser && (
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center mr-2 mt-0.5">
          <span className="text-xs font-semibold text-white">S</span>
        </div>
      )}
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-sm'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-bl-sm'
        }`}
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        <p className={`text-xs mt-1.5 ${isUser ? 'text-blue-100 dark:text-blue-200' : 'text-gray-400 dark:text-gray-500'}`}>
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

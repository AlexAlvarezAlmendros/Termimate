interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
}

export function MessageBubble({ role, content }: MessageBubbleProps) {
  const isUser = role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] px-3 py-2 rounded-lg text-sm leading-relaxed ${
          isUser
            ? 'bg-primary-container/20 text-primary-fixed-dim'
            : 'bg-surface-container-high text-on-surface'
        }`}
      >
        <pre className="whitespace-pre-wrap font-body text-sm">{content}</pre>
      </div>
    </div>
  );
}

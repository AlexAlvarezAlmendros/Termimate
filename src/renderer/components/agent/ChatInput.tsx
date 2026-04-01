import { useCallback, useRef, useEffect } from 'react';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onCancel?: () => void;
  disabled: boolean;
  isStreaming?: boolean;
}

export function ChatInput({ value, onChange, onSend, onCancel, disabled, isStreaming }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea to content
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 150)}px`;
  }, [value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onSend();
      }
    },
    [onSend],
  );

  return (
    <div className="p-3 bg-surface-container-high/30 border-t border-outline-variant/5">
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled && !isStreaming}
          placeholder="Ask the AI agent..."
          rows={1}
          className="w-full bg-surface-container-highest border-none rounded-lg py-2.5 pl-4 pr-12 text-sm focus:ring-1 focus:ring-primary/50 placeholder:text-outline/50 disabled:opacity-50 resize-none overflow-y-auto"
          style={{ maxHeight: '150px' }}
        />
        {isStreaming ? (
          <button
            onClick={onCancel}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-error hover:text-error/80 transition-colors"
            title="Stop generation"
          >
            <StopIcon />
          </button>
        ) : (
          <button
            onClick={onSend}
            disabled={disabled || !value.trim()}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-container hover:text-primary disabled:opacity-30 transition-colors"
          >
            <SendIcon />
          </button>
        )}
      </div>
    </div>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

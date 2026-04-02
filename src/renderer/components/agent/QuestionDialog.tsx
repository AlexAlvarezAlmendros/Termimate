import { useEffect, useState, useRef } from 'react';
import type { QuestionRequest } from '../../../../shared/types/agent.types';

export function QuestionDialog() {
  const [request, setRequest] = useState<QuestionRequest | null>(null);
  const [answer, setAnswer] = useState('');
  const [responding, setResponding] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!window.electronAPI) return;

    const remove = window.electronAPI.agent.onQuestionRequest((req) => {
      setRequest(req);
      setAnswer('');
      // Focus the textarea after render
      requestAnimationFrame(() => textareaRef.current?.focus());
    });

    return remove;
  }, []);

  const respond = async (userAnswer: string) => {
    if (!request || responding) return;
    setResponding(true);
    try {
      await window.electronAPI.agent.questionResponse(request.requestId, userAnswer);
    } finally {
      setRequest(null);
      setAnswer('');
      setResponding(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      respond(answer);
    }
    if (e.key === 'Escape') {
      respond('');
    }
  };

  if (!request) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pb-8 px-4 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-lg bg-surface-container border border-outline-variant/20 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-outline-variant/10 bg-tertiary/5">
          <div className="w-8 h-8 rounded-full bg-tertiary/15 flex items-center justify-center text-tertiary flex-shrink-0">
            <QuestionIcon />
          </div>
          <div>
            <p className="text-sm font-bold text-on-surface">Agent is asking a question</p>
            <p className="text-xs text-outline">Type your answer and press Enter to respond</p>
          </div>
        </div>

        {/* Question */}
        <div className="px-5 py-4">
          <p className="text-sm text-on-surface whitespace-pre-wrap">{request.question}</p>
        </div>

        {/* Answer input */}
        <div className="px-5 pb-4">
          <textarea
            ref={textareaRef}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={responding}
            placeholder="Type your answer… (Enter to send, Shift+Enter for new line, Esc to skip)"
            rows={3}
            className="w-full bg-surface-container-high border border-outline-variant/20 rounded-lg px-4 py-3 text-sm text-on-surface focus:outline-none focus:border-primary/50 placeholder:text-outline/40 disabled:opacity-50 resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-outline-variant/10">
          <button
            onClick={() => respond('')}
            disabled={responding}
            className="px-4 py-2 text-sm font-semibold text-outline border border-outline-variant/30 rounded-lg hover:bg-surface-container-high disabled:opacity-50 transition-colors"
          >
            Skip
          </button>
          <button
            onClick={() => respond(answer)}
            disabled={responding || !answer.trim()}
            className="px-5 py-2 text-sm font-semibold bg-primary text-on-primary rounded-lg hover:brightness-110 disabled:opacity-50 transition-all"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

function QuestionIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

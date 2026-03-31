import { useState, useCallback } from 'react';
import { TerminalPane } from '../../terminal/TerminalPane';
import { ChatPane } from '../../agent/ChatPane';

const DEFAULT_SPLIT = 65; // terminal gets 65%
const MIN_TERMINAL = 25;
const MIN_AGENT = 20;

export function MainArea() {
  const [splitPercent, setSplitPercent] = useState(DEFAULT_SPLIT);

  const handleDragStart = useCallback(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const container = document.getElementById('main-area');
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const percent = ((e.clientY - rect.top) / rect.height) * 100;
      const clamped = Math.max(MIN_TERMINAL, Math.min(100 - MIN_AGENT, percent));
      setSplitPercent(clamped);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const handleDoubleClick = useCallback(() => {
    setSplitPercent(DEFAULT_SPLIT);
  }, []);

  return (
    <main id="main-area" className="ml-64 flex-1 flex flex-col p-4 gap-0 h-full overflow-hidden">
      {/* Terminal Panel */}
      <section
        className="flex flex-col bg-surface-container-lowest rounded-t-xl border border-outline-variant/10 overflow-hidden"
        style={{ height: `${splitPercent}%` }}
      >
        <TerminalPane />
      </section>

      {/* Resize Handle */}
      <div
        className="h-1 bg-outline-variant/20 hover:bg-primary/40 cursor-row-resize transition-colors flex-shrink-0"
        onMouseDown={handleDragStart}
        onDoubleClick={handleDoubleClick}
      />

      {/* Agent Chat Panel */}
      <section
        className="flex flex-col bg-surface-container-lowest rounded-b-xl border border-t-0 border-outline-variant/10 overflow-hidden"
        style={{ height: `${100 - splitPercent}%` }}
      >
        <ChatPane />
      </section>
    </main>
  );
}

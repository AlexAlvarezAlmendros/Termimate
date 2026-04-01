import { useState, useCallback, useRef } from 'react';
import { TerminalPane } from '../../terminal/TerminalPane';
import { ChatPane } from '../../agent/ChatPane';
import { AgentsPage } from '../../agents/AgentsPage';
import type { AppView } from '../../../App';

const DEFAULT_CHAT_WIDTH = 320;
const MIN_TERMINAL_WIDTH = 300;
const MIN_CHAT_WIDTH = 240;

interface MainAreaProps {
  view: AppView;
}

export function MainArea({ view }: MainAreaProps) {
  const chatOpen = view === 'chat';
  const [chatWidth, setChatWidth] = useState(DEFAULT_CHAT_WIDTH);
  const containerRef = useRef<HTMLElement>(null);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = chatWidth;

    const handleMouseMove = (ev: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const delta = startX - ev.clientX;
      const containerWidth = container.getBoundingClientRect().width;
      const maxChat = containerWidth - MIN_TERMINAL_WIDTH;
      const newWidth = Math.max(MIN_CHAT_WIDTH, Math.min(maxChat, startWidth + delta));
      setChatWidth(newWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [chatWidth]);

  const handleDoubleClick = useCallback(() => {
    setChatWidth(DEFAULT_CHAT_WIDTH);
  }, []);

  if (view === 'agents') {
    return (
      <main className="ml-64 flex-1 flex flex-col p-4 h-full overflow-hidden">
        <div className="flex-1 bg-surface-container-lowest rounded-xl border border-outline-variant/10 overflow-hidden">
          <AgentsPage />
        </div>
      </main>
    );
  }

  return (
    <main ref={containerRef} id="main-area" className="ml-64 flex-1 flex flex-row p-4 h-full overflow-hidden">
      {/* Terminal */}
      <section className="flex flex-col flex-1 bg-surface-container-lowest rounded-xl border border-outline-variant/10 overflow-hidden min-w-0">
        <TerminalPane />
      </section>

      {/* Resize handle + Chat sidebar */}
      {chatOpen && (
        <>
          <div
            className="w-1.5 mx-1 bg-outline-variant/20 hover:bg-primary/40 cursor-col-resize transition-colors shrink-0 rounded-full"
            onMouseDown={handleDragStart}
            onDoubleClick={handleDoubleClick}
          />
          <section
            className="flex flex-col bg-surface-container-lowest rounded-xl border border-outline-variant/10 overflow-hidden shrink-0"
            style={{ width: chatWidth }}
          >
            <ChatPane />
          </section>
        </>
      )}
    </main>
  );
}

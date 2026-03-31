import { useEffect, useRef } from 'react';
import { useTerminal } from '../../hooks/useTerminal';
import { useSessionStore } from '../../store/sessionStore';

export function TerminalPane() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { activeSessionId } = useSessionStore();
  const { attach } = useTerminal(activeSessionId);

  useEffect(() => {
    if (containerRef.current && activeSessionId) {
      attach(containerRef.current);
    }
  }, [activeSessionId, attach]);

  return (
    <div className="flex flex-col h-full">
      {/* Terminal Header */}
      <div className="bg-surface-container-low px-4 py-2 flex items-center justify-between border-b border-outline-variant/5 flex-shrink-0">
        <div className="flex gap-2">
          <div className="w-3 h-3 rounded-full bg-error/40" />
          <div className="w-3 h-3 rounded-full bg-tertiary/40" />
          <div className="w-3 h-3 rounded-full bg-secondary/40" />
        </div>
        <span className="text-[10px] font-mono text-outline uppercase tracking-widest">
          {activeSessionId ? `session: ${activeSessionId.slice(0, 8)}` : 'No active session'}
        </span>
        <div className="w-12" />
      </div>

      {/* Terminal Body */}
      <div ref={containerRef} className="flex-1 overflow-hidden" />
    </div>
  );
}

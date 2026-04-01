import { useEffect, useRef, useState, useCallback } from 'react';
import { useTerminal } from '../../hooks/useTerminal';
import { useSessionStore } from '../../store/sessionStore';

export function TerminalPane() {
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { activeSessionId } = useSessionStore();
  const { attach, searchAddon } = useTerminal(activeSessionId);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (containerRef.current && activeSessionId) {
      attach(containerRef.current);
    }
  }, [activeSessionId, attach]);

  // Keyboard shortcut: Ctrl+Shift+F
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        setShowSearch((v) => {
          if (!v) setTimeout(() => searchInputRef.current?.focus(), 0);
          return !v;
        });
      }
      if (e.key === 'Escape' && showSearch) {
        setShowSearch(false);
        setSearchQuery('');
        searchAddon?.clearDecorations();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showSearch, searchAddon]);

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (!searchAddon) return;
      if (!query) {
        searchAddon.clearDecorations();
        return;
      }
      searchAddon.findNext(query);
    },
    [searchAddon],
  );

  const handleSearchNext = () => searchAddon?.findNext(searchQuery);
  const handleSearchPrev = () => searchAddon?.findPrevious(searchQuery);

  const closeSearch = () => {
    setShowSearch(false);
    setSearchQuery('');
    searchAddon?.clearDecorations();
  };

  return (
    <div className="flex flex-col h-full relative">
      {/* Search overlay */}
      {showSearch && (
        <div className="absolute top-12 right-4 z-10 flex items-center gap-1.5 bg-surface-container-high rounded-lg shadow-lg border border-outline-variant/20 px-3 py-1.5">
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.shiftKey ? handleSearchPrev() : handleSearchNext();
              }
              if (e.key === 'Escape') closeSearch();
            }}
            placeholder="Search..."
            className="bg-transparent text-sm text-on-surface placeholder-outline/50 focus:outline-none w-48"
          />
          <button onClick={handleSearchPrev} className="p-1 text-outline hover:text-on-surface transition-colors" title="Previous (Shift+Enter)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15"/></svg>
          </button>
          <button onClick={handleSearchNext} className="p-1 text-outline hover:text-on-surface transition-colors" title="Next (Enter)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <button onClick={closeSearch} className="p-1 text-outline hover:text-on-surface transition-colors" title="Close (Escape)">
            <svg width="12" height="12" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/></svg>
          </button>
        </div>
      )}

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

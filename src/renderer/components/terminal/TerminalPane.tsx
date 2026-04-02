import { useEffect, useRef, useState, useCallback } from 'react';
import { useTerminalManager } from '../../hooks/useTerminal';
import { useSessionStore } from '../../store/sessionStore';

export function TerminalPane() {
  const containerRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { activeSessionId, sessions } = useSessionStore();
  const { initSession, destroySession, getSearchAddon, copyContent, accentColor, bgColor } =
    useTerminalManager();
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const searchAddon = getSearchAddon(activeSessionId);

  // When the active session changes, initialise it (first time) or simply refocus
  useEffect(() => {
    if (!activeSessionId) return;
    const container = containerRefs.current.get(activeSessionId);
    if (!container) return;
    initSession(activeSessionId, container);
  }, [activeSessionId, initSession]);

  // Clean up the xterm instance when a session is removed from the store
  const prevSessionsRef = useRef<string[]>([]);
  useEffect(() => {
    const current = sessions.map((s) => s.id);
    const removed = prevSessionsRef.current.filter((id) => !current.includes(id));
    for (const id of removed) {
      destroySession(id);
    }
    prevSessionsRef.current = current;
  }, [sessions, destroySession]);

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

  const handleCopy = useCallback(() => {
    if (copyContent(activeSessionId)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }, [copyContent, activeSessionId]);

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
      {/* Accent border at top */}
      <div className="h-0.5 shrink-0" style={{ background: accentColor }} />

      {/* Terminal Header */}
      <div
        className="px-3 py-2 flex items-center justify-between shrink-0"
        style={{ background: 'rgba(0,0,0,0.35)', borderBottom: `1px solid ${accentColor}18` }}
      >
        {/* Traffic lights */}
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#ff5f57] hover:brightness-110 transition-all cursor-default" />
          <div className="w-3 h-3 rounded-full bg-[#febc2e] hover:brightness-110 transition-all cursor-default" />
          <div className="w-3 h-3 rounded-full bg-[#28c840] hover:brightness-110 transition-all cursor-default" />
        </div>

        {/* Session name */}
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: accentColor }} />
          <span className="text-xs font-mono font-medium" style={{ color: accentColor }}>
            {activeSession?.name ?? (activeSessionId ? activeSessionId.slice(0, 8) : 'No session')}
          </span>
        </div>

        {/* Copy and Search toggle */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            title="Copy all content"
            className="p-1 rounded transition-colors text-white/30 hover:text-white/70"
          >
            {copied ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
            )}
          </button>
          <button
            onClick={() => {
              setShowSearch((v) => {
                if (!v) setTimeout(() => searchInputRef.current?.focus(), 0);
                return !v;
              });
            }}
            title="Search (Ctrl+Shift+F)"
            className="p-1 rounded transition-colors text-white/30 hover:text-white/70"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div
          className="absolute top-10.5 right-3 z-10 flex items-center gap-1.5 rounded-lg shadow-lg px-3 py-1.5"
          style={{ background: 'rgba(0,0,0,0.8)', border: `1px solid ${accentColor}40` }}
        >
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.shiftKey ? handleSearchPrev() : handleSearchNext();
              if (e.key === 'Escape') closeSearch();
            }}
            placeholder="Find in terminal..."
            className="bg-transparent text-sm text-white/80 placeholder-white/25 focus:outline-none w-44"
          />
          <button onClick={handleSearchPrev} className="p-1 text-white/30 hover:text-white/80 transition-colors" title="Previous">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15"/></svg>
          </button>
          <button onClick={handleSearchNext} className="p-1 text-white/30 hover:text-white/80 transition-colors" title="Next">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div className="w-px h-4 bg-white/10 mx-0.5" />
          <button onClick={closeSearch} className="p-1 text-white/30 hover:text-white/80 transition-colors" title="Close">
            <svg width="11" height="11" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/></svg>
          </button>
        </div>
      )}

      {/* Terminal bodies — one per session, only active one is visible */}
      <div className="flex-1 relative overflow-hidden" style={{ background: bgColor }}>
        {sessions.map((session) => (
          <div
            key={session.id}
            ref={(el) => {
              if (el) {
                containerRefs.current.set(session.id, el);
              } else {
                containerRefs.current.delete(session.id);
              }
            }}
            style={{
              position: 'absolute',
              inset: 0,
              padding: '4px 6px',
              display: session.id === activeSessionId ? 'block' : 'none',
              background: bgColor,
            }}
          />
        ))}
      </div>
    </div>
  );
}


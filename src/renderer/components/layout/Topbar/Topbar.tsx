import { useState, useRef, useEffect } from 'react';
import { useSessionStore } from '../../../store/sessionStore';
import type { AppView } from '../../../App';

interface TopbarProps {
  onOpenSettings: () => void;
  view: AppView;
  onToggleChat: () => void;
}

export function Topbar({ onOpenSettings, view, onToggleChat }: TopbarProps) {
  const { sessions, activeSessionId, setActiveSession, addSession, closeTab, renameSession, ptyStatus, openTabIds } = useSessionStore();
  const tabSessions = sessions.filter((s) => openTabIds.includes(s.id));

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; sessionId: string } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameRef = useRef<HTMLInputElement>(null);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [contextMenu]);

  useEffect(() => {
    if (renamingId) renameRef.current?.select();
  }, [renamingId]);

  const handleNewSession = async () => {
    if (!window.electronAPI) return;
    const session = await window.electronAPI.session.create({});
    addSession({ id: session.id, name: session.name, projectId: session.projectId });
  };

  const handleCloseSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    closeTab(id);
  };

  const handleContextMenu = (e: React.MouseEvent, sessionId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, sessionId });
  };

  const startRename = (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    setRenameValue(session?.name ?? '');
    setRenamingId(sessionId);
    setContextMenu(null);
  };

  const commitRename = async (sessionId: string) => {
    const trimmed = renameValue.trim();
    if (trimmed) {
      renameSession(sessionId, trimmed);
      await window.electronAPI.session.update(sessionId, { name: trimmed });
    }
    setRenamingId(null);
  };

  const contextCloseSession = (sessionId: string) => {
    setContextMenu(null);
    closeTab(sessionId);
  };

  return (
    <>
    <header className="fixed top-0 left-0 right-0 z-50 bg-background flex items-center justify-between px-6 py-2 w-full border-b border-outline-variant/10">
      {/* Logo */}
      <div className="flex items-center gap-4">
        <span className="font-headline text-lg font-bold text-primary">TermiMate</span>
      </div>

      {/* Session Tabs */}
      <nav className="flex items-center gap-1 bg-surface-container-lowest rounded-lg p-1 min-w-0 max-w-120">
        {tabSessions.map((session) => (
          <div
            key={session.id}
            className={`flex items-center gap-1 px-3 py-1.5 rounded cursor-pointer transition-colors min-w-0 max-w-40 shrink ${
              session.id === activeSessionId
                ? 'text-primary-container border-b-2 border-primary-container'
                : 'text-outline hover:text-on-surface'
            }`}
            onClick={() => setActiveSession(session.id)}
            onContextMenu={(e) => handleContextMenu(e, session.id)}
          >
            <span
              className={`shrink-0 w-1.5 h-1.5 rounded-full ${
                ptyStatus[session.id] === 'exited'
                  ? 'bg-amber-400'
                  : session.id === activeSessionId
                    ? 'bg-green-400'
                    : 'bg-blue-400'
              }`}
            />
            {renamingId === session.id ? (
              <input
                ref={renameRef}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={() => commitRename(session.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename(session.id);
                  if (e.key === 'Escape') setRenamingId(null);
                }}
                onClick={(e) => e.stopPropagation()}
                className="text-sm font-headline uppercase tracking-widest bg-surface-container-high rounded px-1 py-0 focus:outline-none focus:ring-1 focus:ring-primary/50 min-w-0 max-w-full"
              />
            ) : (
              <span className="text-sm font-headline uppercase tracking-widest truncate min-w-0">
                {session.name}
              </span>
            )}
            {tabSessions.length > 1 && (
              <button
                onClick={(e) => handleCloseSession(e, session.id)}
                className="shrink-0 w-4 h-4 flex items-center justify-center rounded hover:bg-outline/20 transition-colors text-outline/50 hover:text-on-surface"
                title="Close session"
              >
                <CloseIcon />
              </button>
            )}
          </div>
        ))}
        <button
          onClick={handleNewSession}
          className="px-2 py-1.5 text-outline hover:text-on-surface transition-colors"
          title="New Session"
        >
          +
        </button>
        <button
          onClick={onToggleChat}
          className={`px-2 py-1.5 rounded transition-colors ${
            view === 'chat'
              ? 'text-primary bg-primary/10'
              : 'text-outline hover:text-on-surface'
          }`}
          title="TermimateAI"
        >
          <ChatIcon />
        </button>
      </nav>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => { if (view === 'chat') onToggleChat(); }}
          className={`p-2 rounded-md transition-all ${view === 'terminal' ? 'text-primary bg-primary/10' : 'text-outline hover:text-on-surface'}`}
          title="Terminal"
        >
          <TerminalIcon />
        </button>
        <button onClick={onOpenSettings} className="p-2 text-primary hover:bg-surface-container-high rounded-md transition-all">
          <SettingsIcon />
        </button>
      </div>
    </header>

    {/* Context menu */}
    {contextMenu && (
      <div
        className="fixed z-100 min-w-36 bg-surface-container-high rounded-lg shadow-xl border border-outline-variant/20 py-1"
        style={{ left: contextMenu.x, top: contextMenu.y }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="w-full text-left px-3 py-1.5 text-sm text-on-surface hover:bg-primary/10 transition-colors"
          onClick={() => startRename(contextMenu.sessionId)}
        >
          Rename
        </button>
        <button
          className="w-full text-left px-3 py-1.5 text-sm text-on-surface hover:bg-error/10 transition-colors"
          onClick={() => contextCloseSession(contextMenu.sessionId)}
        >
          Close tab
        </button>
      </div>
    )}
    </>
  );
}

function ChatIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="1" y1="1" x2="9" y2="9" />
      <line x1="9" y1="1" x2="1" y2="9" />
    </svg>
  );
}

function TerminalIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

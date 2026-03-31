import { useSessionStore } from '../../../store/sessionStore';

interface TopbarProps {
  onOpenSettings: () => void;
}

export function Topbar({ onOpenSettings }: TopbarProps) {
  const { sessions, activeSessionId, setActiveSession, addSession } = useSessionStore();

  const handleNewSession = async () => {
    if (!window.electronAPI) return;
    const session = await window.electronAPI.session.create({});
    addSession({ id: session.id, name: session.name, projectId: session.projectId });
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background flex items-center justify-between px-6 py-2 w-full border-b border-outline-variant/10">
      {/* Logo */}
      <div className="flex items-center gap-4">
        <span className="font-headline text-lg font-bold text-primary">TermiMate</span>
      </div>

      {/* Session Tabs */}
      <nav className="flex items-center gap-1 bg-surface-container-lowest rounded-lg p-1">
        {sessions.map((session) => (
          <button
            key={session.id}
            onClick={() => setActiveSession(session.id)}
            className={`px-4 py-1.5 text-sm font-headline uppercase tracking-widest transition-colors ${
              session.id === activeSessionId
                ? 'text-primary-container border-b-2 border-primary-container'
                : 'text-outline hover:text-on-surface'
            }`}
          >
            {session.name}
          </button>
        ))}
        <button
          onClick={handleNewSession}
          className="px-3 py-1.5 text-outline hover:text-on-surface transition-colors"
          title="New Session"
        >
          +
        </button>
      </nav>

      {/* Actions */}
      <div className="flex items-center gap-2 text-primary">
        <button className="p-2 hover:bg-surface-container-high rounded-md transition-all">
          <TerminalIcon />
        </button>
        <button onClick={onOpenSettings} className="p-2 hover:bg-surface-container-high rounded-md transition-all">
          <SettingsIcon />
        </button>
      </div>
    </header>
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

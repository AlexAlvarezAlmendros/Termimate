import { useState, useEffect } from 'react';
import { Topbar } from './components/layout/Topbar/Topbar';
import { Sidenav } from './components/layout/Sidenav/Sidenav';
import { MainArea } from './components/layout/MainArea/MainArea';
import { SettingsModal } from './components/settings/SettingsModal';
import { ConfirmationDialog } from './components/agent/ConfirmationDialog';
import { useSessionStore } from './store/sessionStore';
import { useProject } from './hooks/useProject';
import { useAgentCrud } from './hooks/useAgentCrud';

export type AppView = 'terminal' | 'chat' | 'agents';

export default function App() {
  const { sessions, activeSessionId, setSessions, addSession, closeSession, setActiveSession, setPtyStatus } = useSessionStore();
  const { loadProjects } = useProject();
  const { loadAgents } = useAgentCrud();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [view, setView] = useState<AppView>('terminal');

  // Keyboard shortcuts
  useEffect(() => {
    const handler = async (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl || !e.shiftKey) return;

      if (e.key === 'T' || e.key === 't') {
        e.preventDefault();
        if (!window.electronAPI) return;
        const session = await window.electronAPI.session.create({});
        addSession({ id: session.id, name: session.name, projectId: session.projectId });
      } else if (e.key === 'W' || e.key === 'w') {
        e.preventDefault();
        const store = useSessionStore.getState();
        if (store.activeSessionId) {
          store.closeTab(store.activeSessionId);
        }
      } else if (e.key === 'Tab') {
        e.preventDefault();
        const store = useSessionStore.getState();
        const idx = store.sessions.findIndex((s) => s.id === store.activeSessionId);
        if (idx >= 0 && store.sessions.length > 1) {
          const next = (idx + 1) % store.sessions.length;
          store.setActiveSession(store.sessions[next].id);
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [addSession]);

  // Listen for PTY exit events
  useEffect(() => {
    if (!window.electronAPI) return;
    const unsub = window.electronAPI.pty.onExit((sessionId) => {
      useSessionStore.getState().setPtyStatus(sessionId, 'exited');
    });
    return unsub;
  }, []);

  // Listen for agent auto-rename events
  useEffect(() => {
    if (!window.electronAPI) return;
    const unsub = window.electronAPI.session.onRenamed((sessionId, name) => {
      useSessionStore.getState().renameSession(sessionId, name);
    });
    return unsub;
  }, []);

  useEffect(() => {
    async function init() {
      if (!window.electronAPI) {
        console.warn('[Termimate] electronAPI not available - running outside Electron');
        return;
      }

      // Load persisted projects and agents
      await loadProjects();
      await loadAgents();

      // Load persisted sessions
      const sessions = await window.electronAPI.session.list();

      if (sessions.length > 0) {
        setSessions(
          sessions.map((s) => ({
            id: s.id,
            name: s.name,
            projectId: s.projectId,
          })),
        );
      } else {
        // Create a default session
        const session = await window.electronAPI.session.create({});
        addSession({
          id: session.id,
          name: session.name,
          projectId: session.projectId,
        });
      }
    }

    init();
  }, []);

  return (
    <div className="flex flex-col h-screen bg-background text-on-background font-body">
      <Topbar
        onOpenSettings={() => setSettingsOpen(true)}
        view={view}
        onToggleChat={() => setView((v) => (v === 'chat' ? 'terminal' : 'chat'))}
      />
      <div className="flex flex-1 pt-12 overflow-hidden">
        <Sidenav
          onOpenSettings={() => setSettingsOpen(true)}
          view={view}
          onNavigate={setView}
        />
        <MainArea view={view} />
      </div>
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ConfirmationDialog />
    </div>
  );
}

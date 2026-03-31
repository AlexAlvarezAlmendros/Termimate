import { useState, useEffect } from 'react';
import { Topbar } from './components/layout/Topbar/Topbar';
import { Sidenav } from './components/layout/Sidenav/Sidenav';
import { MainArea } from './components/layout/MainArea/MainArea';
import { SettingsModal } from './components/settings/SettingsModal';
import { useSessionStore } from './store/sessionStore';

export default function App() {
  const { setSessions, addSession } = useSessionStore();
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    async function init() {
      if (!window.electronAPI) {
        console.warn('[Termimate] electronAPI not available - running outside Electron');
        return;
      }

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
      <Topbar onOpenSettings={() => setSettingsOpen(true)} />
      <div className="flex flex-1 pt-12 overflow-hidden">
        <Sidenav onOpenSettings={() => setSettingsOpen(true)} />
        <MainArea />
      </div>
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

import { useSessionStore } from '../../../store/sessionStore';
import { useProjectStore } from '../../../store/projectStore';

interface SidenavProps {
  onOpenSettings: () => void;
}

export function Sidenav({ onOpenSettings }: SidenavProps) {
  const { addSession } = useSessionStore();
  const { projects } = useProjectStore();

  const handleNewSession = async () => {
    if (!window.electronAPI) return;
    const session = await window.electronAPI.session.create({});
    addSession({ id: session.id, name: session.name, projectId: session.projectId });
  };

  return (
    <aside className="fixed left-0 top-12 h-[calc(100%-3rem)] w-64 bg-surface-container-low flex flex-col py-4 border-r border-outline-variant/5">
      {/* Actions */}
      <div className="px-4 mb-6">
        <div className="flex flex-col gap-2">
          <button
            onClick={handleNewSession}
            className="flex items-center gap-3 px-3 py-2 bg-primary text-on-primary font-semibold rounded-lg hover:brightness-110 active:scale-95 transition-all"
          >
            <PlusIcon />
            <span className="text-sm">New Session</span>
          </button>
          <button className="flex items-center gap-3 px-3 py-2 text-outline hover:bg-surface-container-high/50 rounded-lg transition-colors">
            <RobotIcon />
            <span className="text-sm">Agents</span>
          </button>
        </div>
      </div>

      {/* Projects */}
      <div className="flex-1 overflow-y-auto px-2 space-y-6">
        <div>
          <h3 className="px-4 mb-2 text-[10px] uppercase tracking-[0.2em] text-outline font-bold">
            Projects
          </h3>
          <div className="space-y-1">
            {projects.length === 0 && (
              <p className="px-4 text-xs text-outline/50">No projects yet</p>
            )}
            {projects.map((project) => (
              <div
                key={project.id}
                className="group flex items-center justify-between px-3 py-2 text-outline hover:bg-surface-container-high/50 mx-2 rounded-lg cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm">{project.icon || '📁'}</span>
                  <span className="text-xs">{project.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-auto pt-4 border-t border-outline-variant/10 px-2 space-y-1">
        <button onClick={onOpenSettings} className="flex items-center gap-3 px-3 py-2 text-outline hover:bg-surface-container-high/50 rounded-lg cursor-pointer transition-colors w-full">
          <SettingsSmallIcon />
          <span className="text-sm">Settings</span>
        </button>
      </div>
    </aside>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function RobotIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v4" />
      <line x1="8" y1="16" x2="8" y2="16" />
      <line x1="16" y1="16" x2="16" y2="16" />
    </svg>
  );
}

function SettingsSmallIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

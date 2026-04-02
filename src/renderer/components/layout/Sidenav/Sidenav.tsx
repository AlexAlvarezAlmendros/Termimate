import { useState, useRef, useEffect } from 'react';
import { useSessionStore } from '../../../store/sessionStore';
import { useProject } from '../../../hooks/useProject';
import { ProjectModal } from '../../projects/ProjectModal';
import type { Project } from '../../../../../shared/types/project.types';

type AppView = 'terminal' | 'chat' | 'agents';

interface SidenavProps {
  onOpenSettings: () => void;
  view: AppView;
  onNavigate: (view: AppView) => void;
}

export function Sidenav({ onOpenSettings, view, onNavigate }: SidenavProps) {
  const { sessions, activeSessionId, openTabIds, addSession, openSession, renameSession, deleteSession, toggleStar, assignProject } = useSessionStore();
  const { projects, deleteProject } = useProject();

  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [menuState, setMenuState] = useState<{ id: string; x: number; y: number } | null>(null);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ sessionId: string; name: string } | null>(null);

  const menuSession = menuState ? (sessions.find((s) => s.id === menuState.id) ?? null) : null;

  // Close menu on outside click
  useEffect(() => {
    if (!menuState) return;
    const handler = () => { setMenuState(null); setProjectPickerOpen(false); };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [menuState]);

  const handleNewSession = async () => {
    if (!window.electronAPI) return;
    const session = await window.electronAPI.session.create({});
    addSession({ id: session.id, name: session.name, projectId: session.projectId });
    onNavigate('terminal');
  };

  const handleNewProject = () => {
    setEditingProject(null);
    setProjectModalOpen(true);
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setProjectModalOpen(true);
  };

  const handleDeleteProject = async (project: Project) => {
    if (!confirm(`Delete project "${project.name}"? This cannot be undone.`)) return;
    await deleteProject(project.id);
  };

  const toggleProject = (projectId: string) => {
    setCollapsedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  const startRename = (sessionId: string, currentName: string) => {
    setRenamingSessionId(sessionId);
    setRenameValue(currentName);
    setTimeout(() => renameInputRef.current?.select(), 0);
  };

  const commitRename = async (sessionId: string) => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== sessions.find((s) => s.id === sessionId)?.name) {
      renameSession(sessionId, trimmed);
      if (window.electronAPI) {
        await window.electronAPI.session.update(sessionId, { name: trimmed });
      }
    }
    setRenamingSessionId(null);
  };

  const handleDeleteSession = (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    setMenuState(null);
    setDeleteConfirm({ sessionId, name: session?.name ?? sessionId });
  };

  const confirmDelete = () => {
    if (!deleteConfirm) return;
    deleteSession(deleteConfirm.sessionId);
    setDeleteConfirm(null);
  };

  const handleAssignProject = async (sessionId: string, projectId: string | null) => {
    assignProject(sessionId, projectId);
    if (window.electronAPI) {
      await window.electronAPI.session.update(sessionId, { projectId });
    }
    setMenuState(null);
    setProjectPickerOpen(false);
  };

  // Group sessions by projectId
  const sessionsByProject = new Map<string | null, typeof sessions>();
  sessionsByProject.set(null, []);
  for (const project of projects) {
    sessionsByProject.set(project.id, []);
  }
  for (const session of sessions) {
    const key = session.projectId ?? null;
    if (!sessionsByProject.has(key)) sessionsByProject.set(key, []);
    sessionsByProject.get(key)!.push(session);
  }

  const [hoveredSessionId, setHoveredSessionId] = useState<string | null>(null);

  const renderSessionItem = (session: typeof sessions[number]) => {
    const isInTab = openTabIds.includes(session.id);
    const isActive = session.id === activeSessionId && isInTab;
    const isHovered = hoveredSessionId === session.id;
    return (
      <div
        key={session.id}
        className={`flex items-center gap-1.5 pl-6 pr-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
          isActive
            ? 'bg-primary/10 text-primary'
            : 'text-outline/70 hover:bg-surface-container-high/50 hover:text-on-surface'
        }`}
        onClick={() => { openSession(session.id); onNavigate('terminal'); }}
        onMouseEnter={() => setHoveredSessionId(session.id)}
        onMouseLeave={() => setHoveredSessionId(null)}
      >
        {session.starred && (
          <span className="text-amber-400 text-[10px] shrink-0">★</span>
        )}
        <span className="text-[10px] text-outline/40 shrink-0">›</span>
        {renamingSessionId === session.id ? (
          <input
            ref={renameInputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={() => commitRename(session.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename(session.id);
              if (e.key === 'Escape') setRenamingSessionId(null);
            }}
            className="flex-1 bg-surface-container-high text-xs px-1 py-0.5 rounded focus:outline-none focus:ring-1 focus:ring-primary/50 min-w-0"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="text-xs truncate flex-1 min-w-0" title={session.name}>
            {session.name}
          </span>
        )}
        {isInTab && (
          <span className="w-1.5 h-1.5 rounded-full bg-green-400/60 shrink-0" title="Open in tab" />
        )}
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            setMenuState((ms) =>
              ms?.id === session.id ? null : { id: session.id, x: rect.right + 4, y: rect.top }
            );
            setProjectPickerOpen(false);
          }}
          style={{ opacity: isHovered || menuState?.id === session.id ? 1 : 0, pointerEvents: isHovered || menuState?.id === session.id ? 'auto' : 'none' }}
          className="shrink-0 p-1 rounded hover:bg-white/10 transition-colors text-on-surface/70 hover:text-on-surface"
          title="Options"
        >
          <DotsIcon />
        </button>
      </div>
    );
  };

  return (
    <>
      <aside className="fixed left-0 top-12 h-[calc(100%-3rem)] w-64 bg-surface-container-low flex flex-col py-4 border-r border-outline-variant/5">
        {/* Actions */}
        <div className="px-4 mb-4">
          <button
            onClick={handleNewSession}
            className="flex items-center gap-3 px-3 py-2 w-full bg-primary text-on-primary font-semibold rounded-lg hover:brightness-110 active:scale-95 transition-all"
          >
            <PlusIcon />
            <span className="text-sm">New Session</span>
          </button>
        </div>

        {/* Nav */}
        <div className="px-2 mb-4 space-y-1">
          <button
            onClick={() => onNavigate(view === 'agents' ? 'terminal' : 'agents')}
            className={`flex items-center gap-3 px-3 py-2 w-full rounded-lg transition-colors text-sm ${
              view === 'agents'
                ? 'bg-primary/10 text-primary'
                : 'text-outline hover:bg-surface-container-high/50'
            }`}
          >
            <AgentsIcon />
            <span>Agents</span>
          </button>
        </div>

        {/* Projects & Sessions */}
        <div className="flex-1 overflow-y-auto px-2 space-y-1">
          <div className="flex items-center justify-between px-3 mb-2">
            <h3 className="text-[10px] uppercase tracking-[0.2em] text-outline font-bold">Projects</h3>
            <button onClick={handleNewProject} title="New Project" className="text-outline hover:text-primary transition-colors">
              <SmallPlusIcon />
            </button>
          </div>

          {/* Sessions without project */}
          {(sessionsByProject.get(null) ?? []).length > 0 && (
            <div className="mb-2">
              <div
                className="flex items-center gap-2 px-3 py-1 cursor-pointer text-outline/50 hover:text-outline transition-colors"
                onClick={() => toggleProject('__none__')}
              >
                <span className="text-[10px]">{collapsedProjects.has('__none__') ? '▶' : '▼'}</span>
                <span className="text-[10px] uppercase tracking-wide font-bold">No Project</span>
              </div>
              {!collapsedProjects.has('__none__') && (
                <div className="space-y-0.5 mt-0.5">
                  {(sessionsByProject.get(null) ?? []).map(renderSessionItem)}
                </div>
              )}
            </div>
          )}

          {/* Projects with their sessions */}
          {projects.length === 0 && (sessionsByProject.get(null) ?? []).length === 0 && (
            <p className="px-4 text-xs text-outline/40 py-2">No projects yet</p>
          )}
          {projects.map((project) => {
            const projectSessions = sessionsByProject.get(project.id) ?? [];
            const isCollapsed = collapsedProjects.has(project.id);
            return (
              <div key={project.id} className="mb-1">
                <div className="group flex items-center justify-between px-3 py-1.5 rounded-lg cursor-pointer hover:bg-surface-container-high/50 transition-colors">
                  <div
                    className="flex items-center gap-2 flex-1 min-w-0"
                    onClick={() => toggleProject(project.id)}
                  >
                    <span className="text-[10px] text-outline/50 shrink-0">{isCollapsed ? '▶' : '▼'}</span>
                    <span className="text-sm shrink-0" style={{ color: project.color ?? undefined }}>
                      {project.icon ?? '📁'}
                    </span>
                    <span className="text-xs truncate text-outline">{project.name}</span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleEditProject(project); }}
                      className="p-1 rounded hover:text-primary transition-colors"
                      title="Edit project"
                    >
                      <EditIcon />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteProject(project); }}
                      className="p-1 rounded hover:text-error transition-colors"
                      title="Delete project"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
                {!isCollapsed && (
                  <div className="space-y-0.5 mt-0.5">
                    {projectSessions.length === 0 && (
                      <p className="pl-7 text-[10px] text-outline/30 py-1">No sessions</p>
                    )}
                    {projectSessions.map(renderSessionItem)}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-auto pt-4 border-t border-outline-variant/10 px-2 space-y-1">
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-3 px-3 py-2 text-outline hover:bg-surface-container-high/50 rounded-lg cursor-pointer transition-colors w-full"
          >
            <SettingsSmallIcon />
            <span className="text-sm">Settings</span>
          </button>
        </div>
      </aside>

      <ProjectModal
        isOpen={projectModalOpen}
        onClose={() => setProjectModalOpen(false)}
        project={editingProject}
      />

      {/* Floating session options menu */}
      {menuState && menuSession && (
        <div
          className="fixed z-200 min-w-44 bg-surface-container-high rounded-lg shadow-xl border border-outline-variant/20 py-1"
          style={{ left: menuState.x, top: menuState.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {projectPickerOpen ? (
            <>
              <div className="px-3 py-1.5 flex items-center gap-2 text-xs text-outline/70 border-b border-outline-variant/10">
                <button
                  onClick={() => setProjectPickerOpen(false)}
                  className="hover:text-on-surface transition-colors"
                >
                  ←
                </button>
                <span>Assign to project</span>
              </div>
              <button
                onClick={() => handleAssignProject(menuSession.id, null)}
                className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 hover:bg-primary/10 transition-colors ${menuSession.projectId === null ? 'text-primary' : 'text-on-surface'}`}
              >
                No Project
              </button>
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleAssignProject(menuSession.id, p.id)}
                  className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 hover:bg-primary/10 transition-colors ${menuSession.projectId === p.id ? 'text-primary' : 'text-on-surface'}`}
                >
                  <span>{p.icon ?? '📁'}</span>
                  <span className="truncate">{p.name}</span>
                </button>
              ))}
            </>
          ) : (
            <>
              <button
                onClick={() => { startRename(menuSession.id, menuSession.name); setMenuState(null); }}
                className="w-full text-left px-3 py-1.5 text-sm text-on-surface hover:bg-primary/10 transition-colors"
              >
                Rename
              </button>
              <button
                onClick={() => { toggleStar(menuSession.id); setMenuState(null); }}
                className="w-full text-left px-3 py-1.5 text-sm text-on-surface hover:bg-primary/10 transition-colors flex items-center gap-2"
              >
                <span className="text-amber-400">★</span>
                {menuSession.starred ? 'Unstar' : 'Destacar'}
              </button>
              <button
                onClick={() => setProjectPickerOpen(true)}
                className="w-full text-left px-3 py-1.5 text-sm text-on-surface hover:bg-primary/10 transition-colors"
              >
                Assign to project
              </button>
              <div className="border-t border-outline-variant/10 my-1" />
              <button
                onClick={() => handleDeleteSession(menuSession.id)}
                className="w-full text-left px-3 py-1.5 text-sm text-error hover:bg-error/10 transition-colors"
              >
                Delete permanently
              </button>
            </>
          )}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-300 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)} />
          <div className="relative w-full max-w-sm mx-4 bg-surface-container border border-outline-variant/20 rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-outline-variant/10 bg-error/5">
              <div className="w-8 h-8 rounded-full bg-error/15 flex items-center justify-center text-error shrink-0">
                <TrashModalIcon />
              </div>
              <div>
                <p className="text-sm font-bold text-on-surface">Delete session?</p>
                <p className="text-xs text-outline">This action cannot be undone</p>
              </div>
            </div>
            {/* Body */}
            <div className="px-5 py-4">
              <p className="text-sm text-on-surface/80">
                Se eliminará permanentemente la sesión{' '}
                <span className="font-semibold text-on-surface">"{deleteConfirm.name}"</span>{' '}
                y todo su historial.
              </p>
            </div>
            {/* Actions */}
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-outline-variant/10">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm font-semibold text-on-surface border border-outline-variant/30 rounded-lg hover:bg-surface-container-high transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-sm font-semibold bg-error text-white rounded-lg hover:brightness-110 transition-all"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
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

function SmallPlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function AgentsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v4" />
      <line x1="8" y1="16" x2="8" y2="16" strokeLinecap="round" strokeWidth="3" />
      <line x1="16" y1="16" x2="16" y2="16" strokeLinecap="round" strokeWidth="3" />
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

function DotsIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}

function TrashModalIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

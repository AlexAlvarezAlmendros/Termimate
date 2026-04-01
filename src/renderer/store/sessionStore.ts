import { create } from 'zustand';

export type PtyStatus = 'running' | 'exited';

export interface SessionState {
  id: string;
  name: string;
  projectId: string | null;
  starred?: boolean;
}

interface SessionStore {
  /** All sessions (sidenav list, persisted in DB) */
  sessions: SessionState[];
  /** IDs of sessions currently open as tabs in the terminal */
  openTabIds: string[];
  activeSessionId: string | null;
  ptyStatus: Record<string, PtyStatus>;
  setSessions: (sessions: SessionState[]) => void;
  addSession: (session: SessionState) => void;
  setActiveSession: (id: string) => void;
  /** Open an existing session as a tab (or focus it if already open) */
  openSession: (id: string) => void;
  /** Close the tab without deleting the session */
  closeTab: (id: string) => void;
  /** Permanently delete a session from DB and store */
  deleteSession: (id: string) => void;
  /** Alias for deleteSession kept for backward-compat */
  closeSession: (id: string) => void;
  renameSession: (id: string, name: string) => void;
  assignProject: (id: string, projectId: string | null) => void;
  toggleStar: (id: string) => void;
  setPtyStatus: (sessionId: string, status: PtyStatus) => void;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions: [],
  openTabIds: [],
  activeSessionId: null,
  ptyStatus: {},

  setSessions: (sessions) => {
    set({
      sessions,
      openTabIds: sessions.map((s) => s.id),
      activeSessionId: sessions.length > 0 ? sessions[0].id : null,
    });
  },

  addSession: (session) => {
    set((state) => ({
      sessions: [...state.sessions, session],
      openTabIds: [...state.openTabIds, session.id],
      activeSessionId: session.id,
      ptyStatus: { ...state.ptyStatus, [session.id]: 'running' },
    }));
  },

  setActiveSession: (id) => {
    set({ activeSessionId: id });
  },

  openSession: (id) => {
    set((state) => {
      if (state.openTabIds.includes(id)) {
        return { activeSessionId: id };
      }
      return {
        openTabIds: [...state.openTabIds, id],
        activeSessionId: id,
        ptyStatus: { ...state.ptyStatus, [id]: 'running' },
      };
    });
  },

  closeTab: (id) => {
    window.electronAPI.pty.destroy(id);
    set((state) => {
      const remaining = state.openTabIds.filter((tid) => tid !== id);
      const newActive =
        state.activeSessionId === id
          ? (remaining[remaining.length - 1] ?? null)
          : state.activeSessionId;
      return { openTabIds: remaining, activeSessionId: newActive };
    });
  },

  deleteSession: (id) => {
    window.electronAPI.pty.destroy(id);
    window.electronAPI.session.delete(id);
    set((state) => {
      const remainingSessions = state.sessions.filter((s) => s.id !== id);
      const remainingTabs = state.openTabIds.filter((tid) => tid !== id);
      const newActive =
        state.activeSessionId === id
          ? (remainingTabs[remainingTabs.length - 1] ?? remainingSessions[remainingSessions.length - 1]?.id ?? null)
          : state.activeSessionId;
      const { [id]: _removed, ...restPtyStatus } = state.ptyStatus;
      return {
        sessions: remainingSessions,
        openTabIds: remainingTabs,
        activeSessionId: newActive,
        ptyStatus: restPtyStatus,
      };
    });
  },

  closeSession: (id) => {
    get().deleteSession(id);
  },

  renameSession: (id, name) => {
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === id ? { ...s, name } : s)),
    }));
  },

  assignProject: (id, projectId) => {
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === id ? { ...s, projectId } : s)),
    }));
  },

  toggleStar: (id) => {
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === id ? { ...s, starred: !s.starred } : s)),
    }));
  },

  setPtyStatus: (sessionId, status) => {
    set((state) => ({
      ptyStatus: { ...state.ptyStatus, [sessionId]: status },
    }));
  },
}));

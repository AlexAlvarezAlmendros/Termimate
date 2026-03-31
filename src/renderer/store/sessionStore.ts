import { create } from 'zustand';

interface SessionState {
  id: string;
  name: string;
  projectId: string | null;
}

interface SessionStore {
  sessions: SessionState[];
  activeSessionId: string | null;
  setSessions: (sessions: SessionState[]) => void;
  addSession: (session: SessionState) => void;
  setActiveSession: (id: string) => void;
  closeSession: (id: string) => void;
  renameSession: (id: string, name: string) => void;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions: [],
  activeSessionId: null,

  setSessions: (sessions) => {
    set({
      sessions,
      activeSessionId: sessions.length > 0 ? sessions[0].id : null,
    });
  },

  addSession: (session) => {
    set((state) => ({
      sessions: [...state.sessions, session],
      activeSessionId: session.id,
    }));
  },

  setActiveSession: (id) => {
    set({ activeSessionId: id });
  },

  closeSession: (id) => {
    // Destroy the PTY process
    window.electronAPI.pty.destroy(id);

    set((state) => {
      const remaining = state.sessions.filter((s) => s.id !== id);
      const newActive =
        state.activeSessionId === id
          ? remaining[remaining.length - 1]?.id ?? null
          : state.activeSessionId;
      return { sessions: remaining, activeSessionId: newActive };
    });
  },

  renameSession: (id, name) => {
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === id ? { ...s, name } : s)),
    }));
  },
}));

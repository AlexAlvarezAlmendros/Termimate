import { create } from 'zustand';
import type { Agent } from '../../../shared/types/agent.types';

interface AgentCrudStore {
  agents: Agent[];
  setAgents: (agents: Agent[]) => void;
  addAgent: (agent: Agent) => void;
  updateAgent: (id: string, updates: Partial<Agent>) => void;
  removeAgent: (id: string) => void;
}

export const useAgentCrudStore = create<AgentCrudStore>((set) => ({
  agents: [],
  setAgents: (agents) => set({ agents }),
  addAgent: (agent) => set((s) => ({ agents: [...s.agents, agent] })),
  updateAgent: (id, updates) =>
    set((s) => ({ agents: s.agents.map((a) => (a.id === id ? { ...a, ...updates } : a)) })),
  removeAgent: (id) => set((s) => ({ agents: s.agents.filter((a) => a.id !== id) })),
}));

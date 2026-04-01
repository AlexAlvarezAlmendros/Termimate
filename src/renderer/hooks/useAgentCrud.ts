import { useCallback } from 'react';
import { useAgentCrudStore } from '../store/agentCrudStore';
import type { CreateAgentDTO, UpdateAgentDTO } from '../../../shared/types/agent.types';

export function useAgentCrud() {
  const { agents, setAgents, addAgent, updateAgent, removeAgent } = useAgentCrudStore();

  const loadAgents = useCallback(async () => {
    if (!window.electronAPI) return;
    const loaded = await window.electronAPI.agent.list();
    setAgents(loaded);
  }, [setAgents]);

  const createAgent = useCallback(async (dto: CreateAgentDTO) => {
    if (!window.electronAPI) throw new Error('electronAPI not available');
    const agent = await window.electronAPI.agent.create(dto);
    addAgent(agent);
    return agent;
  }, [addAgent]);

  const editAgent = useCallback(async (id: string, dto: UpdateAgentDTO) => {
    if (!window.electronAPI) throw new Error('electronAPI not available');
    const updated = await window.electronAPI.agent.update(id, dto);
    updateAgent(id, updated);
    return updated;
  }, [updateAgent]);

  const deleteAgent = useCallback(async (id: string) => {
    if (!window.electronAPI) return;
    await window.electronAPI.agent.delete(id);
    removeAgent(id);
  }, [removeAgent]);

  return { agents, loadAgents, createAgent, editAgent, deleteAgent };
}

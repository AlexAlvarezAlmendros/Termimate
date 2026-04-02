import { ipcMain } from 'electron';
import { AgentExecutor } from '../../agent/AgentExecutor';
import { AgentRepository } from '../../database/repositories/AgentRepository';
import { IPC_CHANNELS } from '../../../shared/constants';
import type { SendMessageParams, CreateAgentDTO, UpdateAgentDTO } from '../../../shared/types/agent.types';

export function registerAgentHandlers(): void {
  const executor = AgentExecutor.getInstance();
  const agentRepo = new AgentRepository();

  ipcMain.handle(IPC_CHANNELS.AGENT_SEND_MESSAGE, async (_event, params: SendMessageParams) => {
    const streamId = await executor.handleMessage(params);
    return { streamId };
  });

  ipcMain.on(IPC_CHANNELS.AGENT_CANCEL, (_event, streamId: string) => {
    executor.cancelStream(streamId);
  });

  ipcMain.handle(IPC_CHANNELS.AGENT_CONFIRM_RESPONSE, (_event, requestId: string, approved: boolean) => {
    executor.resolveConfirmation(requestId, approved);
  });

  ipcMain.handle(IPC_CHANNELS.AGENT_QUESTION_RESPONSE, (_event, requestId: string, answer: string) => {
    executor.resolveQuestion(requestId, answer);
  });

  ipcMain.handle(IPC_CHANNELS.AGENT_LIST, () => agentRepo.findAll());
  ipcMain.handle(IPC_CHANNELS.AGENT_CREATE, (_event, dto: CreateAgentDTO) => agentRepo.create(dto));
  ipcMain.handle(IPC_CHANNELS.AGENT_UPDATE, (_event, id: string, dto: UpdateAgentDTO) => agentRepo.update(id, dto));
  ipcMain.handle(IPC_CHANNELS.AGENT_DELETE, (_event, id: string) => {
    if (id === 'default') throw new Error('Cannot delete the default agent.');
    agentRepo.delete(id);
  });
}

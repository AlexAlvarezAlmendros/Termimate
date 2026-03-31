import { ipcMain } from 'electron';
import { AgentExecutor } from '../../agent/AgentExecutor';
import { IPC_CHANNELS } from '../../../shared/constants';
import type { SendMessageParams } from '../../../shared/types/agent.types';

export function registerAgentHandlers(): void {
  const executor = AgentExecutor.getInstance();

  ipcMain.handle(IPC_CHANNELS.AGENT_SEND_MESSAGE, async (_event, params: SendMessageParams) => {
    const streamId = await executor.handleMessage(params);
    return { streamId };
  });

  ipcMain.on(IPC_CHANNELS.AGENT_CANCEL, (_event, streamId: string) => {
    executor.cancelStream(streamId);
  });

  ipcMain.handle(IPC_CHANNELS.AGENT_CONFIRM_RESPONSE, (_event, _requestId: string, _approved: boolean) => {
    // TODO: Implement confirmation flow for bash_execute
  });
}

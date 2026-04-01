import { ipcMain } from 'electron';
import { MessageRepository } from '../../database/repositories/MessageRepository';
import { IPC_CHANNELS } from '../../../shared/constants';

export function registerMessageHandlers(): void {
  const messageRepo = new MessageRepository();

  ipcMain.handle(IPC_CHANNELS.MESSAGE_LIST, (_event, sessionId: string) => {
    return messageRepo.findBySession(sessionId);
  });

  ipcMain.handle(IPC_CHANNELS.MESSAGE_DELETE_BY_SESSION, (_event, sessionId: string) => {
    messageRepo.deleteBySession(sessionId);
  });
}

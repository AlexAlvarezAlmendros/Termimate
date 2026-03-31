import { ipcMain } from 'electron';
import { SessionRepository } from '../../database/repositories/SessionRepository';
import { IPC_CHANNELS } from '../../../shared/constants';
import type { CreateSessionDTO } from '../../../shared/types/session.types';

export function registerSessionHandlers(): void {
  const sessionRepo = new SessionRepository();

  ipcMain.handle(IPC_CHANNELS.SESSION_LIST, (_event, projectId?: string) => {
    return sessionRepo.findAll(projectId);
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_CREATE, (_event, dto: CreateSessionDTO) => {
    return sessionRepo.create(dto);
  });
}

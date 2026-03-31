import { ipcMain } from 'electron';
import { ProjectRepository } from '../../database/repositories/ProjectRepository';
import { IPC_CHANNELS } from '../../../shared/constants';
import type { CreateProjectDTO, UpdateProjectDTO } from '../../../shared/types/project.types';

export function registerProjectHandlers(): void {
  const projectRepo = new ProjectRepository();

  ipcMain.handle(IPC_CHANNELS.PROJECT_LIST, () => {
    return projectRepo.findAll();
  });

  ipcMain.handle(IPC_CHANNELS.PROJECT_CREATE, (_event, dto: CreateProjectDTO) => {
    return projectRepo.create(dto);
  });

  ipcMain.handle(IPC_CHANNELS.PROJECT_UPDATE, (_event, id: string, dto: UpdateProjectDTO) => {
    return projectRepo.update(id, dto);
  });

  ipcMain.handle(IPC_CHANNELS.PROJECT_DELETE, (_event, id: string) => {
    projectRepo.delete(id);
  });
}

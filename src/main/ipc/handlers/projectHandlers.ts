import { ipcMain } from 'electron';
import { ProjectRepository } from '../../database/repositories/ProjectRepository';
import { ProjectDocumentRepository } from '../../database/repositories/ProjectDocumentRepository';
import { IPC_CHANNELS } from '../../../shared/constants';
import type { CreateProjectDTO, UpdateProjectDTO } from '../../../shared/types/project.types';

export function registerProjectHandlers(): void {
  const projectRepo = new ProjectRepository();
  const docRepo = new ProjectDocumentRepository();

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

  // Project documents
  ipcMain.handle(IPC_CHANNELS.PROJECT_DOCUMENT_LIST, (_event, projectId: string) => {
    return docRepo.findByProject(projectId);
  });

  ipcMain.handle(IPC_CHANNELS.PROJECT_DOCUMENT_ADD, (_event, projectId: string, filePath: string, fileName: string, mimeType?: string) => {
    return docRepo.create(projectId, filePath, fileName, mimeType);
  });

  ipcMain.handle(IPC_CHANNELS.PROJECT_DOCUMENT_REMOVE, (_event, docId: string) => {
    docRepo.delete(docId);
  });
}

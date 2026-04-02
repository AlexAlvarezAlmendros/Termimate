import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';
import type { ElectronAPI } from '../../shared/types/ipc.types';

console.log('[Termimate Preload] Script starting...');

const electronAPI: ElectronAPI = {
  pty: {
    create: (config) => ipcRenderer.invoke(IPC_CHANNELS.PTY_CREATE, config),
    write: (sessionId, data) => ipcRenderer.send(IPC_CHANNELS.PTY_WRITE, sessionId, data),
    resize: (sessionId, cols, rows) =>
      ipcRenderer.invoke(IPC_CHANNELS.PTY_RESIZE, sessionId, cols, rows),
    destroy: (sessionId) => ipcRenderer.invoke(IPC_CHANNELS.PTY_DESTROY, sessionId),
    getScrollback: (sessionId) => ipcRenderer.invoke(IPC_CHANNELS.PTY_GET_SCROLLBACK, sessionId),
    onData: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, sessionId: string, data: string) =>
        callback(sessionId, data);
      ipcRenderer.on(IPC_CHANNELS.PTY_DATA, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.PTY_DATA, handler);
    },
    onExit: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, sessionId: string, exitCode: number) =>
        callback(sessionId, exitCode);
      ipcRenderer.on(IPC_CHANNELS.PTY_EXIT, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.PTY_EXIT, handler);
    },
  },
  agent: {
    sendMessage: (params) => ipcRenderer.invoke(IPC_CHANNELS.AGENT_SEND_MESSAGE, params),
    onStreamEvent: (callback) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        streamId: string,
        event: Parameters<typeof callback>[1],
      ) => callback(streamId, event);
      ipcRenderer.on(IPC_CHANNELS.AGENT_STREAM_EVENT, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.AGENT_STREAM_EVENT, handler);
    },
    onConfirmRequest: (callback) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        request: Parameters<typeof callback>[0],
      ) => callback(request);
      ipcRenderer.on(IPC_CHANNELS.AGENT_CONFIRM_REQUEST, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.AGENT_CONFIRM_REQUEST, handler);
    },
    onQuestionRequest: (callback) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        request: Parameters<typeof callback>[0],
      ) => callback(request);
      ipcRenderer.on(IPC_CHANNELS.AGENT_QUESTION_REQUEST, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.AGENT_QUESTION_REQUEST, handler);
    },
    confirmResponse: (requestId, approved) =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_CONFIRM_RESPONSE, requestId, approved),
    questionResponse: (requestId, answer) =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_QUESTION_RESPONSE, requestId, answer),
    cancel: (streamId) => ipcRenderer.send(IPC_CHANNELS.AGENT_CANCEL, streamId),
    list: () => ipcRenderer.invoke(IPC_CHANNELS.AGENT_LIST),
    create: (dto) => ipcRenderer.invoke(IPC_CHANNELS.AGENT_CREATE, dto),
    update: (id, dto) => ipcRenderer.invoke(IPC_CHANNELS.AGENT_UPDATE, id, dto),
    delete: (id) => ipcRenderer.invoke(IPC_CHANNELS.AGENT_DELETE, id),
  },
  project: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_LIST),
    create: (dto) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_CREATE, dto),
    update: (id, dto) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_UPDATE, id, dto),
    delete: (id) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_DELETE, id),
    listDocuments: (projectId) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_DOCUMENT_LIST, projectId),
    addDocument: (projectId, filePath, fileName, mimeType) =>
      ipcRenderer.invoke(IPC_CHANNELS.PROJECT_DOCUMENT_ADD, projectId, filePath, fileName, mimeType),
    removeDocument: (docId) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_DOCUMENT_REMOVE, docId),
  },
  session: {
    list: (projectId) => ipcRenderer.invoke(IPC_CHANNELS.SESSION_LIST, projectId),
    create: (dto) => ipcRenderer.invoke(IPC_CHANNELS.SESSION_CREATE, dto),
    delete: (id) => ipcRenderer.invoke(IPC_CHANNELS.SESSION_DELETE, id),
    update: (id, dto) => ipcRenderer.invoke(IPC_CHANNELS.SESSION_UPDATE, id, dto),
    onRenamed: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, sessionId: string, name: string) =>
        callback(sessionId, name);
      ipcRenderer.on(IPC_CHANNELS.SESSION_RENAMED, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.SESSION_RENAMED, handler);
    },
  },
  message: {
    list: (sessionId) => ipcRenderer.invoke(IPC_CHANNELS.MESSAGE_LIST, sessionId),
    deleteBySession: (sessionId) => ipcRenderer.invoke(IPC_CHANNELS.MESSAGE_DELETE_BY_SESSION, sessionId),
  },
  config: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_GET),
    set: (partial) => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_SET, partial),
    getApiKey: (provider) => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_GET_API_KEY, provider),
    setApiKey: (provider, key) => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_SET_API_KEY, provider, key),
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

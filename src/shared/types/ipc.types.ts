import type { PTYConfig, Session, CreateSessionDTO } from './session.types';
import type { Project, CreateProjectDTO, UpdateProjectDTO } from './project.types';
import type { SendMessageParams, StreamEvent, ConfirmRequest } from './agent.types';

// Renderer → Main (invoke/handle)
export interface IPCInvokeChannels {
  'pty:create': (config: PTYConfig) => { sessionId: string };
  'pty:resize': (sessionId: string, cols: number, rows: number) => void;
  'pty:destroy': (sessionId: string) => void;

  'agent:sendMessage': (params: SendMessageParams) => { streamId: string };
  'agent:confirmResponse': (requestId: string, approved: boolean) => void;

  'project:list': () => Project[];
  'project:create': (dto: CreateProjectDTO) => Project;
  'project:update': (id: string, dto: UpdateProjectDTO) => Project;
  'project:delete': (id: string) => void;

  'session:list': (projectId?: string) => Session[];
  'session:create': (dto: CreateSessionDTO) => Session;

  'config:get': () => AppConfig;
  'config:set': (partial: Partial<AppConfig>) => void;
  'config:getApiKey': (provider: string) => string | null;
  'config:setApiKey': (provider: string, key: string) => void;
}

// Renderer → Main (send, fire & forget)
export interface IPCSendChannels {
  'pty:write': (sessionId: string, data: string) => void;
  'agent:cancel': (streamId: string) => void;
}

// Main → Renderer (push)
export interface IPCPushChannels {
  'pty:data': (sessionId: string, data: string) => void;
  'agent:streamEvent': (streamId: string, event: StreamEvent) => void;
  'agent:confirmRequest': (request: ConfirmRequest) => void;
}

export interface AppConfig {
  appearance: {
    theme: 'dark' | 'light';
    terminalFontFamily: string;
    terminalFontSize: number;
  };
  terminal: {
    defaultShell: string;
    scrollback: number;
  };
  keybindings: Record<string, string>;
  agent: {
    defaultProviderId: string;
    outputBufferLines: number;
  };
}

// The API exposed to renderer via contextBridge
export interface ElectronAPI {
  pty: {
    create: (config: PTYConfig) => Promise<{ sessionId: string }>;
    write: (sessionId: string, data: string) => void;
    resize: (sessionId: string, cols: number, rows: number) => Promise<void>;
    destroy: (sessionId: string) => Promise<void>;
    onData: (callback: (sessionId: string, data: string) => void) => () => void;
  };
  agent: {
    sendMessage: (params: SendMessageParams) => Promise<{ streamId: string }>;
    onStreamEvent: (callback: (streamId: string, event: StreamEvent) => void) => () => void;
    onConfirmRequest: (callback: (request: ConfirmRequest) => void) => () => void;
    confirmResponse: (requestId: string, approved: boolean) => Promise<void>;
    cancel: (streamId: string) => void;
  };
  project: {
    list: () => Promise<Project[]>;
    create: (dto: CreateProjectDTO) => Promise<Project>;
    update: (id: string, dto: UpdateProjectDTO) => Promise<Project>;
    delete: (id: string) => Promise<void>;
  };
  session: {
    list: (projectId?: string) => Promise<Session[]>;
    create: (dto: CreateSessionDTO) => Promise<Session>;
  };
  config: {
    get: () => Promise<AppConfig>;
    set: (partial: Partial<AppConfig>) => Promise<void>;
    getApiKey: (provider: string) => Promise<string | null>;
    setApiKey: (provider: string, key: string) => Promise<void>;
  };
}

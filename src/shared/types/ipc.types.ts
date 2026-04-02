import type { PTYConfig, Session, CreateSessionDTO, UpdateSessionDTO } from './session.types';
import type { Project, CreateProjectDTO, UpdateProjectDTO, ProjectDocument } from './project.types';
import type { Agent, CreateAgentDTO, UpdateAgentDTO, SendMessageParams, StreamEvent, ConfirmRequest, QuestionRequest, Message } from './agent.types';

// Renderer → Main (invoke/handle)
export interface IPCInvokeChannels {
  'pty:create': (config: PTYConfig) => { sessionId: string };
  'pty:resize': (sessionId: string, cols: number, rows: number) => void;
  'pty:destroy': (sessionId: string) => void;
  'pty:getScrollback': (sessionId: string) => string | null;

  'agent:sendMessage': (params: SendMessageParams) => { streamId: string };
  'agent:confirmResponse': (requestId: string, approved: boolean) => void;
  'agent:questionResponse': (requestId: string, answer: string) => void;
  'agent:list': () => Agent[];
  'agent:create': (dto: CreateAgentDTO) => Agent;
  'agent:update': (id: string, dto: UpdateAgentDTO) => Agent;
  'agent:delete': (id: string) => void;

  'project:list': () => Project[];
  'project:create': (dto: CreateProjectDTO) => Project;
  'project:update': (id: string, dto: UpdateProjectDTO) => Project;
  'project:delete': (id: string) => void;
  'project:listDocuments': (projectId: string) => ProjectDocument[];
  'project:addDocument': (projectId: string, filePath: string, fileName: string, mimeType?: string) => ProjectDocument;
  'project:removeDocument': (docId: string) => void;

  'session:list': (projectId?: string) => Session[];
  'session:create': (dto: CreateSessionDTO) => Session;
  'session:delete': (id: string) => void;
  'session:update': (id: string, dto: UpdateSessionDTO) => Session;

  'message:list': (sessionId: string) => Message[];
  'message:deleteBySession': (sessionId: string) => void;

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
  'pty:exit': (sessionId: string, exitCode: number) => void;
  'agent:streamEvent': (streamId: string, event: StreamEvent) => void;
  'agent:confirmRequest': (request: ConfirmRequest) => void;
  'agent:questionRequest': (request: QuestionRequest) => void;
  'session:renamed': (sessionId: string, name: string) => void;
}

export interface AppConfig {
  appearance: {
    theme: 'dark' | 'light';
    terminalTheme: string;
    terminalFontFamily: string;
    terminalFontSize: number;
    cursorStyle: 'block' | 'underline' | 'bar';
    cursorBlink: boolean;
    lineHeight: number;
    letterSpacing: number;
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
    getScrollback: (sessionId: string) => Promise<string | null>;
    onData: (callback: (sessionId: string, data: string) => void) => () => void;
    onExit: (callback: (sessionId: string, exitCode: number) => void) => () => void;
  };
  agent: {
    sendMessage: (params: SendMessageParams) => Promise<{ streamId: string }>;
    onStreamEvent: (callback: (streamId: string, event: StreamEvent) => void) => () => void;
    onConfirmRequest: (callback: (request: ConfirmRequest) => void) => () => void;
    onQuestionRequest: (callback: (request: QuestionRequest) => void) => () => void;
    confirmResponse: (requestId: string, approved: boolean) => Promise<void>;
    questionResponse: (requestId: string, answer: string) => Promise<void>;
    cancel: (streamId: string) => void;
    list: () => Promise<Agent[]>;
    create: (dto: CreateAgentDTO) => Promise<Agent>;
    update: (id: string, dto: UpdateAgentDTO) => Promise<Agent>;
    delete: (id: string) => Promise<void>;
  };
  project: {
    list: () => Promise<Project[]>;
    create: (dto: CreateProjectDTO) => Promise<Project>;
    update: (id: string, dto: UpdateProjectDTO) => Promise<Project>;
    delete: (id: string) => Promise<void>;
    listDocuments: (projectId: string) => Promise<ProjectDocument[]>;
    addDocument: (projectId: string, filePath: string, fileName: string, mimeType?: string) => Promise<ProjectDocument>;
    removeDocument: (docId: string) => Promise<void>;
  };
  session: {
    list: (projectId?: string) => Promise<Session[]>;
    create: (dto: CreateSessionDTO) => Promise<Session>;
    delete: (id: string) => Promise<void>;
    update: (id: string, dto: UpdateSessionDTO) => Promise<Session>;
    onRenamed: (callback: (sessionId: string, name: string) => void) => () => void;
  };
  message: {
    list: (sessionId: string) => Promise<Message[]>;
    deleteBySession: (sessionId: string) => Promise<void>;
  };
  config: {
    get: () => Promise<AppConfig>;
    set: (partial: Partial<AppConfig>) => Promise<void>;
    getApiKey: (provider: string) => Promise<string | null>;
    setApiKey: (provider: string, key: string) => Promise<void>;
  };
}

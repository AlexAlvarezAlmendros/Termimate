export const APP_NAME = 'Termimate';

export const DEFAULT_SHELL =
  process.platform === 'win32' ? 'powershell.exe' : process.platform === 'darwin' ? '/bin/zsh' : '/bin/bash';

export const DEFAULT_TERMINAL_FONT_FAMILY = 'Fira Code, monospace';
export const DEFAULT_TERMINAL_FONT_SIZE = 14;
export const DEFAULT_SCROLLBACK = 5000;
export const DEFAULT_OUTPUT_BUFFER_LINES = 200;
export const MAX_SCROLLBACK_BYTES = 512 * 1024; // 512 KB per session

export const IPC_CHANNELS = {
  PTY_CREATE: 'pty:create',
  PTY_WRITE: 'pty:write',
  PTY_RESIZE: 'pty:resize',
  PTY_DESTROY: 'pty:destroy',
  PTY_DATA: 'pty:data',
  PTY_EXIT: 'pty:exit',
  PTY_GET_SCROLLBACK: 'pty:getScrollback',

  AGENT_SEND_MESSAGE: 'agent:sendMessage',
  AGENT_STREAM_EVENT: 'agent:streamEvent',
  AGENT_CANCEL: 'agent:cancel',
  AGENT_CONFIRM_REQUEST: 'agent:confirmRequest',
  AGENT_CONFIRM_RESPONSE: 'agent:confirmResponse',

  PROJECT_LIST: 'project:list',
  PROJECT_CREATE: 'project:create',
  PROJECT_UPDATE: 'project:update',
  PROJECT_DELETE: 'project:delete',

  SESSION_LIST: 'session:list',
  SESSION_CREATE: 'session:create',
  SESSION_DELETE: 'session:delete',

  CONFIG_GET: 'config:get',
  CONFIG_SET: 'config:set',
  CONFIG_GET_API_KEY: 'config:getApiKey',
  CONFIG_SET_API_KEY: 'config:setApiKey',

  AGENT_LIST: 'agent:list',
  AGENT_CREATE: 'agent:create',
  AGENT_UPDATE: 'agent:update',
  AGENT_DELETE: 'agent:delete',

  SESSION_UPDATE: 'session:update',
  SESSION_RENAMED: 'session:renamed',

  MESSAGE_LIST: 'message:list',
  MESSAGE_DELETE_BY_SESSION: 'message:deleteBySession',

  PROJECT_DOCUMENT_LIST: 'project:listDocuments',
  PROJECT_DOCUMENT_ADD: 'project:addDocument',
  PROJECT_DOCUMENT_REMOVE: 'project:removeDocument',
} as const;

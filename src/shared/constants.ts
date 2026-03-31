export const APP_NAME = 'Termimate';

export const DEFAULT_SHELL =
  process.platform === 'win32' ? 'powershell.exe' : process.platform === 'darwin' ? '/bin/zsh' : '/bin/bash';

export const DEFAULT_TERMINAL_FONT_FAMILY = 'Fira Code, monospace';
export const DEFAULT_TERMINAL_FONT_SIZE = 14;
export const DEFAULT_SCROLLBACK = 5000;
export const DEFAULT_OUTPUT_BUFFER_LINES = 200;

export const IPC_CHANNELS = {
  PTY_CREATE: 'pty:create',
  PTY_WRITE: 'pty:write',
  PTY_RESIZE: 'pty:resize',
  PTY_DESTROY: 'pty:destroy',
  PTY_DATA: 'pty:data',

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

  CONFIG_GET: 'config:get',
  CONFIG_SET: 'config:set',
  CONFIG_GET_API_KEY: 'config:getApiKey',
  CONFIG_SET_API_KEY: 'config:setApiKey',
} as const;

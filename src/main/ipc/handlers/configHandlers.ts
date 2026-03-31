import { ipcMain } from 'electron';
import Store from 'electron-store';
import { IPC_CHANNELS } from '../../../shared/constants';
import { getApiKey, setApiKey } from '../../security/KeychainService';
import type { AppConfig } from '../../../shared/types/ipc.types';
import {
  DEFAULT_SHELL,
  DEFAULT_TERMINAL_FONT_FAMILY,
  DEFAULT_TERMINAL_FONT_SIZE,
  DEFAULT_SCROLLBACK,
  DEFAULT_OUTPUT_BUFFER_LINES,
} from '../../../shared/constants';

const store = new Store<AppConfig>({
  name: 'termimate-config',
  defaults: {
    appearance: {
      theme: 'dark',
      terminalFontFamily: DEFAULT_TERMINAL_FONT_FAMILY,
      terminalFontSize: DEFAULT_TERMINAL_FONT_SIZE,
    },
    terminal: {
      defaultShell: DEFAULT_SHELL,
      scrollback: DEFAULT_SCROLLBACK,
    },
    keybindings: {},
    agent: {
      defaultProviderId: 'anthropic',
      outputBufferLines: DEFAULT_OUTPUT_BUFFER_LINES,
    },
  },
});

export function registerConfigHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.CONFIG_GET, () => {
    return store.store;
  });

  ipcMain.handle(IPC_CHANNELS.CONFIG_SET, (_event, partial: Partial<AppConfig>) => {
    for (const [key, value] of Object.entries(partial)) {
      store.set(key, value);
    }
  });

  ipcMain.handle(IPC_CHANNELS.CONFIG_GET_API_KEY, (_event, provider: string) => {
    return getApiKey(provider);
  });

  ipcMain.handle(IPC_CHANNELS.CONFIG_SET_API_KEY, (_event, provider: string, key: string) => {
    return setApiKey(provider, key);
  });
}

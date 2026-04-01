import Store from 'electron-store';
import type { AppConfig } from '../../shared/types/ipc.types';
import {
  DEFAULT_SHELL,
  DEFAULT_TERMINAL_FONT_FAMILY,
  DEFAULT_TERMINAL_FONT_SIZE,
  DEFAULT_SCROLLBACK,
  DEFAULT_OUTPUT_BUFFER_LINES,
} from '../../shared/constants';

const store = new Store<AppConfig>({
  name: 'termimate-config',
  defaults: {
    appearance: {
      theme: 'dark',
      terminalTheme: 'termimate-dark',
      terminalFontFamily: DEFAULT_TERMINAL_FONT_FAMILY,
      terminalFontSize: DEFAULT_TERMINAL_FONT_SIZE,
      cursorStyle: 'block',
      cursorBlink: true,
      lineHeight: 1.2,
      letterSpacing: 0,
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

export function getConfig(): AppConfig {
  return store.store;
}

export function setConfig(partial: Partial<AppConfig>): void {
  for (const [key, value] of Object.entries(partial)) {
    store.set(key, value);
  }
}

export { store as configStore };

/// <reference types="vite/client" />

import type { ElectronAPI } from '../shared/types/ipc.types';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

import type { ElectronAPI } from '../../shared/types/ipc.types';

/**
 * Typed wrapper around window.electronAPI.
 * Provides a single import point for all IPC calls.
 */
export function getAPI(): ElectronAPI {
  if (!window.electronAPI) {
    throw new Error('electronAPI not available. Are you running inside Electron?');
  }
  return window.electronAPI;
}

import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../../shared/constants';
import { getApiKey, setApiKey } from '../../security/KeychainService';
import type { AppConfig } from '../../../shared/types/ipc.types';
import { getConfig, setConfig } from '../../config/ConfigService';

export function registerConfigHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.CONFIG_GET, () => {
    return getConfig();
  });

  ipcMain.handle(IPC_CHANNELS.CONFIG_SET, (_event, partial: Partial<AppConfig>) => {
    setConfig(partial);
  });

  ipcMain.handle(IPC_CHANNELS.CONFIG_GET_API_KEY, (_event, provider: string) => {
    return getApiKey(provider);
  });

  ipcMain.handle(IPC_CHANNELS.CONFIG_SET_API_KEY, (_event, provider: string, key: string) => {
    return setApiKey(provider, key);
  });
}

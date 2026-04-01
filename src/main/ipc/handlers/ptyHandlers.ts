import { ipcMain, BrowserWindow } from 'electron';
import { PTYManager } from '../../pty/PTYManager';
import { IPC_CHANNELS } from '../../../shared/constants';
import type { PTYConfig } from '../../../shared/types/session.types';

export function registerPtyHandlers(): void {
  const ptyManager = PTYManager.getInstance();

  ipcMain.handle(IPC_CHANNELS.PTY_CREATE, (_event, config: PTYConfig) => {
    const session = ptyManager.createSession(config);

    // Push data from PTY to renderer
    session.onData((data) => {
      const windows = BrowserWindow.getAllWindows();
      for (const win of windows) {
        win.webContents.send(IPC_CHANNELS.PTY_DATA, config.sessionId, data);
      }
    });

    // Notify renderer when process exits
    session.onExit((exitCode) => {
      const windows = BrowserWindow.getAllWindows();
      for (const win of windows) {
        win.webContents.send(IPC_CHANNELS.PTY_EXIT, config.sessionId, exitCode);
      }
    });

    return { sessionId: config.sessionId };
  });

  ipcMain.on(IPC_CHANNELS.PTY_WRITE, (_event, sessionId: string, data: string) => {
    ptyManager.writeToSession(sessionId, data);
  });

  ipcMain.handle(IPC_CHANNELS.PTY_RESIZE, (_event, sessionId: string, cols: number, rows: number) => {
    ptyManager.resizeSession(sessionId, cols, rows);
  });

  ipcMain.handle(IPC_CHANNELS.PTY_DESTROY, (_event, sessionId: string) => {
    ptyManager.destroySession(sessionId);
  });
}

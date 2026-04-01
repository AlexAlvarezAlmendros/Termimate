import { ipcMain, BrowserWindow, app } from 'electron';
import { PTYManager } from '../../pty/PTYManager';
import { IPC_CHANNELS } from '../../../shared/constants';
import { SessionRepository } from '../../database/repositories/SessionRepository';
import type { PTYConfig } from '../../../shared/types/session.types';

export function registerPtyHandlers(): void {
  const ptyManager = PTYManager.getInstance();
  const sessionRepo = new SessionRepository();

  // Debounce timers: save scrollback 5 s after the last chunk of data
  const saveDebouncers = new Map<string, ReturnType<typeof setTimeout>>();

  const scheduleSave = (sessionId: string) => {
    const existing = saveDebouncers.get(sessionId);
    if (existing) clearTimeout(existing);
    saveDebouncers.set(
      sessionId,
      setTimeout(() => {
        saveDebouncers.delete(sessionId);
        const raw = ptyManager.getRawScrollback(sessionId);
        if (raw) {
          try {
            sessionRepo.saveScrollback(sessionId, raw);
          } catch {
            // Session may have been deleted; ignore
          }
        }
      }, 5000),
    );
  };

  ipcMain.handle(IPC_CHANNELS.PTY_CREATE, (_event, config: PTYConfig) => {
    // Seed the in-memory buffer with previously saved scrollback so cumulative
    // history is never lost when the app is restarted.
    const savedScrollback = sessionRepo.getScrollback(config.sessionId) ?? undefined;
    const session = ptyManager.createSession(config, savedScrollback);

    // When there is saved scrollback, block only the sequences that would
    // permanently destroy the replayed history:
    //   \x1b[3J  – erase scrollback buffer
    //   \x1b[?1049h/l – enter/exit alternate screen (switches away from the
    //                   normal buffer where the history lives)
    //
    // We intentionally allow \x1b[2J (erase viewport) and cursor-positioning
    // sequences so the new shell can correctly place its prompt without
    // creating a large blank gap below the replayed content.
    let filterStartupClears = !!savedScrollback;
    if (filterStartupClears) {
      setTimeout(() => {
        filterStartupClears = false;
      }, 3000);
    }

    // Push data from PTY to renderer
    session.onData((data) => {
      const filteredData = filterStartupClears
        ? data.replace(/\x1b\[(?:3J|\?1049[hl])/g, '')
        : data;

      const windows = BrowserWindow.getAllWindows();
      for (const win of windows) {
        win.webContents.send(IPC_CHANNELS.PTY_DATA, config.sessionId, filteredData);
      }
      // Schedule a debounced DB save so we survive hard crashes too
      scheduleSave(config.sessionId);
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
    // Flush any pending scrollback to DB before destroying the PTY session
    const raw = ptyManager.getRawScrollback(sessionId);
    if (raw) {
      try { sessionRepo.saveScrollback(sessionId, raw); } catch { /* ignore */ }
    }
    const pending = saveDebouncers.get(sessionId);
    if (pending) { clearTimeout(pending); saveDebouncers.delete(sessionId); }
    ptyManager.destroySession(sessionId);
  });

  ipcMain.handle(IPC_CHANNELS.PTY_GET_SCROLLBACK, (_event, sessionId: string) => {
    return sessionRepo.getScrollback(sessionId);
  });

  // Save scrollback for all active sessions before the app exits
  app.on('before-quit', () => {
    for (const sessionId of ptyManager.getAllSessionIds()) {
      const raw = ptyManager.getRawScrollback(sessionId);
      if (raw) {
        try {
          sessionRepo.saveScrollback(sessionId, raw);
        } catch {
          // Session may have been deleted; ignore
        }
      }
    }
  });
}

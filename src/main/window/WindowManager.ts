import { BrowserWindow, shell, app } from 'electron';
import { join } from 'path';

export class WindowManager {
  private mainWindow: BrowserWindow | null = null;

  createMainWindow(): BrowserWindow {
    const isDev = !app.isPackaged;

    const preloadPath = join(__dirname, '../preload/preload.js');
    console.log('[Termimate] Preload path:', preloadPath);

    this.mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 900,
      minHeight: 600,
      show: false,
      backgroundColor: '#131313',
      autoHideMenuBar: true,
      webPreferences: {
        preload: preloadPath,
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    this.mainWindow.on('ready-to-show', () => {
      this.mainWindow?.show();
    });

    // Open external links in system browser
    this.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });

    // Apply Content Security Policy only in production
    if (!isDev) {
      this.mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
        callback({
          responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': [
              "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data:",
            ],
          },
        });
      });
    }

    // Load the renderer
    if (isDev && process.env['ELECTRON_RENDERER_URL']) {
      console.log('[Termimate] Loading dev URL:', process.env['ELECTRON_RENDERER_URL']);
      this.mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
    } else {
      const filePath = join(__dirname, '../renderer/index.html');
      console.log('[Termimate] Loading file:', filePath);
      this.mainWindow.loadFile(filePath);
    }

    // Always open DevTools in dev
    if (isDev) {
      this.mainWindow.webContents.openDevTools();
    }

    return this.mainWindow;
  }

  getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }
}

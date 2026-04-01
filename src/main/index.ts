import { app, BrowserWindow } from 'electron';
import { WindowManager } from './window/WindowManager';
import { registerPtyHandlers } from './ipc/handlers/ptyHandlers';
import { registerProjectHandlers } from './ipc/handlers/projectHandlers';
import { registerConfigHandlers } from './ipc/handlers/configHandlers';
import { registerAgentHandlers } from './ipc/handlers/agentHandlers';
import { registerSessionHandlers } from './ipc/handlers/sessionHandlers';
import { registerMessageHandlers } from './ipc/handlers/messageHandlers';
import { DatabaseManager } from './database/DatabaseManager';

let windowManager: WindowManager;

async function bootstrap(): Promise<void> {
  // Initialize database
  DatabaseManager.getInstance().initialize();

  // Register all IPC handlers
  registerPtyHandlers();
  registerProjectHandlers();
  registerConfigHandlers();
  registerAgentHandlers();
  registerSessionHandlers();
  registerMessageHandlers();

  // Create the main window
  windowManager = new WindowManager();
  windowManager.createMainWindow();
}

app.whenReady().then(bootstrap);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    windowManager.createMainWindow();
  }
});

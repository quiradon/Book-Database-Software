import { app, BrowserWindow, shell } from 'electron';
import path from 'node:path';
import type { RunningServer } from './server/server';
import { startServer } from './server/server';

const DEFAULT_PORT = 5000;

let mainWindow: BrowserWindow | null = null;
let runningServer: RunningServer | null = null;
const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
}

function getProjectRoot(): string {
  return path.resolve(__dirname, '..');
}

function createWindow(serverUrl: string): void {
  if (mainWindow) {
    mainWindow.focus();
    return;
  }

  const appRoot = path.join(getProjectRoot(), 'app');

  mainWindow = new BrowserWindow({
    show: false,
    center: true,
    closable: true,
    minHeight: 720,
    minWidth: 960,
    title: 'Kraken Book DB',
    icon: path.join(appRoot, 'icon.png'),
    autoHideMenuBar: true,
    backgroundColor: '#1b1b25',
    webPreferences: {
      contextIsolation: true,
      preload: path.join(appRoot, 'preload.js'),
    },
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(serverUrl)) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(serverUrl)) {
      void shell.openExternal(url);
      return { action: 'deny' };
    }

    void mainWindow?.loadURL(url);
    return { action: 'deny' };
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.maximize();
    mainWindow?.show();
  });

  void mainWindow.loadURL(`${serverUrl}/`);
  mainWindow.focus();
}

app.on('second-instance', () => {
  if (!mainWindow) {
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();
});

if (hasSingleInstanceLock) {
  app.whenReady().then(async () => {
    const port = Number(process.env.KRAKEN_BOOK_PORT ?? DEFAULT_PORT);
    const serverUrl = `http://localhost:${port}`;

    runningServer = await startServer({
      port,
      projectRoot: getProjectRoot(),
      appRoot: path.join(getProjectRoot(), 'app'),
    });

    createWindow(serverUrl);
  });
}

app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', () => {
  void runningServer?.close();
});

import { app, BrowserWindow, shell } from 'electron';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const DEV_URL = process.env.VITE_DEV_SERVER_URL ?? 'http://localhost:5173';
const isDev = !app.isPackaged;

const createWindow = () => {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#0f1115',
    webPreferences: {
      preload: path.join(dirname, 'preload.cjs'),
      // Renderer is untrusted-by-default; it reaches the API over HTTP, not through Node.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // External links open in the real browser, never inside the app window.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    window.loadURL(DEV_URL);
  } else {
    window.loadFile(path.join(dirname, '../../web/dist/index.html'));
  }
};

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

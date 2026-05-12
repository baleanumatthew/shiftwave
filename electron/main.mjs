import { app, BrowserWindow, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..');

let mainWindow = null;

const resolveDevServerUrl = () => {
  const configuredUrl = String(process.env.VITE_DEV_SERVER_URL ?? '').trim();

  return configuredUrl || null;
};

const createWindow = async () => {
  mainWindow = new BrowserWindow({
    backgroundColor: '#080808',
    height: 900,
    minHeight: 720,
    minWidth: 1040,
    show: false,
    title: 'Shiftwave',
    width: 1440,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);

    return { action: 'deny' };
  });

  const devServerUrl = resolveDevServerUrl();

  if (devServerUrl) {
    await mainWindow.loadURL(devServerUrl);
    return;
  }

  await mainWindow.loadFile(path.join(appRoot, 'dist', 'index.html'));
};

app.whenReady()
  .then(createWindow)
  .catch((error) => {
    console.error(error);
    app.quit();
  });

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

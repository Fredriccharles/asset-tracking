const { app, BrowserWindow, Menu, dialog } = require('electron');
const path = require('path');

const isDev = process.env.NODE_ENV === 'development';

// Route the SQLite database + backups to Electron's per-user data directory
// so they persist across app updates/reinstalls and are never bundled
// inside the (read-only, per-install) application directory.
const userDataDir = app.getPath('userData');
process.env.APP_DATA_DIR = path.join(userDataDir, 'data');
process.env.DB_PATH = path.join(userDataDir, 'data', 'assets.db');
process.env.BACKUP_DIR = path.join(userDataDir, 'backups');

let mainWindow;
let apiPort;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1080,
    minHeight: 700,
    backgroundColor: '#f4f5f7',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  Menu.setApplicationMenu(null);

  const url = isDev
    ? 'http://127.0.0.1:5173'
    : `http://127.0.0.1:${apiPort}`;

  mainWindow.loadURL(url);
  mainWindow.once('ready-to-show', () => mainWindow.show());

  if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });
}

async function startBackend() {
  // In dev, the server is started separately via `npm run server:dev`.
  if (isDev) return;

  const { start, PORT } = require('../server/server');
  start();
  apiPort = PORT;
}

app.whenReady().then(async () => {
  try {
    await startBackend();
    createWindow();
  } catch (err) {
    dialog.showErrorBox('Startup Error', `The application failed to start:\n\n${err.message}`);
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

import { app, BrowserWindow, Menu } from 'electron';
import started from 'electron-squirrel-startup';
import path from 'node:path';
import { setupIpcHandlers } from './ipc-handlers';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// disable hardware acceleration to enable screen recording
app.disableHardwareAcceleration();

const baseHeight = 317;
const alertHeight = 52; // Height of the v-alert error
const isDev = !!MAIN_WINDOW_VITE_DEV_SERVER_URL;

let mainWindow;

const createWindow = async () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 500,
    height: baseHeight - (isDev ? 0 : 26),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
    title: 'Objection Recorder - objection.lol',
    resizable: false,
    maximizable: false,
    useContentSize: false,
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set application menu to null in production
  // Menu.setApplicationMenu(null);

  if (!isDev) {
    Menu.setApplicationMenu(null);
  }

  createWindow();

  // Setup all IPC handlers
  setupIpcHandlers(mainWindow, { baseHeight, alertHeight, isDev });

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

import { dialog, ipcMain } from 'electron';
import path from 'node:path';
import os from 'os';
import { checkAndPromptForAudio } from './audio';
import { createObjectionView, stopCurrentRecording } from './record-window';
import { loadSettings, saveSettings } from './settings-store';

let lastSaveDirectory = null;

/**
 * Sets up all IPC handlers for the main window
 * @param {BrowserWindow} mainWindow - The main application window
 * @param {Object} options - Configuration options
 * @param {number} options.baseHeight - Base window height
 * @param {number} options.alertHeight - Alert height for errors
 * @param {boolean} options.isDev - Whether app is running in development mode
 */
export function setupIpcHandlers(mainWindow, { baseHeight, alertHeight, isDev }) {
  // Add handler for showing error dialog
  ipcMain.on('show-error-dialog', (event, { title, message }) => {
    dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: title,
      message: message,
      buttons: ['OK'],
    });
  });

  // Add handler for adjusting window height
  ipcMain.on('adjust-window-height', (event, hasError) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    const currentSize = mainWindow.getSize();
    const newHeight = hasError ? baseHeight + alertHeight - (isDev ? 0 : 26) : baseHeight - (isDev ? 0 : 26);

    mainWindow.setContentSize(currentSize[0], newHeight, true);

    mainWindow.setBounds({
      width: currentSize[0],
      height: newHeight,
    });
  });

  // Set up IPC for showing save dialog
  ipcMain.handle('show-save-dialog', async () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultFilename = `objection-lol-recording-${timestamp}.mp4`;

    // Get platform-specific default videos directory
    let defaultVideosPath;

    if (process.platform === 'darwin') {
      defaultVideosPath = path.join(os.homedir(), 'Movies');
    } else {
      defaultVideosPath = path.join(os.homedir(), 'Videos');
    }

    const defaultPath = lastSaveDirectory
      ? path.join(lastSaveDirectory, defaultFilename)
      : path.join(defaultVideosPath, defaultFilename);

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Save Recording',
      defaultPath: defaultPath,
      filters: [
        { name: 'MP4 Videos', extensions: ['mp4'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (canceled || !filePath) {
      return null;
    }

    // Remember the directory for next time
    lastSaveDirectory = path.dirname(filePath);

    return filePath;
  });

  // Set up IPC for checking audio device
  ipcMain.handle('check-audio-device', async () => {
    const result = await checkAndPromptForAudio(mainWindow);
    return result;
  });

  // Set up IPC for loading specific recording
  ipcMain.on('load-objection-record', async (event, { id, fps, appendSeconds, outputPath, hasAudio }) => {
    createObjectionView(mainWindow, id, {
      fps,
      appendSeconds,
      outputPath,
      hasAudio,
    });
  });

  // Set up IPC for stopping recording
  ipcMain.on('stop-recording', async (event) => {
    try {
      const outputPath = await stopCurrentRecording();
      event.reply('recording-finished', outputPath);
    } catch (error) {
      event.reply('recording-failed', error.message);
    }
  });

  // Set up IPC for saving settings
  ipcMain.on('save-settings', async (event, settings) => {
    await saveSettings(settings);
  });

  // Set up IPC for loading settings
  ipcMain.handle('load-settings', async () => {
    return await loadSettings();
  });
}

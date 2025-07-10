import { BaseWindow, WebContentsView } from 'electron';
import fs from 'fs/promises';
import { finalizeRecording, startRecording, stopRecording } from './recording';
import { loadSettings } from './settings-store';
import { audioTrimDuration, getRecordingUrl } from './utils';

let recordWindow;
let view;
let mainWindowCloseListener;
let recordingParams = { fps: 30, appendSeconds: 0, outputPath: '', hasAudio: false, settings: null };
let stopRecordingTimeout;

/**
 * Creates a view to record an Objection.lol scene
 * @param {BaseWindow} mainWindow - The main application window
 * @param {string} objectionId - The ID of the objection to record
 * @param {Object} params - Recording parameters
 * @param {number} params.fps - Frames per second for recording
 * @param {number} params.appendSeconds - Additional seconds to record after completion
 * @param {string} params.outputPath - Path where the recording will be saved
 * @param {boolean} params.hasAudio - Whether audio is available
 */
export const createObjectionView = async (mainWindow, objectionId, params = {}) => {
  cleanupObjectionView();

  const settings = await loadSettings();

  recordingParams = {
    fps: params.fps || 30,
    appendSeconds: params.appendSeconds || 0,
    outputPath: params.outputPath || '',
    hasAudio: params.hasAudio || false,
  };

  if (!recordingParams.outputPath) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('recording-failed', 'No output path specified');
    }
    return;
  }

  // Create the recording window
  recordWindow = new BaseWindow({
    title: 'Objection Recorder',
    width: 800,
    height: 400,
    fullscreen: true,
    frame: false,
    autoHideMenuBar: true,
    resizable: false,
    maximizable: false,
    webPreferences: {
      backgroundThrottling: false,
    },
  });

  view = new WebContentsView();

  // Disable background throttling on the webContents
  view.webContents.setBackgroundThrottling(false);

  recordWindow.contentView.addChildView(view);

  // Add listener for recordWindow close
  recordWindow.on('closed', cleanupObjectionView);

  // Set up listener for main window close
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindowCloseListener = () => cleanupObjectionView();
    mainWindow.on('closed', mainWindowCloseListener);
  }

  view.webContents.on('console-message', async (_, __, message) => {
    if (message === 'LOADED') {
      try {
        const { width, height } = await measureRecordingElement(view.webContents);

        if (!width || !height) {
          throw new Error('Failed to get recording dimensions');
        }

        // Update main window UI to show recording in progress
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('recording-started');
        }

        const handleRecordingError = (error) => {
          cleanupObjectionView();

          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('recording-failed', error.message);
          }
        };

        await startRecording(
          recordWindow,
          width,
          height,
          recordingParams.fps,
          recordingParams.outputPath,
          recordingParams.hasAudio,
          handleRecordingError
        );

        await clickRecordingElement(view.webContents);
      } catch (error) {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('recording-failed', error.message);
        }

        cleanupObjectionView();

        console.error(error.message || 'Error during recording setup');
      }
    } else if (message === 'DONE') {
      if (!process.env.WAYLAND_DISPLAY.includes("wayland")) {
        stopRecordingTimeout = setTimeout(
          async () => {
            try {
              const temporaryFilePath = await stopRecording();

              cleanupObjectionView();

              if (temporaryFilePath) {
                // Add progress callback
                await finalizeRecording(
                  temporaryFilePath,
                  (progress) => {
                    if (mainWindow && !mainWindow.isDestroyed()) {
                      mainWindow.webContents.send('conversion-progress', progress);
                    }
                  },
                  audioTrimDuration
                );
              }

              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('recording-finished');
              }
            } catch (err) {
              console.error('Error stopping recording:', err);
            } finally {
              cleanupObjectionView();
            }
          },
          (recordingParams.appendSeconds + audioTrimDuration + 0.1) * 1000
        );

      } else {

      }
    }
  });

  // Get the appropriate URL based on settings
  const recordingUrl = getRecordingUrl(objectionId);
  const volumes = getVolumesParamsFromSettings(settings);

  // figure out why volumes not reflecting (just once it seems it works)
  view.webContents.loadURL(`${recordingUrl}${volumes ? `?v=${volumes}&width=1` : '?width=1'}`);

  const bounds = recordWindow.getBounds();

  view.setBounds({ x: 0, y: 0, width: bounds.width, height: bounds.height });
};

/**
 * Cleans up resources used by the objection view
 */
const cleanupObjectionView = () => {
  stopRecording().catch((err) => console.error('Error stopping recording:', err));

  if (stopRecordingTimeout) {
    clearTimeout(stopRecordingTimeout);

    stopRecordingTimeout = null;
  }

  // Remove main window close listener if it exists
  if (mainWindowCloseListener && recordWindow) {
    const mainWindow = !recordWindow.isDestroyed() ? recordWindow.getParentWindow() : undefined;

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.removeListener('closed', mainWindowCloseListener);
    }

    mainWindowCloseListener = null;
  }

  // Clean up view
  if (view) {
    view.webContents.close({ waitForBeforeUnload: false });

    if (typeof view.webContents.destroy === 'function' && view && !view.webContents.isDestroyed()) {
      view.webContents.destroy();
    }

    view = null;
  }

  // Clean up window
  if (recordWindow && !recordWindow.isDestroyed()) {
    recordWindow.destroy();
  }

  recordWindow = null;
};

/**
 * Measures the dimensions of the recording target element
 * @returns {Promise<{width: number, height: number}>} The dimensions of the element
 */
const measureRecordingElement = async (webContents) => {
  return webContents.executeJavaScript(`
    (function() {
      const element = document.getElementById('recording_target') || document.querySelector('.court-container');
      if (element) {
        const rect = element.getBoundingClientRect();
        
        // Helper function to round values that are very close to integers
        const smartRound = (value) => {
          // If the value is within 0.1 of an integer, round it
          const diff = Math.abs(value - Math.round(value));
          return diff < 0.1 ? Math.round(value) : value;
        };
        
        return { 
          width: smartRound(rect.width), 
          height: smartRound(rect.height) 
        };
      }
      return { width: 0, height: 0 };
    })();
  `);
};

const clickRecordingElement = async (webContents) => {
  const elementPosition = await webContents.executeJavaScript(`
    (function() {
      const element = document.getElementById('recording_target') || document.querySelector('.court-container');
      if (element) {
        const rect = element.getBoundingClientRect();
        return { 
          x: rect.left + (rect.width / 2),
          y: rect.top + (rect.height / 2)
        };
      }
      return null;
    })();
  `);

  if (elementPosition) {
    webContents.sendInputEvent({
      type: 'mouseDown',
      x: Math.floor(elementPosition.x),
      y: Math.floor(elementPosition.y),
      button: 'left',
      clickCount: 1,
    });

    await new Promise((resolve) => setTimeout(resolve, 3));

    webContents.sendInputEvent({
      type: 'mouseUp',
      x: Math.floor(elementPosition.x),
      y: Math.floor(elementPosition.y),
      button: 'left',
      clickCount: 1,
    });
  }
};

/**
 * Manually stops the current recording
 */
export const stopCurrentRecording = async () => {
  const result = await stopRecording();

  // When manually stopping, don't convert the video - user is cancelling
  if (result) {
    try {
      await fs.unlink(result).catch((err) => console.error('Error deleting temp file:', err));

      // Notify main window that recording was cancelled
      const mainWindow = recordWindow && !recordWindow.isDestroyed() ? recordWindow.getParentWindow() : undefined;

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('recording-cancelled');
      }
    } catch (error) {
      console.error('Error cleaning up after cancelled recording:', error);
    }
  }

  cleanupObjectionView();

  return null; // Return null to indicate no final file was created
};

const getVolumesParamsFromSettings = (settings) => {
  if (!settings) {
    return null;
  }

  const { master, music, sound, blip } = settings.volumes;

  return [master, music, sound, blip].join(',').trim();
};

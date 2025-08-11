import { spawn } from 'child_process';
import { dialog, shell } from 'electron';
import os from 'os';
import { ffmpegPath } from './ffmpeg.js';

// Platform-specific audio device configurations
const audioConfig = {
  win32: {
    deviceName: 'virtual-audio-capturer',
    inputFormat: 'dshow',
    downloadUrl: 'https://github.com/rdp/screen-capture-recorder-to-video-windows-free/releases',
    instructionText: 'To record with audio on Windows, you need to install Virtual Audio Cable.',
  },
  darwin: {
    deviceName: 'BlackHole',
    inputFormat: 'avfoundation',
    downloadUrl: 'https://existential.audio/blackhole/',
    instructionText: 'To record with audio on macOS, you need to install BlackHole audio driver.',
  },
  linux: {
    deviceName: 'pulse',
    inputFormat: 'pulse',
    downloadUrl: '',
    instructionText:
      'Audio recording should work with PulseAudio. If not working, ensure PulseAudio is properly configured.',
  },
};

/**
 * Get current platform configuration
 * @returns {Object} The audio configuration for the current platform
 */
export const getPlatformAudioConfig = () => {
  const platform = os.platform();
  return audioConfig[platform] || audioConfig.win32; // Default to Windows config if platform not recognized
};

/**
 * Checks for platform-appropriate audio device and prompts user if not found
 * @param {Electron.BrowserWindow} parentWindow - The parent window for dialog
 * @returns {Promise<{proceed: boolean, audioAvailable: boolean}>} Whether to proceed and if audio is available
 */
export const checkAndPromptForAudio = async (parentWindow) => {
  const audioAvailable = await checkIfAudioDeviceExists();

  if (!audioAvailable) {
    const response = await showAudioCapturerDialog(parentWindow);

    if (response === 0) {
      // Download
      const { downloadUrl } = getPlatformAudioConfig();
      if (downloadUrl) {
        shell.openExternal(downloadUrl);
      }
      return { proceed: false, audioAvailable: false };
    } else if (response === 2) {
      // Cancel
      return { proceed: false, audioAvailable: false };
    }
    // If response === 1 (Skip), continue without audio
    return { proceed: true, audioAvailable: false };
  }

  return { proceed: true, audioAvailable: true };
};

/**
 * Checks if the appropriate audio device exists for the current platform
 * @returns {Promise<boolean>} Whether the audio device exists
 */
export const checkIfAudioDeviceExists = async () => {
  const platform = os.platform();

  // On Linux, we assume PulseAudio is available by default
  if (platform === 'linux') {
    try {
      // Check if pulseaudio is installed
      const pulseCheck = spawn('pactl', ['info']);
      return new Promise((resolve) => {
        pulseCheck.on('close', (code) => {
          resolve(code === 0);
        });
      });
    } catch (error) {
      console.error('Error checking for PulseAudio:', error);
      return false;
    }
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.error(`Timeout checking for audio device`);

      resolve(false);
    }, 5000); // 5 seconds timeout

    const handleCompletion = (result) => {
      clearTimeout(timeout);
      resolve(result);
    };

    let deviceFound = false;
    let args = [];
    const { deviceName, inputFormat } = getPlatformAudioConfig();

    if (platform === 'win32') {
      args = ['-list_devices', 'true', '-f', 'dshow', '-i', 'dummy'];
    } else if (platform === 'darwin') {
      args = ['-f', 'avfoundation', '-list_devices', 'true', '-i', 'dummy'];
    } else {
      console.error(`Unsupported OS ${platform}, assuming audio device is unavailable`);
      handleCompletion(false);
      return;
    }

    try {
      const ffmpegProc = spawn(ffmpegPath, args);

      ffmpegProc.stderr.on('data', (data) => {
        const output = data.toString();
        if (output.includes(deviceName)) {
          deviceFound = true;
        }
      });

      ffmpegProc.on('close', (code) => {
        handleCompletion(deviceFound);
      });

      ffmpegProc.on('error', (err) => {
        console.error('Error spawning ffmpeg process:', err);
        handleCompletion(false);
      });
    } catch (error) {
      console.error('Exception when spawning ffmpeg process:', error);
      handleCompletion(false);
    }
  });
};

/**
 * Shows a dialog prompting the user to download the appropriate audio device
 * @param {Electron.BrowserWindow} parentWindow - The parent window for the dialog
 * @returns {Promise<number>} - 0 for Download, 1 for Skip, 2 for Cancel
 */
const showAudioCapturerDialog = async (parentWindow) => {
  const { instructionText, deviceName } = getPlatformAudioConfig();
  const platform = os.platform();

  // For Linux, just show a different message
  const message = platform === 'linux' ? 'Audio Capture Not Available' : `${deviceName} Not Found`;

  const detail =
    platform === 'linux'
      ? 'PulseAudio configuration issue detected. Please ensure your PulseAudio setup is configured correctly.'
      : instructionText + ' Would you like to download it now?';

  const buttons =
    platform === 'linux'
      ? ['Skip (Record without audio)', 'Cancel']
      : ['Download', 'Skip (Record without audio)', 'Cancel'];

  const { response } = await dialog.showMessageBox(parentWindow, {
    type: 'question',
    title: 'Audio Capturer Not Found',
    message,
    detail,
    buttons,
    defaultId: 0,
    cancelId: platform === 'linux' ? 1 : 2,
  });

  // For Linux, adjust response values since we have fewer buttons
  return platform === 'linux' ? (response === 0 ? 1 : 2) : response;
};

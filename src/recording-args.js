import os from 'os';
import { getPlatformAudioConfig } from './audio.js';

/**
 * Platform-specific video capture configurations
 */
const videoConfig = {
  win32: {
    inputFormat: 'gdigrab',
    inputOption: 'title',
  },
  darwin: {
    inputFormat: 'avfoundation',
    inputOption: 'crop',
  },
  linux: {
    inputFormat: 'x11grab',
    inputOption: 'region',
  },
};

/**
 * Get the current platform's video capture configuration
 * @returns {Object} The video configuration for the current platform
 */
export const getPlatformVideoConfig = () => {
  const platform = os.platform();
  return videoConfig[platform] || videoConfig.win32; // Default to Windows if platform not recognized
};

/**
 * Ensure dimensions are even integers for FFmpeg compatibility with libx264
 * @param {number} value - The dimension value to sanitize
 * @returns {number} Even integer dimension value
 */
const ensureCompatibleDimension = (value) => {
  // First floor to get an integer, then make it even by rounding down to nearest even number
  const intValue = Math.floor(value);
  return intValue % 2 === 0 ? intValue : intValue - 1;
};

/**
 * Generate platform-specific FFmpeg arguments for video capture
 * @param {Electron.BrowserWindow} recordWindow - The window to record
 * @param {number} width - Width of the recording area
 * @param {number} height - Height of the recording area
 * @param {number} framesPerSecond - Frames per second for recording
 * @returns {Array} Array of FFmpeg arguments for video capture
 */
export const getVideoInputArgs = (recordWindow, width, height, framesPerSecond) => {
  const platform = os.platform();
  const config = getPlatformVideoConfig();
  const args = ['-f', config.inputFormat];

  // Get the window's position and bounds for precise capturing
  const bounds = recordWindow.getBounds();

  // Ensure all dimensions are even integers to avoid FFmpeg compatibility issues
  const intWidth = ensureCompatibleDimension(width);
  const intHeight = ensureCompatibleDimension(height);
  const intX = ensureCompatibleDimension(bounds.x);
  const intY = ensureCompatibleDimension(bounds.y);

  switch (platform) {
    case 'win32':
      // Windows uses GDI capture with window title for precise window targeting
      args.push(
        '-video_size',
        `${intWidth}x${intHeight}`,
        '-framerate',
        `${framesPerSecond}`,
        '-draw_mouse',
        '0',
        '-i',
        `title=${recordWindow.getTitle()}`
      );
      break;

    case 'darwin':
      // macOS: Use screen capture with precise cropping to window dimensions
      // Format: "desktop:0" captures the main screen
      args.push(
        '-i',
        'desktop:0',
        '-framerate',
        `${framesPerSecond}`,
        '-video_size',
        `${intWidth}x${intHeight}`,
        // Use the crop filter to specify the exact window bounds
        '-filter:v',
        `crop=${intWidth}:${intHeight}:${intX}:${intY}`,
        '-draw_mouse',
        '0'
      );
      break;

    case 'linux':
      // Linux: Use X11grab with precise coordinates for the specific window
      // Format: ":0.0+x,y" specifies display and exact coordinates
      args.push(
        '-video_size',
        `${intWidth}x${intHeight}`,
        '-framerate',
        `${framesPerSecond}`,
        '-draw_mouse',
        '0',
        '-i',
        `:0.0+${intX},${intY}`
      );
      break;

    default:
      // Fallback to Windows-style capture
      args.push(
        '-video_size',
        `${intWidth}x${intHeight}`,
        '-framerate',
        `${framesPerSecond}`,
        '-draw_mouse',
        '0',
        '-i',
        `title=${recordWindow.getTitle()}`
      );
  }

  return args;
};

/**
 * Generate audio input arguments for FFmpeg
 * @param {boolean} hasAudio - Whether audio should be recorded
 * @returns {Array} Array of FFmpeg arguments for audio input
 */
export const getAudioInputArgs = (hasAudio) => {
  if (!hasAudio) {
    return [];
  }

  const { deviceName, inputFormat } = getPlatformAudioConfig();

  return ['-f', inputFormat, '-i', `audio=${deviceName}`];
};

/**
 * Generate audio encoding arguments for FFmpeg
 * @param {boolean} hasAudio - Whether audio should be encoded
 * @returns {Array} Array of FFmpeg arguments for audio encoding
 */
export const getAudioEncodingArgs = (hasAudio) => {
  if (!hasAudio) {
    return [];
  }

  return ['-b:a', '256k'];
};

/**
 * Generate common FFmpeg video encoding arguments
 * @returns {Array} Array of FFmpeg arguments for video encoding
 */
export const getVideoEncodingArgs = () => {
  return ['-vcodec', 'libx264', '-preset', 'ultrafast', '-vsync', '0', '-crf', '0', '-pix_fmt', 'yuv420p'];
};

/**
 * Generate complete FFmpeg arguments for recording
 * @param {Electron.BrowserWindow} recordWindow - The window to record
 * @param {number} width - Width of the recording area
 * @param {number} height - Height of the recording area
 * @param {number} fps - Frames per second for recording
 * @param {string} outputPath - Path where the recording will be saved
 * @param {boolean} hasAudio - Whether audio should be recorded
 * @returns {Array} Array of all FFmpeg arguments needed for recording
 */
export const getRecordingArgs = (recordWindow, width, height, fps, outputPath, hasAudio) => {
  const framesPerSecond = fps || 30;
  const args = [];

  // 1. Add audio input if enabled
  args.push(...getAudioInputArgs(hasAudio));

  // 2. Add video input with platform-specific arguments
  args.push(...getVideoInputArgs(recordWindow, width, height, framesPerSecond));

  // 3. Add common video encoding arguments
  args.push(...getVideoEncodingArgs());

  // 4. Add audio encoding settings if enabled
  args.push(...getAudioEncodingArgs(hasAudio));

  // 5. Add output file
  args.push('-y', outputPath);

  return args;
};

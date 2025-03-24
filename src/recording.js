import { spawn } from 'child_process';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs/promises';
import path from 'path';
import { ffmpegPath } from './ffmpeg.js';
import { getRecordingArgs } from './recording-args.js';

let recording = null;
let outputPath = '';
let tempOutputPath = '';
let ffmpegProcess = null;

ffmpeg.prototype.killGracefully = function () {
  if (this.ffmpegProc) {
    this.ffmpegProc.stdin.write('q\n');
    this.ffmpegProc.stdin.end();
  } else {
    console.error('FFmpeg process not started yet.');
  }
};

/**
 * Starts recording the Electron window
 * @param {Electron.BrowserWindow} recordWindow - The window to record
 * @param {number} width - Width of the recording area
 * @param {number} height - Height of the recording area
 * @param {number} fps - Frames per second for recording
 * @param {string} filePath - Path where the recording will be saved
 * @param {boolean} hasAudio - Whether audio should be recorded
 * @param {Function} onError - Error callback (optional)
 * @returns {Promise<string>} - Path to the output file when recording has started
 */
export const startRecording = async (recordWindow, width, height, fps, filePath, hasAudio, onError) => {
  if (recording) {
    return null;
  }

  if (!recordWindow || recordWindow.isDestroyed()) {
    throw new Error('No record window available');
  }

  if (!filePath) {
    throw new Error('No output path specified');
  }

  return new Promise(async (resolve, reject) => {
    try {
      outputPath = filePath;
      // Create a temporary file for the lossless capture
      tempOutputPath = path.join(path.dirname(outputPath), `temp_${path.basename(outputPath)}`);

      const dirPath = path.dirname(outputPath);

      await fs.mkdir(dirPath, { recursive: true });

      // Get all FFmpeg arguments from the recording-args module
      const ffmpegArgs = getRecordingArgs(recordWindow, width, height, fps, tempOutputPath, hasAudio);

      // Spawn FFmpeg process
      ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);

      recording = {};

      let stderr = '';

      ffmpegProcess.stderr.on('data', (data) => {
        const chunk = data.toString();
        stderr += chunk;
      });

      ffmpegProcess.on('error', (err) => {
        recording = null;
        ffmpegProcess = null;

        console.error('Recording error:', err);

        if (onError) onError(err);

        reject(err);
      });

      ffmpegProcess.on('exit', (code, signal) => {
        recording = null;
        ffmpegProcess = null;

        if (code !== 0) {
          const error = new Error(`FFmpeg exited with code ${code} (${signal}): ${stderr}`);

          console.error(error.message);

          onError?.(error);
        }
      });

      // Define a method to gracefully kill the process
      recording.killGracefully = function () {
        if (ffmpegProcess) {
          ffmpegProcess.stdin.write('q\n');
          ffmpegProcess.stdin.end();
        } else {
          console.error('FFmpeg process not started yet.');
        }
      };

      // Wait a bit to ensure recording has started
      setTimeout(() => resolve(outputPath), 150);
    } catch (error) {
      recording = null;

      if (onError) onError(error);

      reject(new Error(`Failed to start recording: ${error.message}`));
    }
  });
};

/**
 * Converts the high-quality recording to a smaller file size
 * @param {string} inputPath - Path to the high-quality recording
 * @param {string} outputPath - Path for the converted file
 * @param {Function} onProgress - Callback for progress updates
 * @param {number} cutDuration - Duration to cut from the end of the video
 * @returns {Promise<string>} - Path to the converted file
 */
const convertRecording = async (inputPath, outputPath, onProgress, cutDuration) => {
  return new Promise((resolve, reject) => {
    if (onProgress) {
      onProgress(0);
    }

    // First get the duration of the video
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) {
        console.error('Error getting video duration:', err);
        return reject(err);
      }

      const duration = metadata.format.duration;

      if (!duration) {
        console.error('Could not determine video duration');
        return reject(new Error('Could not determine video duration'));
      }

      const trimmedDuration = Math.max(0, duration - cutDuration);

      ffmpeg(inputPath)
        .videoCodec('libx264')
        .outputOptions(['-preset veryfast', '-crf 18', `-t ${trimmedDuration}`])
        .output(outputPath)
        .on('start', (cmd) => {
          // console.log('FFmpeg conversion command:', cmd);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            const currentProgress = Math.round(progress.percent);

            if (onProgress) {
              onProgress(currentProgress);
            }
          }
        })
        .on('error', (err) => {
          console.error('Conversion error:', err);
          reject(err);
        })
        .on('end', async () => {
          if (onProgress) {
            onProgress(100);
          }

          try {
            await fs.unlink(inputPath);
            resolve(outputPath);
          } catch (err) {
            console.error('Failed to delete temporary file:', err);
            resolve(outputPath);
          }
        })
        .run();
    });
  });
};

/**
 * Stops the current recording without conversion
 * @returns {Promise<string|null>} Path to the temporary recording file or null if failed
 */
export const stopRecording = async () => {
  if (!recording) {
    return null;
  }

  return new Promise((resolve) => {
    if (ffmpegProcess) {
      ffmpegProcess.on('exit', () => {
        resolve(tempOutputPath);
      });

      recording.killGracefully();
    } else {
      resolve(null);
    }
  });
};

/**
 * Finalizes the recording by converting it to a smaller file size
 * @param {string} tempFilePath - Path to the temporary high-quality recording
 * @param {Function} onProgress - Callback for progress updates
 * @param {number} cutDuration - Duration to cut from the end of the video
 * @returns {Promise<string>} Path to the final recording file
 */
export const finalizeRecording = async (tempFilePath = tempOutputPath, onProgress, cutDuration) => {
  if (!tempFilePath || !outputPath) {
    throw new Error('No temporary recording file or output path available');
  }

  try {
    // Check if the temporary file exists
    await fs.access(tempFilePath);

    // Convert the recording
    return await convertRecording(tempFilePath, outputPath, onProgress, cutDuration);
  } catch (error) {
    console.error('Failed to finalize recording:', error);
    throw new Error(`Failed to finalize recording: ${error.message}`);
  }
};

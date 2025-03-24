import { setFfmpegPath } from 'fluent-ffmpeg';
import path from 'path';

let ffmpegPath;

if (process.env.NODE_ENV === 'development') {
  // In development, use ffmpeg-static but handle the asar unpacking
  ffmpegPath = require('ffmpeg-static').replace('app.asar', 'app.asar.unpacked');
} else {
  // In production, use the bundled ffmpeg binary with platform-specific path
  const platform = process.platform;
  const resourcesPath = './resources';

  if (platform === 'win32') {
    ffmpegPath = path.join(resourcesPath, 'ffmpeg.exe');
  } else {
    ffmpegPath = path.join(resourcesPath, 'ffmpeg');
  }
}

setFfmpegPath(ffmpegPath);

export { ffmpegPath };

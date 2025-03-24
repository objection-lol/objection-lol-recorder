/**
 * Type definitions for Electron API
 */
interface ElectronAPI {
  showSaveDialog: () => Promise<string>;
  loadObjectionRecord: (options: {
    id: number;
    fps: number;
    appendSeconds: number;
    outputPath: string;
    hasAudio: boolean;
  }) => void;
  stopRecording: () => void;
  onRecordingStarted: (callback: () => void) => void;
  onRecordingFinished: (callback: () => void) => void;
  onRecordingFailed: (callback: (message: string) => void) => void;
  // Added missing handlers
  checkAudioDevice: () => Promise<boolean>;
  showErrorDialog: (options: { title: string; message: string }) => void;
  adjustWindowHeight: (hasError: boolean) => void;
  saveSettings: (settings: any) => void;
  loadSettings: () => Promise<any>;
}

interface Window {
  electronAPI?: ElectronAPI;
}

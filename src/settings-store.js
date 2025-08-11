import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';

// Default settings
const defaultSettings = {
  volumes: {
    master: 100,
    music: 75,
    sound: 75,
    blip: 22,
  },
  fps: 30,
  appendSeconds: 0,
};

// Path to the settings file in the app directory
let settingsPath;

// Initialize the settings path based on the app directory
const initSettingsPath = () => {
  const userDataPath = app.getPath("userData");

  settingsPath = path.join(userDataPath, 'settings.json');
};

/**
 * Loads settings from disk
 * @returns {Promise<Object>} The loaded settings
 */
export const loadSettings = async () => {
  if (!settingsPath) initSettingsPath();

  try {
    const data = await fs.readFile(settingsPath, 'utf8');

    return { ...defaultSettings, ...JSON.parse(data) };
  } catch (error) {
    return { ...defaultSettings };
  }
};

/**
 * Saves settings to disk
 * @param {Object} settings - The settings to save
 * @returns {Promise<boolean>} Whether the save was successful
 */
export const saveSettings = async (settings) => {
  if (!settingsPath) initSettingsPath();

  try {
    const existingSettings = await loadSettings();
    const mergedSettings = { ...existingSettings, ...settings };

    await fs.writeFile(settingsPath, JSON.stringify(mergedSettings, null, 2));

    return true;
  } catch (error) {
    console.error('Failed to save settings:', error);

    return false;
  }
};

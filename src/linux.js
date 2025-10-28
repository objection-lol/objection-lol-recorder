import dbus from '@jellybrick/dbus-next';
import crypto from 'crypto';
import { spawn, exec, execSync } from 'child_process';
import path from 'path';
import { app, BrowserWindow, ipcMain } from 'electron';

const util = require('util');
const Variant = dbus.Variant;

async function setupScreenCast() {
  const bus = dbus.sessionBus();
  const castProxy = await bus.getProxyObject('org.freedesktop.portal.Desktop', '/org/freedesktop/portal/desktop');
  const screenCast = castProxy.getInterface('org.freedesktop.portal.ScreenCast');
  const sender = bus.name.replace(/[^A-Za-z0-9_]/g, '_').substring(1);
  const requestHandleToken = crypto.randomUUID().replace(/-/g, '');
  const sessionHandleToken = crypto.randomUUID().replace(/-/g, '');
  const requestHandle = `/org/freedesktop/portal/desktop/request/${sender}/${requestHandleToken}`;
  let sessionHandle;

  let response = new Map();
  bus.on('message', (message) => {
    if (
      message.interface === 'org.freedesktop.portal.Request' &&
      message.member === 'Response' &&
      message.path === requestHandle
    ) {
      response.get(requestHandleToken).resolve(message.body);
      response.delete(requestHandleToken);
    }
  });

  let responseBody = new Promise((resolve, reject) => {
    response.set(requestHandleToken, { resolve });
  });
  await createScreenCastSession(screenCast, sessionHandleToken, requestHandleToken);
  sessionHandle = (await responseBody)[1].session_handle.value;

  await selectSource(screenCast, sessionHandle);
  responseBody = new Promise((resolve, reject) => {
    response.set(requestHandleToken, { resolve });
  });
  startScreenCast(screenCast, sessionHandle, requestHandleToken);
  return (await responseBody)[1].streams.value[0][0];
}

async function createScreenCastSession(cast, sessionToken, requestToken) {
  await cast.CreateSession({
    handle_token: new Variant('s', requestToken),
    session_handle_token: new Variant('s', sessionToken),
  });
}

async function selectSource(cast, sessionHandle) {
  const requestToken = crypto.randomUUID().replace(/-/g, '');
  await cast.SelectSources(sessionHandle, {
    handle_token: new Variant('s', requestToken),
    persist_mode: new Variant('u', 1),
    multiple: new Variant('b', false),
    types: new Variant('u', 2),
  });
}

async function startScreenCast(cast, sessionHandle, requestToken) {
  await cast.Start(sessionHandle, '', {
    handle_token: new Variant('s', requestToken),
  });
}

let recorder = {
  recorderProcess: null,
  progressWindow: null,
  linuxDisplay: null,
};

function createProgressWindow() {
  recorder.progressWindow = new BrowserWindow({
    width: 800,
    height: 400,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  const progressPage = `
    <!DOCTYPE html>
    <html>
    <body style="margin:0">
      <pre id="out"></pre>
    <script>
      const { ipcRenderer } = require('electron');
      ipcRenderer.on('stdout-chunk', (_, chunk) => {
        const pre = document.getElementById('out');
        pre.innerText += chunk;
        pre.scrollTop = pre.scrollHeight;
      });
    </script>
    </body>
    </html>`;

  recorder.progressWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(progressPage));
}

export async function startNodeRecording(width, height, fps, filePath) {
  const basePath = !app.isPackaged ? app.getAppPath() : path.join(process.resourcesPath, 'app.asar.unpacked');
  switch (process.env.XDG_SESSION_TYPE) {
    case 'wayland':
      recorder.linuxDisplay = 'wayland';
      const pipeNode = await setupScreenCast();
      const wScriptPath = path.join(basePath, 'src', 'scripts', 'waylandrecorder');
      recorder.recorderProcess = spawn('bash', [wScriptPath, pipeNode, width, height, filePath, fps]);
      return;
      break;

    case 'x11':
      recorder.linuxDisplay = 'x11';

      const childEnv = {
        ...process.env,
        DISPLAY: process.env.DISPLAY || ':0',
        XAUTHORITY: process.env.XAUTHORITY || path.join(require('os').homedir(), '.Xauthority'),
      };

      const windowId = execSync('xdotool selectwindow', { encoding: 'utf8', env: childEnv });
      const xScriptPath = path.join(basePath, 'src', 'scripts', 'xorgrecorder');
      recorder.recorderProcess = spawn('bash', ['-l', xScriptPath, windowId.trim(), width, height, filePath, fps], {
        env: childEnv,
      });
      createProgressWindow();

      new Promise((resolve) => {
        recorder.recorderProcess.stdout.on('data', (data) => {
          recorder.progressWindow.webContents.send('stdout-chunk', data.toString());
        });

        recorder.recorderProcess.stderr.on('data', (data) => {
          recorder.progressWindow.webContents.send('stdout-chunk', data.toString());
        });
        recorder.recorderProcess.on('close', resolve);
      });
      // There is a small discrepancy between the bash script's start and the
      // objection being played. This buys enough time for the script to start
      // recording
      await new Promise((r) => setTimeout(r, 1000));
      break;
    default:
      break;
  }
}

export async function stopNodeRecording() {
  recorder.recorderProcess.kill('SIGINT');
}

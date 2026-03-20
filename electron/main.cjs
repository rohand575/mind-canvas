const { app, BrowserWindow, globalShortcut, Tray, Menu, nativeImage } = require('electron');
const path = require('path');

// Handle single instance lock - prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

let mainWindow = null;
let tray = null;
let isQuitting = false;

// Determine if running in dev or production
const isDev = !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'MindCanvas',
    icon: path.join(__dirname, '..', 'public', 'icon.png'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Minimize to tray instead of closing
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  // Create a simple 16x16 tray icon
  let trayIcon;
  const iconPath = path.join(__dirname, '..', 'public', 'icon.png');
  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    if (trayIcon.isEmpty()) {
      trayIcon = createDefaultIcon();
    }
  } catch {
    trayIcon = createDefaultIcon();
  }

  tray = new Tray(trayIcon.resize({ width: 16, height: 16 }));
  tray.setToolTip('MindCanvas - Ctrl+Shift+D to toggle');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show MindCanvas',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function createDefaultIcon() {
  // Create a simple colored icon programmatically
  const size = 32;
  const canvas = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAABhSURBVFhH7c4xDQAgDATRGxZwg39sYIEFHBAIBjrpm+af/LJpU1XnzPx1zq7W2sXMeO89M6O19t97x8ycc87MaK1drTXMjN77NTNiZpxzzsyI1trlvWNmxMw453wzM/4HMx8rThqPl/oJHQAAAABJRU5ErkJggg==`;
  return nativeImage.createFromDataURL(canvas);
}

function registerGlobalHotkey() {
  globalShortcut.register('Ctrl+Shift+D', () => {
    if (!mainWindow) {
      createWindow();
      return;
    }

    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function setupAutoStart() {
  if (!isDev) {
    app.setLoginItemSettings({
      openAtLogin: true,
      openAsHidden: true,
      args: ['--hidden'],
    });
  }
}

// Second instance handling - focus existing window
app.on('second-instance', () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  // Check if launched with --hidden flag (auto-start)
  const startHidden = process.argv.includes('--hidden');

  createTray();
  registerGlobalHotkey();
  setupAutoStart();

  if (!startHidden) {
    createWindow();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  // Don't quit on window close - keep running in tray
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

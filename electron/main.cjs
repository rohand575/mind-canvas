const { app, BrowserWindow, globalShortcut, Tray, Menu, nativeImage, shell } = require('electron');
const path = require('path');

let mainWindow = null;
let tray = null;

const GLOBAL_SHORTCUT = 'Ctrl+Alt+C';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    show: false,
    frame: true,
    titleBarStyle: 'default',
    backgroundColor: '#1a1a2e',
    icon: path.join(__dirname, '..', 'public', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  const indexPath = path.join(__dirname, '..', 'dist', 'index.html');

  // ── Security: window/navigation hardening ───────────────────────
  // Never create new Electron windows for renderer window.open() calls.
  // External http(s) links open in the system browser instead.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Lock the main frame to the bundled app — block all top-level
  // navigation away from dist/index.html (drag-dropped links, redirects).
  mainWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault();
  });

  mainWindow.loadFile(indexPath);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  const iconPath = path.join(__dirname, '..', 'public', 'icon.png');
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon.resize({ width: 16, height: 16 }));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: `Show Canvas  (${GLOBAL_SHORTCUT})`,
      click: () => showWindow(),
    },
    { type: 'separator' },
    {
      label: 'Quit Canvas',
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip('Canvas — Mind Canvas');
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => showWindow());
}

function showWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function toggleWindow() {
  if (!mainWindow) return;
  if (mainWindow.isVisible() && mainWindow.isFocused()) {
    mainWindow.hide();
  } else {
    showWindow();
  }
}

app.whenReady().then(() => {
  createWindow();
  createTray();

  const registered = globalShortcut.register(GLOBAL_SHORTCUT, toggleWindow);
  if (!registered) {
    console.warn(`Global shortcut ${GLOBAL_SHORTCUT} could not be registered (already in use).`);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else showWindow();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

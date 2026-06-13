const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const http = require('http');
const https = require('https');

let mainWindow;
let tray;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 800,
    minHeight: 600,
    title: 'MTA Server Manager',
    backgroundColor: '#030712',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    frame: false,          // Custom titlebar
    titleBarStyle: 'hidden',
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ─── Tray (system tray icon) ─────────────────────────────────────────────────
function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'icon.png'));
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  const menu = Menu.buildFromTemplate([
    { label: 'MTA Manager', enabled: false },
    { type: 'separator' },
    { label: 'Відкрити', click: () => mainWindow?.show() },
    { label: 'Згорнути', click: () => mainWindow?.hide() },
    { type: 'separator' },
    { label: 'Вийти', role: 'quit' },
  ]);
  tray.setToolTip('MTA Server Manager');
  tray.setContextMenu(menu);
  tray.on('click', () => { mainWindow?.isVisible() ? mainWindow.hide() : mainWindow?.show(); });
}

// ─── IPC: HTTP proxy для запитів до MTA API ──────────────────────────────────
ipcMain.handle('api-request', async (event, { url, method, headers, body }) => {
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    const parsed = new URL(url);

    const options = {
      hostname: parsed.hostname,
      port:     parsed.port || (url.startsWith('https') ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method:   method || 'GET',
      headers:  { 'Content-Type': 'application/json', ...headers },
      timeout:  5000,
    };

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve({ ok: true, status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ ok: true, status: res.statusCode, data }); }
      });
    });

    req.on('error', (e) => resolve({ ok: false, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'Connection timeout' }); });

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
});

// ─── IPC: window controls ────────────────────────────────────────────────────
ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on('window-close', () => mainWindow?.hide());

// ─── App lifecycle ───────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
  createTray();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

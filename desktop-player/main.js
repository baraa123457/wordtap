const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// Completely disable the default Electron application menu (File, Edit, View, Window, Help)
Menu.setApplicationMenu(null);

let mainWindow = null;

// Determine path for saved words
const DATA_DIR = path.join(app.getPath('userData'), 'WordTapPlayer');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const SAVED_WORDS_FILE = path.join(DATA_DIR, 'saved_words.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

function readJsonFile(filePath, defaultValue) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
  }
  return defaultValue;
}

function writeJsonFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
    return false;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 840,
    minHeight: 560,
    backgroundColor: '#0c0e14',
    title: 'WordTap Video Player',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false, // Allows streaming local video files and local subtitles seamlessly
      sandbox: false
    }
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.setAutoHideMenuBar(true);

  // Send fullscreen state changes to renderer
  mainWindow.on('enter-full-screen', () => {
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('window:fullscreen-change', true);
    }
  });

  mainWindow.on('leave-full-screen', () => {
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('window:fullscreen-change', false);
    }
  });

  mainWindow.loadFile('index.html');

  // Handle window close
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC: Open Video File Dialog
ipcMain.handle('dialog:open-video', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Video File',
    properties: ['openFile'],
    filters: [
      { name: 'Video Files', extensions: ['mp4', 'mkv', 'webm', 'mov', 'avi', 'm4v'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (result.canceled || result.filePaths.length === 0) return null;
  const filePath = result.filePaths[0];

  // Auto-check for adjacent subtitle file with same base name
  const subFile = findAdjacentSubtitle(filePath);
  let subContent = null;
  if (subFile) {
    try {
      subContent = fs.readFileSync(subFile, 'utf-8');
    } catch {}
  }

  return {
    filePath,
    fileName: path.basename(filePath),
    fileUrl: `file://${filePath.replace(/\\/g, '/')}`,
    subFile,
    subContent
  };
});

// Helper: Check for adjacent subtitle files
function findAdjacentSubtitle(videoPath) {
  try {
    const dir = path.dirname(videoPath);
    const ext = path.extname(videoPath);
    const base = path.basename(videoPath, ext);

    const candidates = [
      path.join(dir, `${base}.srt`),
      path.join(dir, `${base}.en.srt`),
      path.join(dir, `${base}.vtt`),
      path.join(dir, `${base}.en.vtt`),
      path.join(dir, `${base}.ar.srt`)
    ];

    for (const c of candidates) {
      if (fs.existsSync(c)) {
        return c;
      }
    }
  } catch {}
  return null;
}

// IPC: Open Subtitle File Dialog
ipcMain.handle('dialog:open-subtitle', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Subtitle File (.srt or .vtt)',
    properties: ['openFile'],
    filters: [
      { name: 'Subtitles', extensions: ['srt', 'vtt', 'sub'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (result.canceled || result.filePaths.length === 0) return null;
  const filePath = result.filePaths[0];

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return {
      filePath,
      fileName: path.basename(filePath),
      content
    };
  } catch (err) {
    console.error('Failed to read subtitle:', err);
    return null;
  }
});

// IPC: Read Subtitle from Path (e.g. from drag & drop)
ipcMain.handle('fs:read-subtitle', async (_event, filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return {
        filePath,
        fileName: path.basename(filePath),
        content
      };
    }
  } catch (err) {
    console.error('Failed to read subtitle file:', err);
  }
  return null;
});

// IPC: Saved Words Management
ipcMain.handle('storage:get-words', async () => {
  return readJsonFile(SAVED_WORDS_FILE, []);
});

ipcMain.handle('storage:save-word', async (_event, wordEntry) => {
  const words = readJsonFile(SAVED_WORDS_FILE, []);
  const existingIndex = words.findIndex(
    w => w.text.toLowerCase() === wordEntry.text.toLowerCase()
  );

  const now = Date.now();
  if (existingIndex >= 0) {
    words[existingIndex] = {
      ...words[existingIndex],
      ...wordEntry,
      count: (words[existingIndex].count || 1) + 1,
      lastSeen: now
    };
  } else {
    words.unshift({
      ...wordEntry,
      count: 1,
      firstSeen: now,
      lastSeen: now
    });
  }

  writeJsonFile(SAVED_WORDS_FILE, words);
  return { ok: true, total: words.length };
});

// IPC: User Account Configuration
ipcMain.handle('storage:get-config', async () => {
  return readJsonFile(CONFIG_FILE, {
    session: null,
    targetLang: 'ar',
    playbackSpeed: 1,
    subtitleDelayMs: 0
  });
});

ipcMain.handle('storage:save-config', async (_event, newConfig) => {
  const current = readJsonFile(CONFIG_FILE, {});
  const merged = { ...current, ...newConfig };
  writeJsonFile(CONFIG_FILE, merged);
  return merged;
});

// IPC: Shell
ipcMain.handle('shell:open-external', async (_event, url) => {
  if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
    shell.openExternal(url);
  }
});

// IPC: Native Fullscreen Window Management
ipcMain.handle('window:toggle-fullscreen', async () => {
  if (!mainWindow) return false;
  const isFS = mainWindow.isFullScreen();
  mainWindow.setFullScreen(!isFS);
  return !isFS;
});

ipcMain.handle('window:is-fullscreen', async () => {
  return mainWindow ? mainWindow.isFullScreen() : false;
});

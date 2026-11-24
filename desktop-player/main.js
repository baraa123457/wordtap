const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');
const xmlrpc = require('xmlrpc');
const zlib = require('zlib');

function resolveFfmpegPath() {
  let resolved = null;
  try {
    resolved = require('@ffmpeg-installer/ffmpeg').path;
  } catch (e) {
    console.warn('ffmpeg installer error:', e);
  }

  // When packaged in Electron (.asar), binary executables are unpacked to app.asar.unpacked
  if (resolved && typeof resolved === 'string') {
    if (resolved.includes('app.asar')) {
      const unpacked = resolved.replace('app.asar', 'app.asar.unpacked');
      if (fs.existsSync(unpacked)) {
        return unpacked;
      }
    }
    if (fs.existsSync(resolved)) {
      return resolved;
    }
  }

  const resPath = process.resourcesPath || path.join(__dirname, '..');
  const candidates = [
    path.join(resPath, 'app.asar.unpacked', 'node_modules', '@ffmpeg-installer', 'win32-x64', 'ffmpeg.exe'),
    path.join(resPath, 'app.asar.unpacked', 'ffmpeg.exe'),
    path.join(resPath, 'node_modules', '@ffmpeg-installer', 'win32-x64', 'ffmpeg.exe'),
    path.join(resPath, 'ffmpeg.exe'),
    path.join(resPath, 'app', 'node_modules', '@ffmpeg-installer', 'win32-x64', 'ffmpeg.exe'),
    path.join(__dirname, 'node_modules', '@ffmpeg-installer', 'win32-x64', 'ffmpeg.exe'),
    path.join(__dirname, '..', 'node_modules', '@ffmpeg-installer', 'win32-x64', 'ffmpeg.exe'),
    'C:\\ffmpeg\\bin\\ffmpeg.exe',
    'ffmpeg.exe'
  ];

  for (const c of candidates) {
    try {
      if (c && fs.existsSync(c)) {
        return c;
      }
    } catch (_) {}
  }

  return null;
}

let ffmpegPath = resolveFfmpegPath();
console.log('[WordTap Audio Engine] Resolved FFmpeg path:', ffmpegPath);

// CRITICAL AUDIO & VIDEO FIX: Allow automatic audio playback and hardware decoding
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('disable-features', 'PreloadMediaEngagementData');
app.commandLine.appendSwitch('enable-features', 'PlatformHEVCDecoderSupport');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');

// Remove default OS application menu
Menu.setApplicationMenu(null);

let mainWindow = null;

// Determine path for saved words and configuration
const DATA_DIR = path.join(app.getPath('userData'), 'WordTapVLC');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const SAVED_WORDS_FILE = path.join(DATA_DIR, 'saved_words.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

function cleanPath(p) {
  if (!p) return '';
  let cleaned = String(p).trim();
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return cleaned;
}

const MEDIA_EXTENSIONS = new Set([
  '.mp4', '.mkv', '.webm', '.mov', '.avi', '.m4v', '.ts', '.flv',
  '.wmv', '.mpg', '.mpeg', '.m2ts', '.vob', '.3gp', '.ogv', '.m4a', '.mp3'
]);

function extractFilePathFromArgs(args) {
  if (!Array.isArray(args)) return null;
  const isDev = !app.isPackaged;
  const startIndex = isDev ? 2 : 1;

  // Pass 1: Look for explicit media extension
  for (let i = startIndex; i < args.length; i++) {
    const raw = args[i];
    if (!raw) continue;
    const cleaned = cleanPath(raw);
    if (!cleaned || cleaned.startsWith('--') || cleaned.startsWith('-') || cleaned.startsWith('wordtap://')) continue;

    try {
      const ext = path.extname(cleaned).toLowerCase();
      if (MEDIA_EXTENSIONS.has(ext)) {
        const resolved = path.resolve(cleaned);
        if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
          return resolved;
        }
      }
    } catch {}
  }

  // Pass 2: Look for any valid existing file
  for (let i = startIndex; i < args.length; i++) {
    const raw = args[i];
    if (!raw) continue;
    const cleaned = cleanPath(raw);
    if (!cleaned || cleaned.startsWith('--') || cleaned.startsWith('-') || cleaned.startsWith('wordtap://')) continue;

    try {
      const resolved = path.resolve(cleaned);
      if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
        return resolved;
      }
    } catch {}
  }

  return null;
}

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

function saveSubtitleToDisk(videoPath, rawFileName, langCode, content) {
  try {
    let cleanName = (rawFileName || '').replace(/[/\\?%*:|"<>]/g, '_').trim();
    if (!cleanName.toLowerCase().endsWith('.srt') && !cleanName.toLowerCase().endsWith('.vtt')) {
      cleanName = cleanName ? `${cleanName}.srt` : `subtitle.${langCode || 'en'}.srt`;
    }

    // Option A: Save in the same folder as the video (just like VLC does)
    if (videoPath) {
      try {
        const videoDir = path.dirname(videoPath);
        if (fs.existsSync(videoDir)) {
          const targetPath = path.join(videoDir, cleanName);
          fs.writeFileSync(targetPath, content, 'utf-8');
          console.log(`Saved subtitle next to video: ${targetPath}`);
          return targetPath;
        }
      } catch (err) {
        console.warn('Could not save subtitle next to video (permissions/readonly):', err);
      }
    }

    // Option B: Fallback to user Downloads folder
    try {
      const downloadsDir = app.getPath('downloads');
      if (fs.existsSync(downloadsDir)) {
        const targetPath = path.join(downloadsDir, cleanName);
        fs.writeFileSync(targetPath, content, 'utf-8');
        console.log(`Saved subtitle in Downloads: ${targetPath}`);
        return targetPath;
      }
    } catch (err) {
      console.warn('Could not save subtitle in downloads:', err);
    }

    // Option C: Fallback to DATA_DIR/subtitles
    const subsDir = path.join(DATA_DIR, 'subtitles');
    if (!fs.existsSync(subsDir)) {
      fs.mkdirSync(subsDir, { recursive: true });
    }
    const targetPath = path.join(subsDir, cleanName);
    fs.writeFileSync(targetPath, content, 'utf-8');
    console.log(`Saved subtitle in AppData: ${targetPath}`);
    return targetPath;
  } catch (err) {
    console.error('Fatal error in saveSubtitleToDisk:', err);
    return null;
  }
}

function prepareFilePayload(filePath) {
  if (!filePath) return null;
  try {
    const resolvedPath = path.resolve(cleanPath(filePath));
    if (!fs.existsSync(resolvedPath)) return null;
    const stat = fs.statSync(resolvedPath);
    if (!stat.isFile()) return null;

    // Check media history first to see if a subtitle, sync offset, and playback position were previously saved
    const cfg = readJsonFile(CONFIG_FILE, {});
    const history = (cfg.mediaHistory && cfg.mediaHistory[resolvedPath]) || null;

    let subFile = null;
    let subContent = null;
    let subtitleDelayMs = 0;
    let savedTime = 0;

    if (history) {
      subtitleDelayMs = typeof history.subtitleDelayMs === 'number' ? history.subtitleDelayMs : 0;
      savedTime = typeof history.savedTime === 'number' ? history.savedTime : 0;
      if (history.subPath && fs.existsSync(history.subPath)) {
        subFile = history.subPath;
        try {
          subContent = fs.readFileSync(subFile, 'utf-8');
        } catch {}
      }
    }

    // If no previous subtitle from history, look for adjacent subtitle file next to video
    if (!subContent) {
      subFile = findAdjacentSubtitle(resolvedPath);
      if (subFile) {
        try {
          subContent = fs.readFileSync(subFile, 'utf-8');
        } catch {}
      }
    }

    return {
      filePath: resolvedPath,
      fileName: path.basename(resolvedPath),
      fileUrl: pathToFileURL(resolvedPath).href,
      subFile,
      subContent,
      subtitleDelayMs,
      savedTime
    };
  } catch (err) {
    console.error('Error preparing file payload:', err);
    return null;
  }
}

// Single instance lock for Windows file association ("Open with" & second instance handling)
let pendingFilePayload = null;
const initialArgPath = extractFilePathFromArgs(process.argv);
if (initialArgPath) {
  pendingFilePayload = prepareFilePayload(initialArgPath);
}

// Deep link protocol handler for wordtap://auth
let activeOAuthResolver = null;

function handleDeepLinkUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.startsWith('wordtap://')) return false;
  try {
    const urlObj = new URL(rawUrl.replace(/^wordtap:\/\//, 'http://dummy/'));
    const params = urlObj.searchParams;
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const email = params.get('email');
    const userId = params.get('user_id');

    if (accessToken && email) {
      const session = {
        access_token: accessToken,
        refresh_token: refreshToken || '',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        email: email,
        user_id: userId || ''
      };

      if (activeOAuthResolver) {
        activeOAuthResolver(session);
        activeOAuthResolver = null;
      }

      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
        mainWindow.webContents.send('app:auth-session', session);
      }
      return true;
    }
  } catch (err) {
    console.warn('Failed to parse deep link url:', err);
  }
  return false;
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();

      if (Array.isArray(commandLine)) {
        const protocolUrl = commandLine.find(arg => arg && typeof arg === 'string' && arg.startsWith('wordtap://'));
        if (protocolUrl && handleDeepLinkUrl(protocolUrl)) {
          return;
        }
      }

      const secondPath = extractFilePathFromArgs(commandLine);
      if (secondPath) {
        const payload = prepareFilePayload(secondPath);
        if (payload) {
          mainWindow.webContents.send('app:open-file', payload);
        }
      }
    }
  });
}

app.on('open-url', (event, url) => {
  event.preventDefault();
  handleDeepLinkUrl(url);
});

function readJsonFile(filePath, defaultValue) {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
      return JSON.parse(raw);
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
    minWidth: 860,
    minHeight: 580,
    backgroundColor: '#000000',
    title: 'WordTap VLC Media Player',
    autoHideMenuBar: true,
    icon: path.join(__dirname, process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false, // Allows streaming local video and audio files from hard drive
      backgroundThrottling: false,
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

  mainWindow.webContents.on('did-finish-load', () => {
    if (pendingFilePayload) {
      mainWindow.webContents.send('app:open-file', pendingFilePayload);
    }
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  startAudioServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC: Initial File for "Open with", File Association, or Resume Last Session
ipcMain.handle('app:get-initial-file', async () => {
  if (pendingFilePayload) {
    const payload = pendingFilePayload;
    pendingFilePayload = null;
    return payload;
  }

  // If no CLI file was given, check for the latest session to restore video, subtitle, and sync!
  try {
    const cfg = readJsonFile(CONFIG_FILE, {});
    if (cfg.lastMedia && cfg.lastMedia.filePath && fs.existsSync(cfg.lastMedia.filePath)) {
      const last = cfg.lastMedia;
      let subFile = last.subPath || null;
      let subContent = null;
      if (subFile && fs.existsSync(subFile)) {
        try {
          subContent = fs.readFileSync(subFile, 'utf-8');
        } catch {}
      } else if (last.subContent) {
        subContent = last.subContent;
      }

      return {
        filePath: last.filePath,
        fileName: last.fileName || path.basename(last.filePath),
        fileUrl: pathToFileURL(last.filePath).href,
        subFile,
        subContent,
        subtitleDelayMs: typeof last.subtitleDelayMs === 'number' ? last.subtitleDelayMs : 0,
        savedTime: typeof last.savedTime === 'number' ? last.savedTime : 0,
        isRestoredSession: true
      };
    }
  } catch (err) {
    console.error('Error loading last media session:', err);
  }

  return null;
});

function persistMediaSession(sessionData) {
  if (!sessionData || !sessionData.filePath) return false;
  try {
    const cfg = readJsonFile(CONFIG_FILE, {});
    if (!cfg.mediaHistory) cfg.mediaHistory = {};

    const existing = cfg.mediaHistory[sessionData.filePath] || {};
    const updated = {
      ...existing,
      filePath: sessionData.filePath,
      fileName: sessionData.fileName || path.basename(sessionData.filePath),
      subPath: sessionData.subPath !== undefined ? sessionData.subPath : (existing.subPath || null),
      subFileName: sessionData.subFileName !== undefined ? sessionData.subFileName : (existing.subFileName || null),
      subtitleDelayMs: typeof sessionData.subtitleDelayMs === 'number' ? sessionData.subtitleDelayMs : (existing.subtitleDelayMs || 0),
      savedTime: typeof sessionData.savedTime === 'number' ? sessionData.savedTime : (existing.savedTime || 0),
      lastPlayed: Date.now()
    };

    cfg.mediaHistory[sessionData.filePath] = updated;
    cfg.lastMedia = {
      ...updated,
      subContent: sessionData.subContent || existing.subContent || null
    };

    writeJsonFile(CONFIG_FILE, cfg);
    return true;
  } catch (err) {
    console.error('Error saving media session:', err);
    return false;
  }
}

// IPC: Media Session & Subtitle Sync Persistence
ipcMain.handle('app:save-media-session', async (_event, sessionData) => {
  const ok = persistMediaSession(sessionData);
  return { ok };
});

ipcMain.on('app:save-media-session-sync', (event, sessionData) => {
  const ok = persistMediaSession(sessionData);
  event.returnValue = ok;
});

ipcMain.handle('app:get-media-history', async (_event, filePath) => {
  if (!filePath) return null;
  const cfg = readJsonFile(CONFIG_FILE, {});
  return (cfg.mediaHistory && cfg.mediaHistory[filePath]) || null;
});

// IPC: Open Video File Dialog
ipcMain.handle('dialog:open-video', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Media File (WordTap VLC)',
    properties: ['openFile'],
    filters: [
      { name: 'Video / Media Files', extensions: ['mp4', 'mkv', 'webm', 'mov', 'avi', 'm4v', 'ts', 'flv', 'wmv', 'm4a', 'mp3'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (result.canceled || result.filePaths.length === 0) return null;
  return prepareFilePayload(result.filePaths[0]);
});

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

ipcMain.handle('storage:delete-word', async (_event, wordText) => {
  if (!wordText || typeof wordText !== 'string') return { ok: false, error: 'Invalid word' };
  const target = wordText.trim().toLowerCase();
  const words = readJsonFile(SAVED_WORDS_FILE, []);
  const filtered = words.filter(w => (w.text || '').trim().toLowerCase() !== target);
  writeJsonFile(SAVED_WORDS_FILE, filtered);
  return { ok: true, total: filtered.length };
});

// IPC: User Account Configuration
ipcMain.handle('storage:get-config', async () => {
  const cfg = readJsonFile(CONFIG_FILE, {
    session: null,
    targetLang: 'ar',
    translateSaveMode: 'subtitles_only',
    pauseOnClick: false,
    playbackSpeed: 1,
    subtitleDelayMs: 0,
    volume: 1.0,
    subSizeIdx: 1,
    subCustomSize: 28,
    subFontFamily: 'Arial, "Trebuchet MS", sans-serif',
    subTextColor: '#FFFFFF',
    subBgStyle: 'none',
    subFontWeight: '700',
    subBottomOffset: 46
  });
  cfg.subtitleDelayMs = 0; // Always initialize subtitle sync at 0ms
  return cfg;
});

ipcMain.handle('storage:save-config', async (_event, newConfig) => {
  const current = readJsonFile(CONFIG_FILE, {});
  const merged = { ...current, ...newConfig };
  delete merged.subtitleDelayMs; // Subtitle delay is strictly per-video and always resets to 0ms
  writeJsonFile(CONFIG_FILE, merged);
  return merged;
});

// IPC: Shell
ipcMain.handle('shell:open-external', async (_event, url) => {
  if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
    shell.openExternal(url);
  }
});

// IPC: Google OAuth via Loopback Server & Web Bridge
let activeOAuthServer = null;

ipcMain.handle('auth:sign-in-google', async () => {
  return new Promise((resolve, reject) => {
    if (activeOAuthServer) {
      try { activeOAuthServer.close(); } catch {}
      activeOAuthServer = null;
    }

    activeOAuthResolver = resolve;
    activeOAuthRejecter = reject;

    const SUPABASE_AUTH_URL = 'https://vjjilwbhvoxfigrokqch.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_YzMg6sNWjpwwfP2T-apa-Q_c3EHVBNa';
    const candidatePorts = [54321, 54322, 54323, 54324, 54325];

    let timer = null;
    let resolved = false;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      if (activeOAuthServer) {
        try { activeOAuthServer.close(); } catch {}
        activeOAuthServer = null;
      }
      activeOAuthResolver = null;
      activeOAuthRejecter = null;
    };

    const handler = async (req, res) => {
      try {
        // Handle CORS & Private Network Access for Web App Handoff
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Access-Control-Allow-Private-Network', 'true');

        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }

        const reqUrl = new URL(req.url, 'http://127.0.0.1');

        if (reqUrl.pathname === '/auth/callback') {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>WordTap Authentication</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0c0e1a; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: #151833; border: 1px solid rgba(255,255,255,0.12); padding: 36px 32px; border-radius: 20px; text-align: center; max-width: 400px; width: 90%; box-shadow: 0 24px 64px rgba(0,0,0,0.6); }
    .icon { font-size: 40px; margin-bottom: 14px; }
    h1 { font-size: 21px; font-weight: 700; margin: 0 0 10px; color: #ffd23f; }
    p { font-size: 13.5px; color: #94a3b8; margin: 0 0 20px; line-height: 1.55; }
    .badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.35); color: #34d399; padding: 7px 16px; border-radius: 99px; font-size: 13px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card" id="card">
    <div class="icon">🎬</div>
    <h1>Connecting to WordTap…</h1>
    <p id="msg">Verifying your Google session with WordTap VLC Player…</p>
  </div>
  <script>
    (async function() {
      try {
        const hash = window.location.hash.replace(/^#/, '');
        const search = window.location.search.replace(/^\\?/, '');
        const payload = { hash, search };
        const res = await fetch('/auth-exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.ok) {
          document.getElementById('card').innerHTML = '<div class="icon">✨</div><h1>Welcome back!</h1><p>Successfully signed in with Google. You can now close this tab and return to WordTap Player.</p><div class="badge">✓ Connected to WordTap</div>';
          setTimeout(() => { window.close(); }, 2500);
        } else {
          document.getElementById('msg').innerText = 'Authentication error: ' + (data.error || 'Failed to authenticate');
        }
      } catch (err) {
        document.getElementById('msg').innerText = 'Connection error: ' + err.message;
      }
    })();
  </script>
</body>
</html>`);
          return;
        }

        if (reqUrl.pathname === '/auth-exchange' && req.method === 'POST') {
          let bodyStr = '';
          req.on('data', chunk => { bodyStr += chunk; });
          req.on('end', async () => {
            try {
              const body = JSON.parse(bodyStr || '{}');

              // If session was delivered directly from web handoff
              if (body.access_token && body.email) {
                const session = {
                  access_token: body.access_token,
                  refresh_token: body.refresh_token || '',
                  expires_at: body.expires_at || (Math.floor(Date.now() / 1000) + (body.expires_in || 3600)),
                  email: body.email,
                  user_id: body.user_id || ''
                };

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true, email: session.email }));

                cleanup();

                if (mainWindow && !mainWindow.isDestroyed()) {
                  if (mainWindow.isMinimized()) mainWindow.restore();
                  mainWindow.focus();
                  mainWindow.webContents.send('app:auth-session', session);
                }

                if (!resolved) {
                  resolved = true;
                  resolve(session);
                }
                return;
              }

              const params = new URLSearchParams(body.hash || body.search || '');

              const errorDesc = params.get('error_description') || params.get('error');
              if (errorDesc) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: false, error: errorDesc }));
                cleanup();
                if (!resolved) {
                  resolved = true;
                  reject(new Error(errorDesc));
                }
                return;
              }

              let accessToken = params.get('access_token') || body.access_token;
              let refreshToken = params.get('refresh_token') || body.refresh_token;
              let expiresIn = parseInt(params.get('expires_in') || body.expires_in || '3600', 10);
              const code = params.get('code') || body.code;

              if (!accessToken && code) {
                const tokenRes = await fetch(`${SUPABASE_AUTH_URL}/auth/v1/token?grant_type=authorization_code`, {
                  method: 'POST',
                  headers: {
                    apikey: SUPABASE_ANON_KEY,
                    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ auth_code: code })
                });
                const tokenData = await tokenRes.json();
                if (!tokenRes.ok) {
                  throw new Error(tokenData.error_description || tokenData.msg || 'Token exchange failed');
                }
                accessToken = tokenData.access_token;
                refreshToken = tokenData.refresh_token;
                expiresIn = tokenData.expires_in || 3600;
              }

              if (!accessToken) {
                throw new Error('No access token received from authentication provider');
              }

              const userRes = await fetch(`${SUPABASE_AUTH_URL}/auth/v1/user`, {
                headers: {
                  apikey: SUPABASE_ANON_KEY,
                  Authorization: `Bearer ${accessToken}`
                }
              });
              const userData = await userRes.json();
              if (!userRes.ok) {
                throw new Error(userData.msg || userData.message || 'Could not verify user profile');
              }

              const session = {
                access_token: accessToken,
                refresh_token: refreshToken,
                expires_at: Math.floor(Date.now() / 1000) + expiresIn,
                email: userData.email,
                user_id: userData.id
              };

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: true, email: session.email }));

              cleanup();

              if (mainWindow && !mainWindow.isDestroyed()) {
                if (mainWindow.isMinimized()) mainWindow.restore();
                mainWindow.focus();
                mainWindow.webContents.send('app:auth-session', session);
              }

              if (!resolved) {
                resolved = true;
                resolve(session);
              }
            } catch (err) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: false, error: err.message }));
              cleanup();
              if (!resolved) {
                resolved = true;
                reject(err);
              }
            }
          });
          return;
        }

        res.writeHead(404);
        res.end('Not Found');
      } catch (err) {
        res.writeHead(500);
        res.end('Internal Server Error');
      }
    };

    let portIndex = 0;
    function tryPort() {
      if (portIndex >= candidatePorts.length) {
        return reject(new Error('Unable to bind local authentication port.'));
      }
      const port = candidatePorts[portIndex++];
      const server = http.createServer(handler);

      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          tryPort();
        } else {
          cleanup();
          reject(err);
        }
      });

      server.listen(port, '127.0.0.1', () => {
        activeOAuthServer = server;

        // Auto timeout after 2 minutes
        timer = setTimeout(() => {
          cleanup();
          if (!resolved) {
            resolved = true;
            reject(new Error('Google sign-in timed out. Please try again.'));
          }
        }, 120000);

        // Open official Web App Desktop Auth bridge (100% permitted by Supabase redirect whitelist)
        const authUrl = `https://wordtap.vercel.app/auth/desktop?port=${port}`;
        shell.openExternal(authUrl);
      });
    }

    tryPort();
  });
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

// ==========================================
// AUDIO TRANSCODING & PROBING ENGINE (FFmpeg)
// ==========================================

function probeAudio(filePath) {
  return new Promise((resolve) => {
    if (!ffmpegPath || !fs.existsSync(filePath)) {
      return resolve({ hasAudio: false, needsTranscode: false, codecs: [], audioStreams: [] });
    }

    let resolved = false;
    const safeResolve = (data) => {
      if (!resolved) {
        resolved = true;
        resolve(data);
      }
    };

    // Fast probing with buffer limits and safe 4-second timeout to avoid UI stalls
    const child = spawn(ffmpegPath, ['-analyzeduration', '2M', '-probesize', '2M', '-i', filePath]);
    let output = '';

    const timer = setTimeout(() => {
      try { child.kill(); } catch {}
      safeResolve({ hasAudio: false, needsTranscode: false, codecs: [], audioStreams: [] });
    }, 4000);

    child.stderr.on('data', d => output += d.toString());
    child.on('error', (err) => {
      clearTimeout(timer);
      console.warn('probeAudio spawn error:', err);
      safeResolve({ hasAudio: false, needsTranscode: false, codecs: [], audioStreams: [] });
    });

    child.on('close', () => {
      clearTimeout(timer);
      const audioStreams = [];
      const codecs = [];
      let needsTranscode = false;
      let primaryCodec = null;

      const lines = output.split('\n');
      let dar = null;
      let sar = null;

      // Comprehensive unsupported codecs in Chromium native HTML5 video engine:
      // - Dolby Digital / AC-3 (ac3, ac-3, a52)
      // - Dolby Digital Plus / Atmos (eac3, eac-3, ec-3)
      // - DTS, DTS-HD, DTS:X (dca, dts, dts-hd, dtsx)
      // - Dolby TrueHD, MLP (truehd, mlp)
      // - Windows Media Audio (wma, wmav1, wmav2, wmapro)
      // - High-bitrate / Blu-ray PCM (pcm_s24le, pcm_s32le, pcm_bluray, pcm_dvd)
      // - MPEG Audio Layer 2 (mp2)
      const unsupportedRegex = /\b(?:ac3|ac-3|a52|eac3|eac-3|ec-3|dca|dts|dts-hd|dtsx|truehd|mlp|wma|wmav\d|pcm_s24|pcm_s32|pcm_bluray|mp2)\b/i;

      for (const line of lines) {
        if (line.includes('Video:')) {
          const darMatch = line.match(/DAR\s+([0-9]+:[0-9]+)/i);
          if (darMatch) {
            dar = darMatch[1].replace(':', '/');
          }
          const sarMatch = line.match(/SAR\s+([0-9]+:[0-9]+)/i);
          if (sarMatch) {
            sar = sarMatch[1].replace(':', '/');
          }
        }
        if (line.includes('Audio:')) {
          audioStreams.push(line.trim());
          const match = line.match(/Audio:\s*([^,]+)/);
          const rawCodec = match ? match[1].trim() : 'unknown';
          const codec = rawCodec.toLowerCase();
          codecs.push(codec);

          const isDefault = line.includes('(default)');
          const isUnsupported = unsupportedRegex.test(line) || unsupportedRegex.test(codec);

          if (isDefault || primaryCodec === null) {
            primaryCodec = codec;
            if (isUnsupported) {
              needsTranscode = true;
            }
          }

          if (isUnsupported) {
            needsTranscode = true;
          }
        }
      }

      // If the primary or default stream cannot be natively decoded by Chromium, auto-transcode is mandatory
      if (primaryCodec && unsupportedRegex.test(primaryCodec)) {
        needsTranscode = true;
      }

      const hasAudio = audioStreams.length > 0;
      const hasSafeCodec = codecs.some(c => /^(?:aac|mp3|opus|vorbis|flac)/i.test(c));
      if (hasAudio && !hasSafeCodec) {
        needsTranscode = true;
      }

      safeResolve({
        hasAudio,
        codecs,
        needsTranscode,
        audioStreams,
        dar,
        sar,
        primaryCodec
      });
    });
  });
}

function transcodeAudio(filePath) {
  return new Promise((resolve) => {
    if (!ffmpegPath || !fs.existsSync(filePath)) {
      return resolve({ success: false, error: 'FFmpeg not available or video file not found' });
    }

    try {
      const stats = fs.statSync(filePath);
      const hash = crypto.createHash('md5').update(`${filePath}_${stats.size}_${stats.mtimeMs}`).digest('hex');
      const tempAudioPath = path.join(os.tmpdir(), `wt_vlc_${hash}.mp3`);

      // Check if already transcoded in cache
      if (fs.existsSync(tempAudioPath) && fs.statSync(tempAudioPath).size > 1024) {
        return resolve({
          success: true,
          cached: true,
          audioPath: tempAudioPath,
          audioUrl: `file://${tempAudioPath.replace(/\\/g, '/')}`
        });
      }

      // Transcode audio stream to standard 192k MP3 (100% playable & instantaneous seeking in Chromium)
      const args = [
        '-y',
        '-i', filePath,
        '-vn',
        '-c:a', 'mp3',
        '-b:a', '192k',
        tempAudioPath
      ];

      const child = spawn(ffmpegPath, args);
      let stderr = '';
      child.stderr.on('data', d => stderr += d.toString());
      child.on('error', (err) => {
        console.warn('transcodeAudio spawn error:', err);
        resolve({ success: false, error: err.message });
      });

      child.on('close', (code) => {
        if (code === 0 && fs.existsSync(tempAudioPath) && fs.statSync(tempAudioPath).size > 512) {
          resolve({
            success: true,
            cached: false,
            audioPath: tempAudioPath,
            audioUrl: `file://${tempAudioPath.replace(/\\/g, '/')}`
          });
        } else {
          console.error('Audio transcode error:', stderr);
          resolve({
            success: false,
            error: `Transcode failed with exit code ${code}`
          });
        }
      });
    } catch (err) {
      resolve({ success: false, error: err.message });
    }
  });
}

ipcMain.handle('audio:probe', async (_event, filePath) => {
  return probeAudio(filePath);
});

ipcMain.handle('audio:transcode', async (_event, filePath) => {
  return transcodeAudio(filePath);
});

// ==========================================
// REAL-TIME ON-DEMAND AUDIO STREAMING SERVER
// (Starts sound in <60ms for DDP 5.1, EAC3, AC3, DTS)
// ==========================================
let audioServer = null;
let audioServerPort = 0;
let currentAudioProc = null;

function startAudioServer() {
  if (audioServer) return;

  audioServer = http.createServer((req, res) => {
    try {
      const parsedUrl = new URL(req.url, 'http://127.0.0.1');
      if (parsedUrl.pathname !== '/audio') {
        res.writeHead(404);
        return res.end();
      }

      const filePath = parsedUrl.searchParams.get('file');
      const startTime = parseFloat(parsedUrl.searchParams.get('t') || '0');

      if (!filePath || !fs.existsSync(filePath)) {
        res.writeHead(404);
        return res.end('File not found');
      }

      // Kill previous stream process if running
      if (currentAudioProc && !currentAudioProc.killed) {
        try { currentAudioProc.kill(); } catch {}
      }

      res.writeHead(200, {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-cache, no-store',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });

      // Sample-accurate seek, clean stereo downmixing, instant packet flushing, zero negative PTS
      const args = [
        '-ss', String(Math.max(0, startTime)),
        '-i', filePath,
        '-vn',
        '-map', '0:a:0',
        '-c:a', 'mp3',
        '-b:a', '192k',
        '-ac', '2',
        '-flush_packets', '1',
        '-avoid_negative_ts', 'make_zero',
        '-f', 'mp3',
        'pipe:1'
      ];

      const child = spawn(ffmpegPath, args, { windowsHide: true });
      currentAudioProc = child;

      child.on('error', (err) => {
        console.warn('audioServer stream spawn error:', err);
        if (!res.headersSent) {
          try { res.writeHead(500); } catch {}
        }
        if (!res.writableEnded) {
          try { res.end('Audio stream failed'); } catch {}
        }
      });

      child.stdout.pipe(res);
      child.stderr.on('data', () => {});

      const cleanup = () => {
        try { if (!child.killed) child.kill(); } catch {}
      };

      req.on('close', cleanup);
      res.on('close', cleanup);
      child.on('close', () => {
        if (!res.writableEnded) res.end();
      });
    } catch (err) {
      console.error('Audio stream server error:', err);
      if (!res.headersSent) res.writeHead(500);
      res.end();
    }
  });

  audioServer.listen(0, '127.0.0.1', () => {
    audioServerPort = audioServer.address().port;
    console.log(`Live audio stream server ready on 127.0.0.1:${audioServerPort}`);
  });
}

ipcMain.handle('audio:get-stream-url', async (_event, { filePath, startTime }) => {
  if (!audioServerPort) {
    startAudioServer();
    for (let i = 0; i < 20 && !audioServerPort; i++) {
      await new Promise(r => setTimeout(r, 50));
    }
  }
  if (!audioServerPort) return null;
  return `http://127.0.0.1:${audioServerPort}/audio?file=${encodeURIComponent(filePath)}&t=${startTime || 0}&_=${Date.now()}`;
});

// ==========================================
// VLSUB OPENSUBTITLES ENGINE (XML-RPC)
// ==========================================

function computeOpenSubtitlesHash(filePath) {
  try {
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;
    if (fileSize < 131072) return null;

    const chunkSize = 65536;
    const buf = Buffer.alloc(chunkSize);
    const fd = fs.openSync(filePath, 'r');

    let hash = BigInt(fileSize);

    // Read first 64KB
    fs.readSync(fd, buf, 0, chunkSize, 0);
    for (let i = 0; i < chunkSize; i += 8) {
      hash = (hash + buf.readBigUInt64LE(i)) & BigInt('0xFFFFFFFFFFFFFFFF');
    }

    // Read last 64KB
    fs.readSync(fd, buf, 0, chunkSize, fileSize - chunkSize);
    for (let i = 0; i < chunkSize; i += 8) {
      hash = (hash + buf.readBigUInt64LE(i)) & BigInt('0xFFFFFFFFFFFFFFFF');
    }

    fs.closeSync(fd);
    let hex = hash.toString(16);
    while (hex.length < 16) hex = '0' + hex;
    return { movieHash: hex, movieByteSize: fileSize };
  } catch (err) {
    console.error('Hash calculation error:', err);
    return null;
  }
}

let osToken = null;
let osTokenTime = 0;

function getOpenSubtitlesClient() {
  return xmlrpc.createClient({
    host: 'api.opensubtitles.org',
    port: 80,
    path: '/xml-rpc',
    headers: {
      'User-Agent': 'VLSub 0.10.2'
    }
  });
}

function getValidToken() {
  return new Promise((resolve, reject) => {
    const now = Date.now();
    if (osToken && (now - osTokenTime) < 10 * 60 * 1000) {
      return resolve(osToken);
    }
    const client = getOpenSubtitlesClient();
    client.methodCall('LogIn', ['', '', 'en', 'VLSub 0.10.2'], (err, val) => {
      if (err) return reject(err);
      if (val && val.token) {
        osToken = val.token;
        osTokenTime = Date.now();
        resolve(osToken);
      } else {
        reject(new Error((val && val.status) || 'OpenSubtitles login failed'));
      }
    });
  });
}

ipcMain.handle('vlsub:calculate-hash', async (_event, filePath) => {
  if (!filePath || !fs.existsSync(filePath)) return null;
  return computeOpenSubtitlesHash(filePath);
});

ipcMain.handle('vlsub:search', async (_event, params) => {
  try {
    const token = await getValidToken();
    const client = getOpenSubtitlesClient();

    const queryObj = {};
    if (params.langCode && params.langCode !== 'all') {
      queryObj.sublanguageid = params.langCode;
    }
    if (params.movieHash && params.movieByteSize) {
      queryObj.moviehash = params.movieHash;
      queryObj.moviebytesize = params.movieByteSize;
    } else if (params.query) {
      queryObj.query = params.query.trim();
      if (params.season) queryObj.season = params.season;
      if (params.episode) queryObj.episode = params.episode;
    }

    return new Promise((resolve) => {
      client.methodCall('SearchSubtitles', [token, [queryObj]], (err, res) => {
        if (err) {
          console.error('VLsub search error:', err);
          return resolve({ ok: false, error: err.message, data: [] });
        }
        if (!res || !res.data) {
          return resolve({ ok: true, data: [] });
        }
        const list = res.data.map(item => ({
          id: item.IDSubtitleFile,
          fileName: item.SubFileName || item.MovieReleaseName || 'subtitle.srt',
          movieName: item.MovieName || '',
          movieYear: item.MovieYear || '',
          langName: item.LanguageName || item.SubLanguageID || 'Unknown',
          langCode: item.SubLanguageID || '',
          rating: item.SubRating || '0.0',
          downloads: item.SubDownloadsCnt || '0',
          format: item.SubFormat || 'srt'
        }));
        resolve({ ok: true, data: list });
      });
    });
  } catch (err) {
    console.error('VLsub search exception:', err);
    return { ok: false, error: err.message, data: [] };
  }
});

ipcMain.handle('vlsub:download', async (_event, params) => {
  try {
    let subId;
    let videoPath = null;
    let fileName = 'subtitle.srt';
    let langCode = 'en';

    if (typeof params === 'object' && params !== null) {
      subId = params.subId;
      videoPath = params.videoPath || null;
      fileName = params.fileName || fileName;
      langCode = params.langCode || langCode;
    } else {
      subId = params;
    }

    const token = await getValidToken();
    const client = getOpenSubtitlesClient();

    return new Promise((resolve) => {
      client.methodCall('DownloadSubtitles', [token, [subId]], (err, res) => {
        if (err) {
          console.error('VLsub download error:', err);
          return resolve({ ok: false, error: err.message });
        }
        if (!res || !res.data || res.data.length === 0) {
          return resolve({ ok: false, error: 'Empty subtitle data returned' });
        }
        try {
          const rawBase64 = res.data[0].data;
          const gzBuf = Buffer.from(rawBase64, 'base64');
          const unzipped = zlib.gunzipSync(gzBuf).toString('utf-8');

          // Download & save the .srt file directly to disk (matching VLC behavior)
          const savedPath = saveSubtitleToDisk(videoPath, fileName, langCode, unzipped);

          resolve({
            ok: true,
            srtContent: unzipped,
            savedPath,
            fileName: savedPath ? path.basename(savedPath) : fileName
          });
        } catch (unzipErr) {
          resolve({ ok: false, error: 'Failed to decompress subtitle: ' + unzipErr.message });
        }
      });
    });
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

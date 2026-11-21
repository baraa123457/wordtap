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

let ffmpegPath = null;
try {
  ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
} catch (e) {
  console.warn('ffmpeg installer error:', e);
}

// Fallback search paths for packaged or unpacked app
if (!ffmpegPath || !fs.existsSync(ffmpegPath)) {
  const candidates = [
    path.join(__dirname, 'node_modules', '@ffmpeg-installer', 'win32-x64', 'ffmpeg.exe'),
    path.join(process.resourcesPath || '', 'app', 'node_modules', '@ffmpeg-installer', 'win32-x64', 'ffmpeg.exe'),
    path.join(process.resourcesPath || '', 'node_modules', '@ffmpeg-installer', 'win32-x64', 'ffmpeg.exe'),
    'C:\\ffmpeg\\bin\\ffmpeg.exe',
    'ffmpeg.exe'
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) {
      ffmpegPath = c;
      break;
    }
  }
}

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
    if (!cleaned || cleaned.startsWith('--') || cleaned.startsWith('-')) continue;

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
    if (!cleaned || cleaned.startsWith('--') || cleaned.startsWith('-')) continue;

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

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();

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
    backgroundColor: '#1b1b1e',
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

    const child = spawn(ffmpegPath, ['-i', filePath]);
    let output = '';
    child.stderr.on('data', d => output += d.toString());
    child.on('error', (err) => {
      console.warn('probeAudio spawn error:', err);
      resolve({ hasAudio: false, needsTranscode: false, codecs: [], audioStreams: [] });
    });
    child.on('close', () => {
      const audioStreams = [];
      const codecs = [];
      let needsTranscode = false;

      const lines = output.split('\n');
      for (const line of lines) {
        if (line.includes('Audio:')) {
          audioStreams.push(line.trim());
          const match = line.match(/Audio:\s*([^,]+)/);
          const codec = match ? match[1].trim().toLowerCase() : 'unknown';
          codecs.push(codec);
          // Chromium cannot natively decode AC3 (Dolby Digital), E-AC3, DTS, TrueHD, MLP
          if (/ac3|eac3|dts|truehd|mlp/i.test(codec)) {
            needsTranscode = true;
          }
        }
      }

      const hasAudio = audioStreams.length > 0;
      const hasSafeCodec = codecs.some(c => /aac|mp3|opus|vorbis/i.test(c));
      if (hasAudio && !hasSafeCodec) {
        needsTranscode = true;
      }

      resolve({
        hasAudio,
        codecs,
        needsTranscode,
        audioStreams
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

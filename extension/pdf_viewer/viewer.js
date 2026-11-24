/**
 * WordTap PDF Reader
 * Built with bundled PDF.js EventBus + PDFLinkService + PDFViewer.
 * Enables selectable DOM text layers for WordTap instant translation tooltip card.
 */

// Polyfill TC39 proposal methods for cross-engine PDF.js compatibility
if (typeof Uint8Array !== "undefined" && !Uint8Array.prototype.toHex) {
  Uint8Array.prototype.toHex = function () {
    return Array.from(this, (b) => b.toString(16).padStart(2, "0")).join("");
  };
}
if (typeof Map !== "undefined" && !Map.prototype.getOrInsertComputed) {
  Map.prototype.getOrInsertComputed = function (key, callbackFn) {
    if (this.has(key)) return this.get(key);
    const value = callbackFn(key);
    this.set(key, value);
    return value;
  };
}
if (typeof WeakMap !== "undefined" && !WeakMap.prototype.getOrInsertComputed) {
  WeakMap.prototype.getOrInsertComputed = function (key, callbackFn) {
    if (this.has(key)) return this.get(key);
    const value = callbackFn(key);
    this.set(key, value);
    return value;
  };
}
if (typeof Math !== "undefined" && !Math.sumPrecise) {
  Math.sumPrecise = function (iterable) {
    let sum = 0;
    for (const val of iterable) {
      sum += Number(val) || 0;
    }
    return sum;
  };
}

import * as pdfjsLib from "./lib/pdf.mjs";

// Make pdfjsLib globally accessible before dynamically loading pdf_viewer.mjs
globalThis.pdfjsLib = pdfjsLib;

// Safe resource URL resolver that handles Chrome extensions, local files, and standalone environments
const getResourceUrl = (relPath) => {
  if (typeof chrome !== "undefined" && chrome.runtime && typeof chrome.runtime.getURL === "function") {
    try {
      const clean = relPath.startsWith("lib/") ? "pdf_viewer/" + relPath : "pdf_viewer/lib/" + relPath;
      return chrome.runtime.getURL(clean);
    } catch (_) {}
  }
  return new URL(relPath.startsWith("lib/") ? relPath : "lib/" + relPath, import.meta.url).href;
};

// Safe storage access fallback
const storageGet = (keys, callback) => {
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(keys, callback);
  } else {
    try {
      const res = {};
      for (const k of keys) {
        const item = localStorage.getItem(k);
        if (item) {
          try { res[k] = JSON.parse(item); } catch (_) { res[k] = item; }
        }
      }
      callback(res);
    } catch (_) {
      callback({});
    }
  }
};

const storageSet = (items) => {
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set(items);
  } else {
    try {
      for (const [k, v] of Object.entries(items)) {
        localStorage.setItem(k, JSON.stringify(v));
      }
    } catch (_) {}
  }
};

// Configure worker and font resources locally from extension bundle (MV3 CSP compliant)
pdfjsLib.GlobalWorkerOptions.workerSrc = getResourceUrl("pdf.worker.mjs");

const pdfjsViewer = await import("./lib/pdf_viewer.mjs");

// ── DOM Elements ────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const docNameEl        = $("docName");
const prevPageBtn      = $("prevPageBtn");
const nextPageBtn      = $("nextPageBtn");
const pageNumberInput  = $("pageNumberInput");
const numPagesSpan     = $("numPagesSpan");
const zoomInBtn        = $("zoomInBtn");
const zoomOutBtn       = $("zoomOutBtn");
const scaleSelect      = $("scaleSelect");
const findInput        = $("findInput");
const findPrevBtn      = $("findPrevBtn");
const findNextBtn      = $("findNextBtn");
const findMatchCount   = $("findMatchCount");
const ocrToolBtn       = $("ocrToolBtn");
const openOriginalBtn  = $("openOriginalBtn");
const loadingOverlay   = $("loadingOverlay");
const loadingText      = $("loadingText");
const errorOverlay     = $("errorOverlay");
const errorTitle       = $("errorTitle");
const errorDesc        = $("errorDesc");
const retryLoadBtn     = $("retryLoadBtn");
const scannedBanner    = $("scannedBanner");
const scannedOcrBtn    = $("scannedOcrBtn");
const viewerContainer  = $("viewerContainer");
const viewerEl         = $("viewer");

// ── Helpers ─────────────────────────────────────────────────────────────────
function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

function getDecodedFileName(url) {
  if (!url) return "Document.pdf";
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname || "";
    const raw = pathname.substring(pathname.lastIndexOf("/") + 1);
    const decoded = decodeURIComponent(raw).trim();
    return decoded || "Document.pdf";
  } catch (_) {
    const clean = url.split("?")[0].split("#")[0];
    const raw = clean.substring(clean.lastIndexOf("/") + 1);
    try {
      return decodeURIComponent(raw).trim() || "Document.pdf";
    } catch (_) {
      return raw || "Document.pdf";
    }
  }
}

function shortenFileName(name, maxLen = 30) {
  if (!name || name.length <= maxLen) return name;
  const dot = name.lastIndexOf(".");
  const ext = dot !== -1 ? name.slice(dot) : "";
  const base = dot !== -1 ? name.slice(0, dot) : name;
  const keep = Math.max(4, maxLen - ext.length - 3);
  return base.slice(0, keep) + "…" + ext;
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

// ── State ───────────────────────────────────────────────────────────────────
const rawFileUrl = getQueryParam("file");
const fileName = getDecodedFileName(rawFileUrl);
const isFileScheme = Boolean(rawFileUrl && rawFileUrl.startsWith("file://"));

// For local file:// PDFs, store ONLY the file name (never the local host directory path)
const cleanSourceUrl = isFileScheme ? fileName : (rawFileUrl || "");

// Export metadata for select-translate.js so words saved receive source = "pdf"
window.__WORDTAP_PDF_SOURCE__ = {
  isPdf: true,
  title: fileName,
  url: cleanSourceUrl,
};

// Update Document UI Title
document.title = `${fileName} — WordTap Reader`;
if (docNameEl) {
  docNameEl.textContent = shortenFileName(fileName);
  docNameEl.title = fileName;
}

if (openOriginalBtn && rawFileUrl) {
  openOriginalBtn.addEventListener("click", () => {
    try {
      chrome.runtime.sendMessage({ type: "wordtap:skip-pdf-redirect-once" }, () => {
        window.location.href = rawFileUrl;
      });
    } catch (_) {
      window.location.href = rawFileUrl;
    }
  });
}

// ── Viewer Initialization ───────────────────────────────────────────────────
let currentDocument = null;
let currentLoadingTask = null;
let emptyTextPageCount = 0;
let totalRenderedPages = 0;

const eventBus = new pdfjsViewer.EventBus();
const linkService = new pdfjsViewer.PDFLinkService({ eventBus });
const findController = new pdfjsViewer.PDFFindController({ eventBus, linkService });

const pdfViewer = new pdfjsViewer.PDFViewer({
  container: viewerContainer,
  viewer: viewerEl,
  eventBus,
  linkService,
  findController,
  textLayerMode: 1, // Enable selectable text layers for WordTap
  annotationMode: 0,
  maxCanvasPixels: -1, // Uncapped: allows full native high-DPI rendering without scaling restrictions
  capCanvasAreaFactor: -1, // Prevent capping canvas pixels to screen area
  enableDetailCanvas: false, // Ensure full crisp single-pass canvas rasterization at 100% native resolution
});
linkService.setViewer(pdfViewer);
window.pdfViewer = pdfViewer;

// Storage key for persisting reading position and zoom
const storageKey = rawFileUrl ? `wordtap_pdf_pos_${hashString(rawFileUrl)}` : null;

// ── Event Bus Listeners ─────────────────────────────────────────────────────
eventBus.on("pagesinit", () => {
  if (!storageKey) {
    pdfViewer.currentScaleValue = "page-actual";
    if (scaleSelect) scaleSelect.value = "page-actual";
    return;
  }
  storageGet([storageKey], (res) => {
    const saved = res && res[storageKey];
    if (saved && saved.scale) {
      pdfViewer.currentScaleValue = saved.scale;
      if (scaleSelect) scaleSelect.value = saved.scale;
    } else {
      pdfViewer.currentScaleValue = "page-actual";
      if (scaleSelect) scaleSelect.value = "page-actual";
    }

    if (saved && saved.page && saved.page > 1 && saved.page <= (currentDocument?.numPages || 1)) {
      pdfViewer.currentPageNumber = saved.page;
    }
  });
});

let savePositionTimer = null;
function persistPosition(pageNumber, scale) {
  if (!storageKey) return;
  clearTimeout(savePositionTimer);
  savePositionTimer = setTimeout(() => {
    storageSet({
      [storageKey]: {
        page: pageNumber,
        scale: scale || pdfViewer.currentScaleValue,
        lastRead: Date.now(),
      },
    });
  }, 400);
}

eventBus.on("pagechanging", (evt) => {
  const page = evt.pageNumber;
  if (pageNumberInput) pageNumberInput.value = page;
  updateNavButtons(page);
  persistPosition(page, pdfViewer.currentScaleValue);
});

eventBus.on("scalechanging", (evt) => {
  const scale = evt.scale;
  if (scaleSelect) {
    if (evt.presetValue) {
      scaleSelect.value = evt.presetValue;
    } else if (Math.abs(scale - 1.0) < 0.05) {
      scaleSelect.value = "page-actual";
    } else {
      const options = Array.from(scaleSelect.options)
        .map((o) => parseFloat(o.value))
        .filter((v) => !isNaN(v));
      if (options.length > 0) {
        const closest = options.reduce((prev, curr) =>
          Math.abs(curr - scale) < Math.abs(prev - scale) ? curr : prev
        );
        if (Math.abs(closest - scale) < 0.1) {
          scaleSelect.value = String(closest);
        }
      }
    }
  }
  persistPosition(pdfViewer.currentPageNumber, evt.presetValue || String(scale));
});

// Detect scanned documents (pages with 0 selectable text divs)
eventBus.on("textlayerrendered", (evt) => {
  totalRenderedPages++;
  if (evt.numTextDivs === 0) {
    emptyTextPageCount++;
  }
  // If first 2+ pages rendered have no selectable text divs, surface friendly OCR notice
  if (totalRenderedPages >= 2 && emptyTextPageCount === totalRenderedPages) {
    if (scannedBanner) scannedBanner.style.display = "flex";
  }
});

// Find Matches Update
eventBus.on("updatefindmatchescount", (evt) => {
  if (!findMatchCount) return;
  const count = evt.matchesCount;
  if (count && count.total > 0) {
    findMatchCount.textContent = `${count.current}/${count.total}`;
    findMatchCount.style.color = "var(--subtitle)";
  } else if (findInput && findInput.value.trim()) {
    findMatchCount.textContent = "0/0";
    findMatchCount.style.color = "var(--bad)";
  } else {
    findMatchCount.textContent = "";
  }
});

function updateNavButtons(currentPage) {
  const total = currentDocument ? currentDocument.numPages : 1;
  if (prevPageBtn) prevPageBtn.disabled = currentPage <= 1;
  if (nextPageBtn) nextPageBtn.disabled = currentPage >= total;
}

// ── Document Loader ─────────────────────────────────────────────────────────
async function loadPdfDocument() {
  if (!rawFileUrl) {
    showError("No PDF Specified", "Please provide a valid PDF file URL in the address query parameter.");
    return;
  }

  hideError();
  showLoading("Opening PDF document…");

  // Check file scheme access permission if this is a local file
  if (isFileScheme && chrome.extension && chrome.extension.isAllowedFileSchemeAccess) {
    const isAllowed = await Promise.race([
      new Promise((resolve) => chrome.extension.isAllowedFileSchemeAccess(resolve)),
      new Promise((resolve) => setTimeout(() => resolve(true), 1200)),
    ]);
    if (!isAllowed) {
      showError(
        "File Access Permission Required",
        "Chrome blocks extensions from reading local file:// URLs by default. Please enable 'Allow access to file URLs' for WordTap in Chrome Extensions Settings.",
        true
      );
      return;
    }
  }

  try {
    if (currentLoadingTask) {
      try { await currentLoadingTask.destroy(); } catch (_) {}
    }

    let docParams;
    if (isFileScheme || !rawFileUrl.startsWith("http")) {
      showLoading("Reading local PDF…");
      const res = await fetch(rawFileUrl);
      if (!res.ok && res.status !== 0 && res.status !== 200) {
        throw new Error(`Could not read local file (Status: ${res.status} ${res.statusText})`);
      }
      const buffer = await res.arrayBuffer();
      docParams = {
        data: new Uint8Array(buffer),
        cMapUrl: getResourceUrl("cmaps/"),
        cMapPacked: true,
        standardFontDataUrl: getResourceUrl("standard_fonts/"),
        enableHWA: true,
        useSystemFonts: true,
        fontExtraProperties: true,
      };
    } else {
      docParams = {
        url: rawFileUrl,
        cMapUrl: getResourceUrl("cmaps/"),
        cMapPacked: true,
        standardFontDataUrl: getResourceUrl("standard_fonts/"),
        enableHWA: true,
        useSystemFonts: true,
        fontExtraProperties: true,
      };
    }

    currentLoadingTask = pdfjsLib.getDocument(docParams);

    currentLoadingTask.onProgress = (progress) => {
      if (progress.total > 0) {
        const percent = Math.round((progress.loaded / progress.total) * 100);
        loadingText.textContent = `Loading PDF… ${percent}%`;
      }
    };

    const loadTimeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("Loading timed out. Check that the file exists and file access permissions are enabled.")),
        25000
      )
    );

    const doc = await Promise.race([currentLoadingTask.promise, loadTimeoutPromise]);
    currentDocument = doc;
    pdfViewer.setDocument(doc);
    linkService.setDocument(doc, null);

    if (numPagesSpan) numPagesSpan.textContent = doc.numPages;
    if (pageNumberInput) {
      pageNumberInput.max = doc.numPages;
      pageNumberInput.value = 1;
    }
    updateNavButtons(1);
    hideLoading();
  } catch (err) {
    console.error("WordTap PDF load error:", err);
    let msg = err && err.message ? err.message : "Unable to read or parse the PDF document.";
    if (isFileScheme && (msg.includes("fetch") || msg.includes("Failed to fetch") || msg.includes("ERR_FILE_NOT_FOUND"))) {
      showError(
        "Local File Access Blocked",
        "Chrome blocked access to this file. Ensure 'Allow access to file URLs' is turned ON in WordTap extension details, and verify the file path exists.",
        true
      );
    } else {
      showError("Could Not Open PDF", msg);
    }
  }
}

function showLoading(msg) {
  if (loadingOverlay) {
    loadingText.textContent = msg || "Loading…";
    loadingOverlay.style.display = "flex";
  }
}

function hideLoading() {
  if (loadingOverlay) loadingOverlay.style.display = "none";
}

function showError(title, message, isFileAccessError = false) {
  hideLoading();
  if (errorOverlay) {
    errorOverlay.style.display = "flex";
    if (errorTitle) errorTitle.textContent = title;
    if (errorDesc) errorDesc.textContent = message;

    const actions = $("errorActions");
    if (actions) {
      actions.innerHTML = "";
      if (isFileAccessError) {
        const settingsBtn = document.createElement("button");
        settingsBtn.className = "error-btn";
        settingsBtn.textContent = "Open Extension Settings";
        settingsBtn.addEventListener("click", () => {
          chrome.tabs.create({ url: `chrome://extensions/?id=${chrome.runtime.id}` });
        });
        actions.appendChild(settingsBtn);
      }
      const retryBtn = document.createElement("button");
      retryBtn.className = "error-btn";
      retryBtn.style.background = "var(--surface-elevated)";
      retryBtn.style.color = "var(--ink)";
      retryBtn.textContent = "Retry";
      retryBtn.addEventListener("click", () => {
        loadPdfDocument();
      });
      actions.appendChild(retryBtn);
    }
  }
}

function hideError() {
  if (errorOverlay) errorOverlay.style.display = "none";
}

// ── Header Controls Listeners ───────────────────────────────────────────────
if (prevPageBtn) {
  prevPageBtn.addEventListener("click", () => {
    if (pdfViewer.currentPageNumber > 1) {
      pdfViewer.currentPageNumber--;
    }
  });
}

if (nextPageBtn) {
  nextPageBtn.addEventListener("click", () => {
    if (currentDocument && pdfViewer.currentPageNumber < currentDocument.numPages) {
      pdfViewer.currentPageNumber++;
    }
  });
}

if (pageNumberInput) {
  const commitPage = () => {
    const val = parseInt(pageNumberInput.value, 10);
    if (!isNaN(val) && val >= 1 && currentDocument && val <= currentDocument.numPages) {
      pdfViewer.currentPageNumber = val;
    } else {
      pageNumberInput.value = pdfViewer.currentPageNumber;
    }
  };
  pageNumberInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      commitPage();
      viewerContainer.focus();
    }
  });
  pageNumberInput.addEventListener("blur", commitPage);
}

// Zoom controls
if (zoomInBtn) {
  zoomInBtn.addEventListener("click", () => {
    pdfViewer.currentScale = pdfViewer.currentScale * 1.2;
  });
}

if (zoomOutBtn) {
  zoomOutBtn.addEventListener("click", () => {
    pdfViewer.currentScale = pdfViewer.currentScale / 1.2;
  });
}

if (scaleSelect) {
  scaleSelect.addEventListener("change", () => {
    pdfViewer.currentScaleValue = scaleSelect.value;
  });
}

// Find Controller
function triggerFind(again = false, findPrevious = false) {
  if (!findInput) return;
  const query = findInput.value.trim();
  if (!query) {
    if (findMatchCount) findMatchCount.textContent = "";
    return;
  }
  findController.executeCommand(again ? "again" : "find", {
    query,
    caseSensitive: false,
    entireWord: false,
    highlightAll: true,
    findPrevious,
  });
}

if (findInput) {
  findInput.addEventListener("input", () => triggerFind(false, false));
  findInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      triggerFind(true, e.shiftKey);
    } else if (e.key === "Escape") {
      findInput.value = "";
      findInput.blur();
      if (findMatchCount) findMatchCount.textContent = "";
      findController.executeCommand("find", { query: "" });
    }
  });
}

if (findNextBtn) findNextBtn.addEventListener("click", () => triggerFind(true, false));
if (findPrevBtn) findPrevBtn.addEventListener("click", () => triggerFind(true, true));

// Screen OCR trigger for scanned pages
function triggerOcrCapture() {
  chrome.tabs.getCurrent((tab) => {
    if (tab && tab.id) {
      chrome.runtime.sendMessage({ type: "ocr:start-tab", tabId: tab.id });
    }
  });
}

if (ocrToolBtn) ocrToolBtn.addEventListener("click", triggerOcrCapture);
if (scannedOcrBtn) scannedOcrBtn.addEventListener("click", triggerOcrCapture);

if (retryLoadBtn) retryLoadBtn.addEventListener("click", loadPdfDocument);

// Reading Ambience Theme Manager (Dark -> Sepia -> Light)
const readerThemeBtn = $("readerThemeBtn");
const themeDot = $("themeDot");
const THEMES = ["dark", "sepia", "light"];
const THEME_COLORS = {
  dark: "#facc3b",
  sepia: "#c28938",
  light: "#3b82f6",
};

function applyReaderTheme(themeName) {
  const chosen = THEMES.includes(themeName) ? themeName : "dark";
  document.body.setAttribute("data-reader-theme", chosen);
  if (themeDot) {
    themeDot.style.background = THEME_COLORS[chosen] || "#facc3b";
  }
  storageSet({ wordtap_reader_theme: chosen });
}

storageGet(["wordtap_reader_theme"], (res) => {
  if (res && res.wordtap_reader_theme) {
    applyReaderTheme(res.wordtap_reader_theme);
  }
});

if (readerThemeBtn) {
  readerThemeBtn.addEventListener("click", () => {
    const current = document.body.getAttribute("data-reader-theme") || "dark";
    const nextIdx = (THEMES.indexOf(current) + 1) % THEMES.length;
    applyReaderTheme(THEMES[nextIdx]);
  });
}

// Keyboard shortcuts for viewer navigation
window.addEventListener("keydown", (e) => {
  // If user is typing in search or page input, ignore
  if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;

  if (e.key === "ArrowLeft" || e.key === "PageUp") {
    e.preventDefault();
    if (pdfViewer.currentPageNumber > 1) pdfViewer.currentPageNumber--;
  } else if (e.key === "ArrowRight" || e.key === "PageDown") {
    e.preventDefault();
    if (currentDocument && pdfViewer.currentPageNumber < currentDocument.numPages) {
      pdfViewer.currentPageNumber++;
    }
  } else if ((e.ctrlKey || e.metaKey) && (e.key === "+" || e.key === "=")) {
    e.preventDefault();
    pdfViewer.currentScale = pdfViewer.currentScale * 1.2;
  } else if ((e.ctrlKey || e.metaKey) && e.key === "-") {
    e.preventDefault();
    pdfViewer.currentScale = pdfViewer.currentScale / 1.2;
  } else if ((e.ctrlKey || e.metaKey) && (e.key === "0")) {
    e.preventDefault();
    pdfViewer.currentScaleValue = "page-width";
  } else if ((e.ctrlKey || e.metaKey) && (e.key === "f" || e.key === "F")) {
    e.preventDefault();
    if (findInput) {
      findInput.focus();
      findInput.select();
    }
  }
});

// Start Document Load
loadPdfDocument();

/**
 * WordTap – Instant Selection Translator
 * Automatically shows a clean translation pop-up or floating icon when text
 * is selected on any webpage, with dynamic English speech pronunciation.
 */
(() => {
  const IS_WORDTAP_WEB =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.host.includes("wordtap"));

  if (IS_WORDTAP_WEB) {
    function syncSettingsFromWeb() {
      try {
        const raw = localStorage.getItem("wordtap_settings");
        if (raw && isContextValid() && chrome.storage && chrome.storage.sync) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object") {
            const updates = {};
            if (parsed.translateSaveMode) {
              updates.translateSaveMode = parsed.translateSaveMode;
              updates.saveWords = parsed.translateSaveMode !== "manual";
            }
            if (parsed.selectionMode) {
              updates.selectionMode = parsed.selectionMode;
            }
            if (parsed.targetLang) {
              updates.targetLang = parsed.targetLang;
            }
            if (Object.keys(updates).length > 0) {
              chrome.storage.sync.set(updates);
            }
          }
        }
      } catch (_) {}
    }
    syncSettingsFromWeb();

    function syncHistoryToWeb() {
      try {
        safeSendMessage({ type: "history:get" }, (res) => {
          if (!res || !Array.isArray(res.history) || res.history.length === 0) return;
          const existingRaw = localStorage.getItem("wordtap_history");
          const existing = existingRaw ? JSON.parse(existingRaw) : [];
          if (!Array.isArray(existing)) return;
          const seen = new Set(
            existing.map((h) => `${(h.text || "").toLowerCase()}|${h.target_lang || ""}`),
          );
          let changed = false;
          const merged = [...existing];
          for (const item of res.history) {
            if (!item || !item.text) continue;
            const key = `${item.text.toLowerCase()}|${item.lang || "ar"}`;
            if (seen.has(key)) continue;
            seen.add(key);
            merged.push({
              id: item.id || "ext-" + Date.now(),
              text: item.text,
              translation: item.translation || "",
              src_lang: item.src || "auto",
              target_lang: item.lang || "ar",
              source: item.source === "subtitle" ? "subtitle" : "selection",
              timestamp: item.timestamp || new Date().toISOString(),
              saved: Boolean(item.saved),
            });
            changed = true;
          }
          if (changed) {
            merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            localStorage.setItem("wordtap_history", JSON.stringify(merged.slice(0, 300)));
            window.dispatchEvent(new CustomEvent("wordtap_history_updated"));
          }
        });
      } catch (_) {}
    }
    syncHistoryToWeb();

    function syncDeletedWordsFromWeb() {
      try {
        const raw = localStorage.getItem("wordtap_deleted_words");
        if (raw && isContextValid() && chrome.storage) {
          const list = JSON.parse(raw);
          if (Array.isArray(list) && list.length > 0) {
            for (const item of list) {
              const text = typeof item === "string" ? item : item.text;
              const srcLang = typeof item === "object" ? item.srcLang : "auto";
              safeSendMessage({ type: "word:delete", text, srcLang });
            }
          }
        }
      } catch (_) {}
    }
    syncDeletedWordsFromWeb();
    window.addEventListener("wordtap_settings_changed", syncSettingsFromWeb);
    window.addEventListener("storage", (e) => {
      if (e.key === "wordtap_settings") syncSettingsFromWeb();
      if (e.key === "wordtap_deleted_words") syncDeletedWordsFromWeb();
    });
    window.addEventListener("message", (e) => {
      if (e.data && e.data.type === "wordtap:sync-settings") {
        syncSettingsFromWeb();
      }
      if (e.data && e.data.type === "wordtap:word-deleted") {
        safeSendMessage({
          type: "word:delete",
          text: e.data.text,
          srcLang: e.data.srcLang || "auto",
        });
      }
      if (e.data && e.data.type === "wordtap:history-deleted") {
        safeSendMessage({
          type: "history:delete",
          id: e.data.id,
          text: e.data.text,
          lang: e.data.targetLang,
        });
      }
      if (e.data && e.data.type === "wordtap:history-cleared") {
        safeSendMessage({ type: "history:clear" });
      }
    });
  }

  const RTL_LANGS = ["ar", "fa", "ur", "he"];
  const SUBTITLE_SELECTOR = [
    ".ytp-caption-window-container",
    ".caption-window",
    ".player-timedtext",
    ".atvwebplayersdk-captions-text",
    ".atvwebplayersdk-captions-overlay",
    ".dss-subtitle-renderer-wrapper",
    ".dss-subtitle-renderer-cue",
    '[data-purpose="captions-cue-text"]',
    ".captions-display--captions-container--P9o-a",
    ".c-video-captions-container",
    ".Transcript__cue",
    ".vjs-text-track-display"
  ].join(",");

  const SAVE_NOTES = {
    synced:       { text: "✓ Saved to your WordTap account", warn: false },
    queued:       { text: "✓ Saved · will sync when online", warn: true },
    "signed-out": { text: "✓ Saved here · sign in to sync", warn: true },
    local:        { text: "✓ Saved on this device", warn: true }
  };

  // ── Context Validity Helper (prevents "Extension context invalidated") ────
  function isContextValid() {
    try {
      return typeof chrome !== "undefined" && !!chrome.runtime && !!chrome.runtime.id;
    } catch (_) {
      return false;
    }
  }

  function safeSendMessage(msg, callback) {
    if (!isContextValid()) return;
    try {
      chrome.runtime.sendMessage(msg, (response) => {
        if (!isContextValid() || (chrome.runtime && chrome.runtime.lastError)) {
          if (callback) callback(null);
          return;
        }
        if (callback) callback(response);
      });
    } catch (_) {
      // Extension context was invalidated by reload
    }
  }

  // ── Settings ─────────────────────────────────────────────────────────────
  const settings = {
    enabled: true,
    saveWords: false,
    translateSaveMode: "manual",
    targetLang: "ar",
    selectionMode: "immediate", // "immediate" | "icon" | "alt" | "off"
  };

  let savedWordsSet = new Set();

  function normWord(w) {
    if (!w) return "";
    return w.trim().toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
  }

  function updateSavedWordsFromStorage() {
    if (!isContextValid() || !chrome.storage || !chrome.storage.local) return;
    try {
      chrome.storage.local.get({ words: {}, deleted: [] }, (data) => {
        if (!data) return;
        const deleted = Array.isArray(data.deleted) ? data.deleted.map((d) => normWord(d)) : [];
        const set = new Set();
        if (data.words && typeof data.words === "object") {
          for (const [key, item] of Object.entries(data.words)) {
            if (item && item.text) {
              const n = normWord(item.text);
              if (n && !deleted.includes(n)) set.add(n);
            }
            const parts = key.split("|");
            if (parts.length >= 3) {
              const kw = parts.slice(2).join("|");
              const n = normWord(kw);
              if (n && !deleted.includes(n)) set.add(n);
            }
          }
        }
        savedWordsSet = set;
      });
    } catch (_) {}
  }

  function isWordSaved(raw) {
    if (!raw) return false;
    const n = normWord(raw);
    return savedWordsSet.has(n) || savedWordsSet.has(raw.trim().toLowerCase());
  }

  updateSavedWordsFromStorage();

  function syncFromWebsiteStorage() {
    try {
      const cached = localStorage.getItem("wordtap_cached_words");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          for (const item of parsed) {
            if (item && item.text) {
              const n = normWord(item.text);
              if (n) savedWordsSet.add(n);
              savedWordsSet.add(item.text.trim().toLowerCase());
            }
          }
          safeSendMessage({ type: "words:save-batch", words: parsed });
        }
      }
      // Check for Supabase session in localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("sb-") && k.endsWith("-auth-token")) {
          const raw = localStorage.getItem(k);
          if (raw) {
            const session = JSON.parse(raw);
            if (session && session.access_token) {
              safeSendMessage({ type: "auth:sync-session", session });
            }
          }
        }
      }
    } catch (_) {}
  }

  syncFromWebsiteStorage();

  window.addEventListener("message", (e) => {
    if (!e.data || typeof e.data !== "object") return;
    if (e.data.type === "wordtap:words-synced" && Array.isArray(e.data.words)) {
      for (const item of e.data.words) {
        if (item && item.text) {
          const n = normWord(item.text);
          if (n) savedWordsSet.add(n);
          savedWordsSet.add(item.text.trim().toLowerCase());
        }
      }
      safeSendMessage({ type: "words:save-batch", words: e.data.words });
      if (lastEntry && isWordSaved(lastEntry.text)) {
        setSaveBtnState(true);
      }
    } else if (e.data.type === "wordtap:word-deleted" && e.data.text) {
      const n = normWord(e.data.text);
      savedWordsSet.delete(n);
      savedWordsSet.delete(e.data.text.trim().toLowerCase());
      if (lastEntry && normWord(lastEntry.text) === n) {
        setSaveBtnState(false);
      }
    }
  });

  window.addEventListener("wordtap_words_synced", (e) => {
    if (e.detail && Array.isArray(e.detail.words)) {
      for (const item of e.detail.words) {
        if (item && item.text) {
          const n = normWord(item.text);
          if (n) savedWordsSet.add(n);
          savedWordsSet.add(item.text.trim().toLowerCase());
        }
      }
      safeSendMessage({ type: "words:save-batch", words: e.detail.words });
      if (lastEntry && isWordSaved(lastEntry.text)) {
        setSaveBtnState(true);
      }
    }
  });

  window.addEventListener("wordtap:word-deleted", (e) => {
    if (e.detail && e.detail.text) {
      const n = normWord(e.detail.text);
      savedWordsSet.delete(n);
      savedWordsSet.delete(e.detail.text.trim().toLowerCase());
      if (lastEntry && normWord(lastEntry.text) === n) {
        setSaveBtnState(false);
      }
    }
  });

  if (isContextValid() && chrome.storage && chrome.storage.sync) {
    try {
      chrome.storage.sync.get(settings, (v) => {
        if (v) Object.assign(settings, v);
      });
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "sync") {
          let webChanged = false;
          for (const k in changes) {
            settings[k] = changes[k].newValue;
            if (k === "selectionMode" || k === "targetLang" || k === "translateSaveMode") {
              webChanged = true;
            }
          }
          if (!settings.enabled || settings.selectionMode === "off") {
            hideAll();
          }
          if (IS_WORDTAP_WEB && webChanged) {
            try {
              const raw = localStorage.getItem("wordtap_settings");
              const curr = raw ? JSON.parse(raw) : {};
              let dirty = false;
              for (const k of ["selectionMode", "targetLang", "translateSaveMode"]) {
                if (changes[k] && curr[k] !== changes[k].newValue) {
                  curr[k] = changes[k].newValue;
                  dirty = true;
                }
              }
              if (dirty) {
                localStorage.setItem("wordtap_settings", JSON.stringify(curr));
                window.dispatchEvent(new CustomEvent("wordtap_settings_synced_from_ext"));
              }
            } catch (_) {}
          }
        } else if (area === "local") {
          if (changes.words || changes.deleted) updateSavedWordsFromStorage();
          if (IS_WORDTAP_WEB && changes.history && typeof syncHistoryToWeb === "function") {
            syncHistoryToWeb();
          }
        }
      });
    } catch (_) {}
  }

  // ── Shadow DOM Host for Style Isolation ─────────────────────────────────
  const host = document.createElement("div");
  host.setAttribute("id", "wordtap-select-host");
  host.style.cssText = "all:initial;position:fixed;z-index:2147483647;top:0;left:0;pointer-events:none;";
  const shadow = host.attachShadow({ mode: "open" });

  shadow.innerHTML = `
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    /* Non-intrusive floating icon: discreet 28px bubble that never blocks text */
    .icon-btn {
      position: fixed;
      display: none;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #141731;
      border: 1.5px solid #facc3b;
      cursor: pointer;
      pointer-events: auto;
      box-shadow: 0 4px 16px rgba(0,0,0,0.5);
      transition: transform 0.12s ease, box-shadow 0.12s ease;
      user-select: none;
      z-index: 2147483647;
    }
    .icon-btn:hover {
      transform: scale(1.15);
      box-shadow: 0 6px 20px rgba(0,0,0,0.65);
      background: #1a1e3f;
    }
    .icon-btn svg { display: block; }

    /* Compact translation card (~50% smaller footprint so reading is never obstructed) */
    .card {
      position: fixed;
      display: none;
      flex-direction: column;
      gap: 6px;
      min-width: 210px;
      max-width: 320px;
      padding: 10px 13px 10px;
      background: rgba(14, 16, 34, 0.95);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      color: #ffffff;
      border-radius: 14px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      box-shadow: 0 16px 40px rgba(0,0,0,0.6), 0 2px 6px rgba(0,0,0,0.3);
      pointer-events: auto;
      font: 13px/1.4 -apple-system, BlinkMacSystemFont, "SF Pro Text", "Readex Pro", system-ui, sans-serif;
      animation: fadeIn 0.12s ease-out;
      user-select: text;
      z-index: 2147483647;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Draggable header row */
    .card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      cursor: grab;
      user-select: none;
      padding-right: 26px;
    }
    .orig-wrap {
      display: flex;
      align-items: center;
      gap: 4px;
      flex: 1;
      min-width: 0;
    }
    .orig {
      font-size: 13px;
      font-weight: 700;
      color: #959cc2;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 135px;
      cursor: pointer;
      border-bottom: 1px dashed rgba(149, 156, 194, 0.4);
      padding-bottom: 1px;
      transition: color 0.15s, border-color 0.15s;
    }
    .orig:hover {
      color: #ffffff;
      border-bottom-color: #facc3b;
    }
    .edit-btn {
      background: none;
      border: none;
      color: #959cc2;
      cursor: pointer;
      padding: 2px 3px;
      border-radius: 4px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      opacity: 0.65;
      transition: all 0.15s ease;
      flex: none;
    }
    .edit-btn:hover {
      opacity: 1;
      color: #facc3b;
      background: rgba(250, 204, 59, 0.15);
      transform: scale(1.1);
    }
    .orig-input {
      background: rgba(14, 16, 34, 0.95);
      border: 1px solid #facc3b;
      border-radius: 6px;
      color: #ffffff;
      font-size: 12.5px;
      font-weight: 700;
      font-family: inherit;
      padding: 2px 6px;
      outline: none;
      width: 120px;
      box-shadow: 0 0 0 2px rgba(250, 204, 59, 0.2);
    }
    .save-edit-btn {
      background: #facc3b;
      color: #12152e;
      border: none;
      border-radius: 5px;
      padding: 2px 6px;
      font-size: 11px;
      font-weight: 800;
      cursor: pointer;
      transition: background 0.12s, transform 0.1s;
      flex: none;
    }
    .save-edit-btn:hover {
      background: #ffe270;
      transform: scale(1.05);
    }

    /* Compact Dynamic Speaker Button */
    .speak-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: none;
      border: none;
      color: #facc3b;
      cursor: pointer;
      padding: 2px 3px;
      border-radius: 5px;
      flex: none;
      transition: color 0.15s, transform 0.1s, background-color 0.15s;
    }
    .speak-btn:hover {
      color: #ffe270;
      background: rgba(250, 204, 59, 0.16);
      transform: scale(1.1);
    }
    .speak-btn.speaking {
      color: #34d399;
      background: rgba(52, 211, 153, 0.18);
    }
    .speak-btn.speaking .wave-1 {
      animation: soundwave 0.5s infinite alternate ease-in-out;
    }
    .speak-btn.speaking .wave-2 {
      animation: soundwave 0.5s infinite alternate ease-in-out 0.2s;
    }
    @keyframes soundwave {
      0% { opacity: 0.2; transform: scale(0.85); }
      100% { opacity: 1; transform: scale(1.15); }
    }

    .pos-badge {
      display: none;
      align-items: center;
      gap: 3px;
      font-size: 10px;
      font-weight: 700;
      padding: 1.5px 7px;
      border-radius: 999px;
      background: rgba(250, 204, 59, 0.16);
      color: #ffd23f;
      border: 1px solid rgba(250, 204, 59, 0.35);
      letter-spacing: 0.2px;
      white-space: nowrap;
      text-transform: lowercase;
    }

    .actions-wrap {
      display: flex;
      align-items: center;
      gap: 4px;
      flex: none;
    }

    .save-btn {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      background: #facc3b;
      color: #12152e;
      border: 1px solid #d4a311;
      border-radius: 6px;
      padding: 3px 8px;
      font: 700 11.5px/1 inherit;
      cursor: pointer;
      white-space: nowrap;
      flex: none;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
      transition: background 0.12s, transform 0.1s;
    }
    .save-btn:hover { background: #ffe270; transform: scale(1.03); }
    .save-btn:disabled { opacity: 0.5; cursor: default; transform: none; }
    .save-btn.saved {
      background: rgba(52, 211, 153, 0.16) !important;
      color: #34d399 !important;
      border: 1px solid rgba(52, 211, 153, 0.35) !important;
      cursor: default !important;
      opacity: 1 !important;
      transform: none !important;
      box-shadow: none !important;
    }
    .save-btn[hidden] { display: none !important; }

    .close-btn {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 22px;
      height: 22px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: #959cc2;
      cursor: pointer;
      border-radius: 6px;
      transition: all 0.15s ease;
      padding: 0;
      z-index: 10;
    }
    .close-btn:hover {
      color: #ffffff;
      background: rgba(239, 68, 68, 0.35);
      border-color: rgba(239, 68, 68, 0.5);
      transform: scale(1.1);
    }

    .tr-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
    }

    .tr {
      font-size: 17px;
      font-weight: 700;
      word-break: break-word;
      color: #ffffff;
      line-height: 1.35;
      font-family: "Readex Pro", -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
      cursor: pointer;
      border-bottom: 1px dashed transparent;
      transition: border-bottom-color 0.15s;
    }
    .tr:hover {
      border-bottom-color: rgba(250, 204, 59, 0.4);
    }
    .tr-input {
      background: rgba(14, 16, 34, 0.95);
      border: 1px solid #facc3b;
      border-radius: 6px;
      color: #ffffff;
      font-size: 15px;
      font-weight: 700;
      font-family: "Readex Pro", system-ui, sans-serif;
      padding: 2px 6px;
      outline: none;
      flex: 1;
      min-width: 90px;
      box-shadow: 0 0 0 2px rgba(250, 204, 59, 0.2);
    }
    .tr[dir="rtl"] { text-align: right; }

    .status {
      font-size: 10.5px;
      color: #34d399;
      display: none;
      word-break: break-word;
    }
    .status[data-warn="true"] { color: #fbbf24; }

    .corr-row {
      display: none;
      align-items: center;
      gap: 6px;
      font-size: 11.5px;
      color: #cbd5e1;
      background: rgba(250, 204, 59, 0.12);
      border: 1px solid rgba(250, 204, 59, 0.3);
      padding: 3px 8px;
      border-radius: 6px;
      margin-top: 5px;
    }
    .corr-link {
      background: none;
      border: none;
      padding: 0;
      color: #ffd23f;
      font: inherit;
      font-weight: 700;
      text-decoration: underline;
      cursor: pointer;
    }
    .corr-link:hover {
      color: #ffffff;
    }
    .alts-row {
      display: none;
      flex-wrap: wrap;
      gap: 4px;
      padding-top: 2px;
    }
    .alt-chip {
      border: 1px solid rgba(255, 255, 255, 0.14);
      background: rgba(255, 255, 255, 0.06);
      color: #d1d5f0;
      border-radius: 999px;
      padding: 2px 8px;
      font-size: 11px;
      font-family: inherit;
      cursor: pointer;
      transition: all 0.12s ease;
    }
    .alt-chip:hover {
      border-color: #facc3b;
      color: #ffffff;
      background: rgba(250, 204, 59, 0.15);
    }

    /* Loading animation */
    @keyframes pulse {
      0%, 80%, 100% { opacity: 0.25; transform: scale(0.8); }
      40% { opacity: 1; transform: scale(1.1); }
    }
    .loading {
      display: inline-flex;
      gap: 4px;
      align-items: center;
      padding: 3px 0;
    }
    .dot {
      display: inline-block;
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: #ffd23f;
      animation: pulse 1.1s infinite;
    }
    .dot:nth-child(2) { animation-delay: 0.18s; }
    .dot:nth-child(3) { animation-delay: 0.36s; }

    /* Screen OCR Snipper Overlay */
    .ocr-overlay {
      position: fixed;
      inset: 0;
      width: 100vw;
      height: 100vh;
      z-index: 2147483646;
      cursor: crosshair;
      pointer-events: auto;
      user-select: none;
      background: rgba(11, 13, 30, 0.28);
    }
    .ocr-pill {
      position: fixed;
      top: 24px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 16px;
      border-radius: 999px;
      background: rgba(14, 16, 34, 0.95);
      border: 1px solid rgba(250, 204, 59, 0.4);
      color: #ffffff;
      font: 13px/1.4 -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
      box-shadow: 0 8px 24px rgba(0,0,0,0.6);
      pointer-events: none;
      z-index: 2147483647;
      animation: fadeIn 0.15s ease-out;
    }
    .ocr-pill-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: #facc3b;
      color: #0b0d1e;
      font-weight: 700;
      font-size: 11px;
      padding: 2px 7px;
      border-radius: 999px;
    }
    .ocr-box {
      position: fixed;
      display: none;
      border: 2px solid #facc3b;
      background: rgba(250, 204, 59, 0.12);
      box-shadow: 0 0 0 99999px rgba(11, 13, 30, 0.45);
      border-radius: 4px;
      pointer-events: none;
      z-index: 2147483646;
    }
  </style>

  <!-- Small floating logo icon for click mode -->
  <div class="icon-btn" id="iconBtn" title="Translate with WordTap" aria-label="Translate with WordTap">
    <svg width="16" height="12" viewBox="0 0 30 22" aria-hidden="true">
      <rect x="0.5" y="0.5" width="29" height="21" rx="5" fill="#151833" stroke="#262a52"/>
      <rect x="6" y="8" width="18" height="3" rx="1.5" fill="#fff"/>
      <rect x="9" y="14" width="12" height="2.5" rx="1.25" fill="#ffd23f"/>
    </svg>
  </div>

  <!-- Compact Translation Card -->
  <div class="card" id="card" role="dialog" aria-label="WordTap Translation">
    <button class="close-btn" id="closeBtn" title="Close (Esc)" aria-label="Close">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
    <div class="card-top" title="Drag to move card">
      <div class="orig-wrap">
        <span class="orig" id="orig" title="Click to edit word"></span>
        <input type="text" class="orig-input" id="origInput" style="display:none;" />
        <button class="edit-btn" id="editOrigBtn" title="Edit word" aria-label="Edit word">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
        <button class="save-edit-btn" id="saveEditBtn" title="Apply change" style="display:none;" aria-label="Apply change">✓</button>
        <span class="pos-badge" id="posBadge"></span>
        <button class="speak-btn" id="speakBtn" title="Pronounce in English" aria-label="Pronounce in English">
          <svg class="speaker-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path class="wave wave-1" d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
            <path class="wave wave-2" d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
          </svg>
        </button>
      </div>
      <div class="actions-wrap">
        <button class="save-btn" id="saveBtn">⭐ Save</button>
      </div>
    </div>
    <div class="tr-row">
      <div class="tr" id="tr" title="Click to edit translation"></div>
      <input type="text" class="tr-input" id="trInput" style="display:none;" />
      <button class="edit-btn" id="editTrBtn" title="Edit translation" aria-label="Edit translation">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
      </button>
      <button class="save-edit-btn" id="saveTrBtn" title="Apply change" style="display:none;" aria-label="Apply change">✓</button>
      <span class="status" id="status"></span>
    </div>
    <div class="corr-row" id="corrRow"></div>
    <div class="alts-row" id="altsRow"></div>
  </div>
  `;

  const iconBtn  = shadow.getElementById("iconBtn");
  const card     = shadow.getElementById("card");
  const origEl   = shadow.getElementById("orig");
  const origInput = shadow.getElementById("origInput");
  const editOrigBtn = shadow.getElementById("editOrigBtn");
  const saveEditBtn = shadow.getElementById("saveEditBtn");
  const speakBtn = shadow.getElementById("speakBtn");
  const trEl     = shadow.getElementById("tr");
  const trInput  = shadow.getElementById("trInput");
  const editTrBtn = shadow.getElementById("editTrBtn");
  const saveTrBtn = shadow.getElementById("saveTrBtn");
  const statusEl = shadow.getElementById("status");
  const saveBtn  = shadow.getElementById("saveBtn");
  const closeBtn = shadow.getElementById("closeBtn");
  const posBadge = shadow.getElementById("posBadge");
  const corrEl   = shadow.getElementById("corrRow");
  const altsEl   = shadow.getElementById("altsRow");

  const POS_LABELS = {
    noun: "noun · اسم",
    verb: "verb · فعل",
    adjective: "adj · صفة",
    adverb: "adv · ظرف",
    pronoun: "pron · ضمير",
    preposition: "prep · حرف جر",
    conjunction: "conj · حرف عطف",
    interjection: "interj · تعجب",
    phrase: "phrase · عبارة",
    idiom: "idiom · مصطلح",
    past: "past · ماضي",
    present: "present · مضارع",
    past_participle: "past part. · تصريف ثالث",
    continuous: "continuous · مستمر",
  };

  let tipToken = 0;
  let lastEntry = null;
  let lastText = "";
  let pendingTranslation = null;
  let debounceTimer = null;

  function mount() {
    const parent = document.fullscreenElement || document.body || document.documentElement;
    if (parent) {
      parent.appendChild(host);
    }
  }

  function hideAll() {
    clearTimeout(debounceTimer);
    iconBtn.style.display = "none";
    card.style.display    = "none";
    speakBtn.classList.remove("speaking");
    origInput.style.display = "none";
    saveEditBtn.style.display = "none";
    origEl.style.display = "";
    editOrigBtn.style.display = "";
    trInput.style.display = "none";
    saveTrBtn.style.display = "none";
    trEl.style.display = "";
    editTrBtn.style.display = "";
    lastEntry = null;
    lastText = "";
    pendingTranslation = null;
  }

  function setStatus(text, warn) {
    statusEl.textContent = text;
    statusEl.dataset.warn = String(Boolean(warn));
    statusEl.style.display = text ? "block" : "none";
  }

  const LANG_VOICES = {
    de: "de-DE",
    en: "en-US",
    fr: "fr-FR",
    es: "es-ES",
    it: "it-IT",
    pt: "pt-PT",
    tr: "tr-TR",
    ru: "ru-RU",
    ar: "ar-SA",
    ja: "ja-JP",
    ko: "ko-KR",
    zh: "zh-CN"
  };

  let lastSrcLang = "en";

  // ── Dynamic Text-to-Speech with Remote Audio Fallback ──────────────────────
  function playRemoteTts(text, code) {
    safeSendMessage({ type: "tts:speak", text, lang: code }, (res) => {
      if (!res || !res.ok || !res.dataUrl) {
        speakBtn.classList.remove("speaking");
        return;
      }
      try {
        const audio = new Audio(res.dataUrl);
        audio.onended = () => speakBtn.classList.remove("speaking");
        audio.onerror = () => speakBtn.classList.remove("speaking");
        audio.play().catch(() => speakBtn.classList.remove("speaking"));
      } catch (_) {
        speakBtn.classList.remove("speaking");
      }
    });
  }

  function speakWord(text, lang) {
    if (!text) return;
    const clean = text.replace(/<[^>]+>/g, "").trim();
    if (!clean) return;
    const code = (lang && lang !== "auto" ? lang : lastSrcLang || "en").toLowerCase().slice(0, 2);
    speakBtn.classList.add("speaking");

    if (!("speechSynthesis" in window)) {
      playRemoteTts(clean, code);
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const voices = window.speechSynthesis.getVoices();
      const voice = voices.find((v) => v.lang.toLowerCase().startsWith(code) && !v.localService) ||
                    voices.find((v) => v.lang.toLowerCase().startsWith(code));

      if (!voice && voices.length > 0) {
        playRemoteTts(clean, code);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.lang = LANG_VOICES[code] || "en-US";
      utterance.rate = 0.92;
      if (voice) utterance.voice = voice;

      utterance.onend = () => speakBtn.classList.remove("speaking");
      utterance.onerror = () => playRemoteTts(clean, code);

      window.speechSynthesis.speak(utterance);
    } catch (_) {
      playRemoteTts(clean, code);
    }
  }

  speakBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (lastText) {
      speakWord(lastText, lastSrcLang);
    }
  });

  // ── Position Floating Icon: Sits cleanly at top-right of selection without blocking text ──
  function positionIcon(rect) {
    iconBtn.style.display = "flex";
    const padding = 8;
    let left = rect.right + 6;
    let top = rect.top - 12;

    if (left + 32 > window.innerWidth - padding) {
      left = Math.max(padding, rect.left - 34);
    }
    if (top < padding) {
      top = rect.bottom + 6;
    }
    iconBtn.style.left = Math.round(left) + "px";
    iconBtn.style.top  = Math.round(top)  + "px";
  }

  // ── Position Translation Card: Places cleanly below selection so other tools & reading are not blocked ──
  function positionCard(rect) {
    mount();
    currentCardRect = rect;
    card.style.display = "flex";
    const r = card.getBoundingClientRect();
    const padding = 12;

    // Horizontal: center on selection, keep within viewport margins
    let left = rect.left + rect.width / 2 - r.width / 2;
    if (left < padding) left = padding;
    if (left + r.width > window.innerWidth - padding) {
      left = window.innerWidth - padding - r.width;
    }

    // Vertical: Prefer cleanly BELOW selection (avoids colliding with extensions like Google Dictionary)
    let top = rect.bottom + 8;

    // If not enough room below, place above selection
    if (top + r.height > window.innerHeight - padding) {
      top = rect.top - r.height - 8;
    }
    // Clamp inside window
    if (top < padding) top = padding;
    if (top + r.height > window.innerHeight - padding) {
      top = Math.max(padding, window.innerHeight - padding - r.height);
    }

    card.style.left = Math.round(left) + "px";
    card.style.top  = Math.round(top)  + "px";
  }

  // ── Make Card Draggable so User can Slide it Anywhere ──────────────────────
  let currentCardRect = null;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let cardInitialLeft = 0;
  let cardInitialTop = 0;

  const cardTop = shadow.querySelector(".card-top");
  if (cardTop) {
    cardTop.addEventListener("mousedown", (e) => {
      if (e.target.closest("button") || e.target.closest("input") || e.target.closest(".orig")) return;
      isDragging = true;
      cardTop.style.cursor = "grabbing";
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      cardInitialLeft = parseInt(card.style.left, 10) || 0;
      cardInitialTop = parseInt(card.style.top, 10) || 0;
      e.preventDefault();
    });

    window.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      card.style.left = Math.round(cardInitialLeft + dx) + "px";
      card.style.top  = Math.round(cardInitialTop + dy)  + "px";
    });

    window.addEventListener("mouseup", () => {
      if (isDragging) {
        isDragging = false;
        cardTop.style.cursor = "grab";
      }
    });
  }

  function setSaveBtnState(saved) {
    if (saved) {
      saveBtn.classList.add("saved");
      saveBtn.disabled = true;
      saveBtn.innerHTML = `✓ Saved`;
      saveBtn.style.background = "rgba(52, 211, 153, 0.2)";
      saveBtn.style.color = "#34d399";
      saveBtn.style.borderColor = "rgba(52, 211, 153, 0.4)";
      saveBtn.style.cursor = "default";
      saveBtn.title = "Already saved in your words";
    } else {
      saveBtn.classList.remove("saved");
      saveBtn.disabled = false;
      saveBtn.innerHTML = `⭐ Save`;
      saveBtn.style.background = "#facc3b";
      saveBtn.style.color = "#12152e";
      saveBtn.style.borderColor = "#d4a311";
      saveBtn.style.cursor = "pointer";
      saveBtn.title = "Save to My Words";
    }
  }

  function showLoadingCard(rect, text) {
    mount();
    currentCardRect = rect;
    origInput.style.display = "none";
    saveEditBtn.style.display = "none";
    origEl.style.display = "";
    editOrigBtn.style.display = "";
    trInput.style.display = "none";
    saveTrBtn.style.display = "none";
    trEl.style.display = "";
    editTrBtn.style.display = "";
    origEl.textContent = text.length > 70 ? text.slice(0, 67) + "…" : text;
    posBadge.style.display = "none";
    corrEl.style.display = "none";
    corrEl.innerHTML = "";
    altsEl.style.display = "none";
    altsEl.innerHTML = "";
    trEl.innerHTML = `<span class="loading"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span>`;
    setStatus("", false);
    saveBtn.hidden   = true;
    setSaveBtnState(false);
    positionCard(rect);
  }

  function renderTranslationExtras(rect, extras = {}) {
    corrEl.innerHTML = "";
    if (extras.correction && extras.correction.toLowerCase() !== lastText.trim().toLowerCase()) {
      corrEl.style.display = "flex";
      const icon = document.createElement("span");
      icon.textContent = "💡";
      const label = document.createElement("span");
      label.textContent = "Did you mean:";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "corr-link";
      btn.textContent = extras.correction;
      btn.title = `Switch to correct word: "${extras.correction}"`;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        triggerTranslation(rect, extras.correction, "");
      });
      corrEl.append(icon, label, btn);
    } else {
      corrEl.style.display = "none";
    }

    altsEl.innerHTML = "";
    const alts = Array.isArray(extras.alternatives) ? extras.alternatives : [];
    if (alts.length > 0) {
      altsEl.style.display = "flex";
      for (const alt of alts) {
        if (!alt || alt === trEl.textContent) continue;
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "alt-chip";
        chip.textContent = alt;
        chip.title = "Use this translation";
        chip.addEventListener("click", (e) => {
          e.stopPropagation();
          trEl.textContent = alt;
          if (lastEntry) {
            lastEntry.translation = alt;
            if (saveBtn.hidden || saveBtn.classList.contains("saved")) {
              setSaveBtnState(false);
              saveBtn.hidden = false;
            }
          }
        });
        altsEl.appendChild(chip);
      }
      if (!altsEl.children.length) altsEl.style.display = "none";
    } else {
      altsEl.style.display = "none";
    }
  }

  function finaliseCard(rect, translated, rtl, entry, extras = {}) {
    trEl.textContent = translated;
    trEl.dir = rtl ? "rtl" : "ltr";
    lastEntry = entry;
    renderTranslationExtras(rect, extras);

    // Always record to translation history
    safeSendMessage({ type: "history:add", entry });

    const willSave =
      settings.translateSaveMode === "auto" ||
      (settings.saveWords === true &&
        settings.translateSaveMode !== "manual" &&
        settings.translateSaveMode !== "subtitles_only");

    const alreadySaved = isWordSaved(entry.text);

    if (willSave) {
      if (alreadySaved) {
        saveBtn.hidden = true;
        setStatus("✓ In your words", false);
      } else {
        saveBtn.hidden = true;
        setStatus("Saving…", false);
        doSave(entry);
      }
    } else {
      saveBtn.hidden = false;
      setSaveBtnState(alreadySaved);
      setStatus("", false);

      // Also verify asynchronously with background DB in case local storage is syncing
      safeSendMessage({ type: "word:is-saved", text: entry.text }, (res) => {
        if (!isContextValid() || !lastEntry || lastEntry.text !== entry.text) return;
        if (res && res.saved) {
          savedWordsSet.add(normWord(entry.text));
          if (!willSave) {
            setSaveBtnState(true);
          } else {
            setStatus("✓ In your words", false);
          }
        }
      });
    }

    positionCard(rect);
  }

  function doSave(entry, token) {
    if (!isContextValid()) return;
    const currentToken = token ?? tipToken;
    safeSendMessage({ type: "save", entry }, (saved) => {
      if (!isContextValid() || currentToken !== tipToken) return;
      if (!saved || !saved.ok) {
        setStatus("Could not save word", true);
        return;
      }
      savedWordsSet.add(normWord(entry.text));
      const note = SAVE_NOTES[saved.cloud] || SAVE_NOTES.local;
      setStatus(note.text, note.warn);
      saveBtn.hidden = true;
    });
  }

  const GERMAN_PATTERN = /\b(ich|du|er|sie|es|wir|ihr|der|die|das|den|dem|des|ein|eine|einer|einem|einen|eines|nicht|ist|sind|war|waren|wird|werden|und|oder|aber|denn|doch|weil|dass|wenn|wie|auch|noch|nach|bei|von|mit|zu|im|am|an|auf|für|über|unter|vor|sehr|hier|da|dort|jetzt|immer|nie|etwas|alles|nichts|man|sich|haben|hat|hatte|hatten)\b|[äöüßÄÖÜ]/i;
  const ENGLISH_PATTERN = /\b(the|is|are|was|were|have|has|had|with|this|that|these|those|they|their|them|from|what|when|where|which|who|will|would|could|should|about|into|more|some|there|then|than|out|up|down|only|other|time|people|your|you)\b/i;

  function detectContextLanguage(text, context) {
    const pageLang = (document.documentElement.lang || "").toLowerCase().slice(0, 2);
    if (pageLang === "de" || pageLang === "en") return pageLang;

    const sample = (context || text || "");
    const deMatch = (sample.match(new RegExp(GERMAN_PATTERN, "gi")) || []).length;
    const enMatch = (sample.match(new RegExp(ENGLISH_PATTERN, "gi")) || []).length;
    if (deMatch > enMatch && deMatch >= 1) return "de";
    if (enMatch > deMatch && enMatch >= 1) return "en";
    return pageLang || "auto";
  }

  function triggerTranslation(rect, text, context = "") {
    if (!isContextValid()) return;
    lastText = text;
    const target = settings.targetLang;
    const token = ++tipToken;
    showLoadingCard(rect, text);

    const detectedSrc = detectContextLanguage(text, context);

    safeSendMessage({ type: "translate", text, target, srcLang: detectedSrc, context }, (res) => {
      if (!isContextValid() || token !== tipToken) return;
      if (!res || !res.ok) {
        trEl.textContent = "Translation failed";
        saveBtn.hidden   = true;
        positionCard(rect);
        return;
      }

      lastSrcLang = res.src || (detectedSrc !== "auto" ? detectedSrc : "en");
      speakBtn.title = `Listen pronunciation (${lastSrcLang.toUpperCase()})`;

      if (res.pos) {
        posBadge.textContent = POS_LABELS[res.pos.toLowerCase()] || res.pos;
        posBadge.style.display = "inline-flex";
      } else {
        posBadge.style.display = "none";
      }

      let surrounding = "";
      try {
        const sel = window.getSelection();
        if (sel && sel.anchorNode) {
          const parentText = sel.anchorNode.textContent || "";
          if (parentText.length > text.length && parentText.length < 200) {
            surrounding = parentText.trim();
          }
        }
      } catch (_) {}

      const titleContext =
        surrounding && surrounding.length > text.length
          ? `"${surrounding}" — ${document.title}`
          : document.title;

      const entry = {
        text,
        translation: res.text,
        lang: target,
        src: res.src,
        page: location.href,
        title: titleContext,
        sentence: surrounding,
        source: "selection",
      };
      finaliseCard(rect, res.text, RTL_LANGS.includes(target), entry, {
        alternatives: res.alternatives,
        correction: res.correction,
      });
    });
  }

  // ── Event Handlers ────────────────────────────────────────────────────────
  saveBtn.addEventListener("click", () => {
    if (!lastEntry || saveBtn.disabled || saveBtn.classList.contains("saved")) return;
    saveBtn.disabled = true;
    saveBtn.innerHTML = `Saving…`;
    setStatus("Saving…", false);
    safeSendMessage({ type: "save", entry: lastEntry }, (saved) => {
      if (!isContextValid()) return;
      if (!saved || !saved.ok) {
        setStatus("Could not save word", true);
        setSaveBtnState(false);
        return;
      }
      const note = SAVE_NOTES[saved.cloud] || SAVE_NOTES.local;
      setStatus(note.text, note.warn);
      setSaveBtnState(true);
      savedWordsSet.add(normWord(lastEntry.text));
    });
  });

  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    hideAll();
  });

  // ── Inline Edit Handlers: Edit Word or Translation on Click / Pencil ─────
  function enterOrigEdit() {
    origEl.style.display = "none";
    editOrigBtn.style.display = "none";
    posBadge.style.display = "none";
    origInput.style.display = "inline-block";
    saveEditBtn.style.display = "inline-flex";
    origInput.value = lastText || origEl.textContent || "";
    origInput.focus();
    origInput.select();
  }

  function exitOrigEdit(apply) {
    const newText = origInput.value.trim();
    origInput.style.display = "none";
    saveEditBtn.style.display = "none";
    origEl.style.display = "";
    editOrigBtn.style.display = "";
    if (posBadge.textContent && posBadge.textContent.trim()) {
      posBadge.style.display = "inline-flex";
    }

    if (apply && newText && newText !== lastText) {
      const rect = currentCardRect || card.getBoundingClientRect();
      triggerTranslation(rect, newText, lastEntry?.sentence || "");
    }
  }

  origEl.addEventListener("click", (e) => {
    e.stopPropagation();
    enterOrigEdit();
  });
  editOrigBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    enterOrigEdit();
  });
  saveEditBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    exitOrigEdit(true);
  });
  origInput.addEventListener("click", (e) => e.stopPropagation());
  origInput.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      exitOrigEdit(true);
    } else if (e.key === "Escape") {
      e.preventDefault();
      exitOrigEdit(false);
    }
  });

  function enterTrEdit() {
    trEl.style.display = "none";
    editTrBtn.style.display = "none";
    trInput.style.display = "inline-block";
    saveTrBtn.style.display = "inline-flex";
    trInput.value = trEl.textContent || "";
    trInput.dir = trEl.dir || "rtl";
    trInput.focus();
    trInput.select();
  }

  function exitTrEdit(apply) {
    const newTr = trInput.value.trim();
    trInput.style.display = "none";
    saveTrBtn.style.display = "none";
    trEl.style.display = "";
    editTrBtn.style.display = "";

    if (apply && newTr && newTr !== trEl.textContent && lastEntry) {
      trEl.textContent = newTr;
      lastEntry.translation = newTr;
      safeSendMessage({ type: "history:add", entry: lastEntry });
      setStatus("Saving…", false);
      safeSendMessage({ type: "save", entry: lastEntry }, (saved) => {
        if (!isContextValid()) return;
        if (saved && saved.ok) {
          savedWordsSet.add(normWord(lastEntry.text));
          const note = SAVE_NOTES[saved.cloud] || SAVE_NOTES.local;
          setStatus(note.text, note.warn);
          setSaveBtnState(true);
        } else {
          setStatus("Could not save word", true);
        }
      });
    }
  }

  trEl.addEventListener("click", (e) => {
    e.stopPropagation();
    enterTrEdit();
  });
  editTrBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    enterTrEdit();
  });
  saveTrBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    exitTrEdit(true);
  });
  trInput.addEventListener("click", (e) => e.stopPropagation());
  trInput.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      exitTrEdit(true);
    } else if (e.key === "Escape") {
      e.preventDefault();
      exitTrEdit(false);
    }
  });

  iconBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    iconBtn.style.display = "none";
    if (!pendingTranslation) return;
    const { rect, text, context } = pendingTranslation;
    triggerTranslation(rect, text, context);
  });

  function isIgnoredElement(target) {
    if (!target) return false;
    return !!(
      target.closest("input, textarea, [contenteditable='true'], [contenteditable='']") ||
      target.closest(SUBTITLE_SELECTOR)
    );
  }

  function handleSelection(e) {
    if (!isContextValid()) return;
    if (!settings.enabled) return;

    let mode = settings.selectionMode || "immediate";
    if (mode === "off") return;

    // Alt key mode: only trigger if user is holding Alt / Option
    if (mode === "alt" && !(e && (e.altKey || e.metaKey))) {
      return;
    }

    if (e && e.composedPath && e.composedPath().includes(host)) return;
    if (e && isIgnoredElement(e.target)) return;

    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;

    const text = sel.toString().trim();
    if (!text || text.length === 0) return;
    if (text === lastText && (card.style.display === "flex" || iconBtn.style.display === "flex")) {
      return;
    }

    let rect = null;
    try {
      const range = sel.getRangeAt(0);
      const r = range.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        rect = r;
      }
    } catch (_) {}

    if (!rect) {
      const x = e ? e.clientX : window.innerWidth / 2;
      const y = e ? e.clientY : window.innerHeight / 2;
      rect = { left: x - 10, right: x + 10, top: y - 10, bottom: y + 10, width: 20, height: 20 };
    }

    let context = "";
    try {
      const container = sel.anchorNode?.parentElement;
      context = container?.innerText?.slice(0, 300) || "";
    } catch (_) {}

    mount();

    if (mode === "icon") {
      pendingTranslation = { rect, text, context };
      card.style.display = "none";
      positionIcon(rect);
    } else {
      pendingTranslation = null;
      iconBtn.style.display = "none";
      triggerTranslation(rect, text, context);
    }
  }

  document.addEventListener("mouseup", (e) => {
    if (e.composedPath().includes(host)) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      handleSelection(e);
    }, 150);
  });

  document.addEventListener("mousedown", (e) => {
    if (!e.composedPath().includes(host)) {
      hideAll();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      hideAll();
    } else if (e.altKey && (e.key === "s" || e.key === "S")) {
      e.preventDefault();
      startOcrSnip();
    }
  });

  // Automatically tuck away floating icon when scrolling chat messages or page
  window.addEventListener(
    "scroll",
    () => {
      if (iconBtn.style.display === "flex") {
        hideAll();
      }
    },
    { passive: true },
  );

  document.addEventListener("selectionchange", () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      if (iconBtn.style.display === "flex") {
        hideAll();
      }
    }
  });

  // ── Screen OCR Snipping & Translation ─────────────────────────────────────
  let activeOcrOverlay = null;

  function startOcrSnip() {
    if (activeOcrOverlay) return;
    mount();
    hideAll();

    // Ensure host spans the full viewport to direct interactions to the snipper overlay
    host.style.width = "100vw";
    host.style.height = "100vh";

    const overlay = document.createElement("div");
    overlay.className = "ocr-overlay";

    const pill = document.createElement("div");
    pill.className = "ocr-pill";
    pill.innerHTML = `
      <span class="ocr-pill-badge">📸 OCR</span>
      <span>Drag a box over any text, subtitle or image to translate</span>
      <span style="opacity:0.65;font-size:11px;margin-left:4px;">(Esc to cancel)</span>
    `;

    const box = document.createElement("div");
    box.className = "ocr-box";

    overlay.appendChild(pill);
    overlay.appendChild(box);
    shadow.appendChild(overlay);
    activeOcrOverlay = overlay;

    let isSelecting = false;
    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let currentY = 0;

    function cleanup() {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("mousedown", onMouseDown, true);
      window.removeEventListener("mousemove", onMouseMove, true);
      window.removeEventListener("mouseup", onMouseUp, true);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (activeOcrOverlay === overlay) activeOcrOverlay = null;
      host.style.width = "0";
      host.style.height = "0";
    }

    function onKeyDown(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        cleanup();
      }
    }

    function onMouseDown(e) {
      if (e.button !== 0) {
        cleanup();
        return;
      }
      isSelecting = true;
      startX = e.clientX;
      startY = e.clientY;
      currentX = e.clientX;
      currentY = e.clientY;
      box.style.display = "block";
      box.style.left = startX + "px";
      box.style.top = startY + "px";
      box.style.width = "0px";
      box.style.height = "0px";
      e.preventDefault();
      e.stopPropagation();
    }

    function onMouseMove(e) {
      if (!isSelecting) return;
      currentX = e.clientX;
      currentY = e.clientY;

      const left = Math.min(startX, currentX);
      const top = Math.min(startY, currentY);
      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);

      box.style.left = left + "px";
      box.style.top = top + "px";
      box.style.width = width + "px";
      box.style.height = height + "px";
    }

    function onMouseUp(e) {
      if (!isSelecting) {
        cleanup();
        return;
      }
      isSelecting = false;

      const left = Math.min(startX, currentX);
      const top = Math.min(startY, currentY);
      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);

      cleanup();

      if (width < 10 || height < 10) {
        return; // Selection too small or just a stray click
      }

      const rect = {
        left,
        top,
        right: left + width,
        bottom: top + height,
        width,
        height,
      };

      // Show loading card at the snippet location
      showLoadingCard(rect, "📸 Scanning text…");
      trEl.innerHTML = `<span class="loading"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span> <span style="font-size:12px;color:#959cc2;margin-left:5px;">Scanning text & translating…</span>`;

      // Wait a microtick so overlay is gone before captureVisibleTab
      setTimeout(() => {
        safeSendMessage({ type: "ocr:capture-screen" }, (capRes) => {
          if (!isContextValid()) return;
          if (!capRes || !capRes.ok || !capRes.dataUrl) {
            trEl.textContent = capRes?.error || "Screen capture failed";
            saveBtn.hidden = true;
            positionCard(rect);
            return;
          }

          const img = new Image();
          img.onload = () => {
            try {
              const scaleX = img.naturalWidth / window.innerWidth;
              const scaleY = img.naturalHeight / window.innerHeight;

              const cropX = Math.round(left * scaleX);
              const cropY = Math.round(top * scaleY);
              const cropW = Math.round(width * scaleX);
              const cropH = Math.round(height * scaleY);

              const canvas = document.createElement("canvas");
              canvas.width = Math.max(1, cropW);
              canvas.height = Math.max(1, cropH);
              const ctx = canvas.getContext("2d");
              ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
              const croppedDataUrl = canvas.toDataURL("image/png");

              safeSendMessage(
                {
                  type: "ocr:process",
                  image: croppedDataUrl,
                  target: settings.targetLang,
                },
                (ocrRes) => {
                  if (!isContextValid()) return;
                  if (!ocrRes || !ocrRes.ok || !ocrRes.text) {
                    trEl.textContent =
                      ocrRes && ocrRes.error
                        ? ocrRes.error
                        : "No text found in selected area";
                    saveBtn.hidden = true;
                    positionCard(rect);
                    return;
                  }

                  const cleanText = ocrRes.text.trim();
                  origEl.textContent =
                    cleanText.length > 70 ? cleanText.slice(0, 67) + "…" : cleanText;
                  lastText = cleanText;
                  lastSrcLang = ocrRes.src || "en";
                  speakBtn.title = `Listen pronunciation (${lastSrcLang.toUpperCase()})`;

                  if (ocrRes.pos) {
                    posBadge.textContent = POS_LABELS[ocrRes.pos.toLowerCase()] || ocrRes.pos;
                    posBadge.style.display = "inline-flex";
                  } else {
                    posBadge.style.display = "none";
                  }

                  const entry = {
                    text: cleanText,
                    translation: ocrRes.translation,
                    lang: settings.targetLang,
                    src: ocrRes.src || "en",
                    page: location.href,
                    title: `[OCR] ${document.title}`,
                    sentence: cleanText,
                    source: "selection",
                  };

                  finaliseCard(
                    rect,
                    ocrRes.translation,
                    RTL_LANGS.includes(settings.targetLang),
                    entry,
                    {
                      alternatives: ocrRes.alternatives,
                      correction: ocrRes.correction,
                    },
                  );
                },
              );
            } catch (err) {
              trEl.textContent = "OCR processing error";
              saveBtn.hidden = true;
              positionCard(rect);
            }
          };

          img.onerror = () => {
            trEl.textContent = "Failed to load screenshot image";
            saveBtn.hidden = true;
            positionCard(rect);
          };

          img.src = capRes.dataUrl;
        });
      }, 50);
    }

    window.addEventListener("mousedown", onMouseDown, true);
    window.addEventListener("mousemove", onMouseMove, true);
    window.addEventListener("mouseup", onMouseUp, true);
    window.addEventListener("keydown", onKeyDown, true);
  }

  // Listen for OCR or right-click translate messages from background script or popup
  if (isContextValid() && chrome.runtime && chrome.runtime.onMessage) {
    try {
      chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
        if (msg && msg.type === "ocr:start-snip") {
          startOcrSnip();
          if (sendResponse) sendResponse({ ok: true });
          return true;
        }
        if (msg && msg.type === "wordtap:translate-context" && msg.text) {
          let rect = {
            left: Math.max(16, window.innerWidth / 2 - 110),
            right: Math.min(window.innerWidth - 16, window.innerWidth / 2 + 110),
            top: 84,
            bottom: 112,
          };
          try {
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
              const r = sel.getRangeAt(0).getBoundingClientRect();
              if (r && (r.width > 0 || r.height > 0)) rect = r;
            }
          } catch (_) {}
          triggerTranslation(rect, msg.text, "");
          if (sendResponse) sendResponse({ ok: true });
          return true;
        }
      });
    } catch (_) {}
  }
})();

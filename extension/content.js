(() => {
  // Containers that hold subtitles on supported streaming & learning platforms.
  // Uses broad, resilient class matching and ARIA attributes to prevent breaks from platform DOM restructuring.
  const SUBTITLE_SELECTOR = [
    // YouTube
    ".ytp-caption-window-container",
    ".caption-window",
    '[class*="caption-window"]',
    '[class*="ytp-caption"]',
    // Netflix
    ".player-timedtext",
    '[class*="player-timedtext"]',
    // Amazon Prime Video
    ".atvwebplayersdk-captions-text",
    ".atvwebplayersdk-captions-overlay",
    '[class*="atvwebplayersdk-captions"]',
    // Disney+
    ".dss-subtitle-renderer-wrapper",
    ".dss-subtitle-renderer-cue",
    '[class*="dss-subtitle"]',
    // Udemy
    '[data-purpose="captions-cue-text"]',
    ".captions-display--captions-container--P9o-a",
    '[class*="captions-display--captions-container"]',
    // Coursera
    ".c-video-captions-container",
    '[class*="c-video-captions"]',
    // TED
    ".Transcript__cue",
    '[class*="Transcript__cue"]',
    // Generic video players: Video.js, JWPlayer, Shaka Player, Bitmovin, HTML5
    ".vjs-text-track-display",
    '[class*="vjs-text-track"]',
    '[class*="jw-text-track"]',
    '[class*="shaka-text-container"]',
    '[class*="bmpui-ui-subtitle-overlay"]',
    // BBC Video Player & SMP Subtitles
    ".smp-subtitles",
    ".smp-subtitles-container",
    '[class*="subtitles-container"]',
    '[class*="subtitles-cue"]',
    '[class*="smp-subtitles"]',
    '[class*="gel-video-subtitles"]',
    '[data-bbc-container="subtitles"]',
    "smp-toucan-player",
    // Semantic ARIA cue containers
    '[aria-label*="captions" i]',
    '[aria-label*="subtitles" i]',
  ].join(",");

  const WORD_CHAR = /[\p{L}\p{M}\p{N}'’-]/u;
  const RTL_LANGS = ["ar", "fa", "ur", "he"];

  // What the tooltip says about where a saved word went.
  const SAVE_NOTES = {
    synced: { text: "✓ Saved to your WordTap account", warn: false },
    queued: { text: "✓ Saved · will sync when online", warn: true },
    "signed-out": { text: "Failed to save · Please sign in to WordTap", warn: true },
    local: { text: "Failed to save · Please sign in to WordTap", warn: true },
  };

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
    } catch (_) {}
  }

  // ---------- Settings ----------
  const settings = {
    enabled: true, // master switch
    saveWords: false, // keep every translated word
    translateSaveMode: "manual",
    targetLang: "ar",
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

  // Storage listener for cross-tab sync from extension storage

  if (isContextValid() && chrome.storage && chrome.storage.sync) {
    try {
      chrome.storage.sync.get(settings, (v) => Object.assign(settings, v));
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "sync") {
          for (const k in changes) settings[k] = changes[k].newValue;
          if (!settings.enabled) hideTip();
        } else if (area === "local" && (changes.words || changes.deleted)) {
          updateSavedWordsFromStorage();
        }
      });
    } catch (_) {}
  }

  // ---------- Tooltip (Shadow DOM so page CSS can't break it) ----------
  const host = document.createElement("div");
  host.style.cssText = "all:initial;position:fixed;z-index:2147483647;top:0;left:0;";
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      .tip{position:fixed;display:none;max-width:320px;min-width:140px;padding:12px 14px;
        background:rgba(14, 16, 34, 0.94);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);color:#ffffff;
        border-radius:14px;font:13.5px/1.4 -apple-system,BlinkMacSystemFont,"SF Pro Text","Readex Pro",system-ui,sans-serif;
        box-shadow:0 12px 36px rgba(0,0,0,.55), 0 2px 6px rgba(0,0,0,.3);border:1px solid rgba(255,255,255,0.12);pointer-events:auto;
        animation:tipFadeIn 0.12s ease-out}
      @keyframes tipFadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
      .orig-line{display:flex;align-items:center;gap:4px;margin-bottom:5px;padding-right:16px}
      .orig{color:#959cc2;font-size:12px;font-weight:600;word-break:break-word;cursor:pointer;border-bottom:1px dashed rgba(149,156,194,0.4);padding-bottom:1px;transition:color .12s,border-color .12s}
      .orig:hover{color:#ffffff;border-bottom-color:#facc3b}
      .orig-input{background:rgba(14,16,34,0.95);border:1px solid #facc3b;border-radius:5px;color:#ffffff;font-size:11.5px;font-weight:600;padding:1px 5px;outline:none;width:105px}
      .edit-btn{background:none;border:none;color:#959cc2;cursor:pointer;padding:1px 3px;border-radius:3px;display:inline-flex;align-items:center;opacity:0.65;transition:all .12s}
      .edit-btn:hover{opacity:1;color:#facc3b;background:rgba(250,204,59,0.15)}
      .save-edit-btn{background:#facc3b;color:#12152e;border:none;border-radius:4px;padding:1px 5px;font-size:10.5px;font-weight:700;cursor:pointer;transition:background .12s}
      .save-edit-btn:hover{background:#ffe270}
      .pos-badge{display:none;align-items:center;gap:3px;font-size:9.5px;font-weight:700;padding:1px 6px;border-radius:999px;background:rgba(250,204,59,.15);color:#ffd23f;border:1px solid rgba(250,204,59,.35);white-space:nowrap;text-transform:lowercase}
      .spk-btn{background:none;border:none;color:#facc3b;cursor:pointer;padding:2px 4px;border-radius:5px;display:inline-flex;align-items:center;transition:transform .1s,color .1s}
      .spk-btn:hover{color:#ffe270;transform:scale(1.15)}
      .spk-btn.speaking{color:#facc3b}
      .tr-line{display:flex;align-items:center;gap:6px}
      .tr{font-size:18px;font-weight:700;color:#ffffff;word-break:break-word;font-family:"Readex Pro",-apple-system,BlinkMacSystemFont,system-ui,sans-serif;line-height:1.4;cursor:pointer;border-bottom:1px dashed transparent;transition:border-color .15s}
      .tr:hover{border-bottom-color:rgba(250,204,59,0.4)}
      .tr[dir=rtl]{text-align:right}
      .tr-input{background:rgba(14,16,34,0.95);border:1px solid #facc3b;border-radius:5px;color:#ffffff;font-size:15px;font-weight:700;font-family:"Readex Pro",system-ui,sans-serif;padding:2px 6px;outline:none;width:125px}
      .corr-row{display:none;align-items:center;gap:5px;font-size:11px;color:#cbd5e1;background:rgba(250,204,59,0.12);border:1px solid rgba(250,204,59,0.3);padding:3px 8px;border-radius:6px;margin-top:5px}
      .corr-link{background:none;border:none;padding:0;color:#facc3b;font:inherit;font-weight:700;text-decoration:underline;cursor:pointer}
      .corr-link:hover{color:#ffffff}
      .alts-row{display:none;flex-wrap:wrap;gap:4px;margin-top:6px;max-width:280px}
      .alts-row[dir=rtl]{direction:rtl}
      .alt-chip{border:1px solid rgba(255,255,255,0.16);background:rgba(255,255,255,0.08);color:#d1d5f0;border-radius:999px;padding:2px 8px;font-size:11.5px;font-family:"Readex Pro",system-ui,sans-serif;cursor:pointer;transition:all .12s ease;outline:none;user-select:none}
      .alt-chip:hover{border-color:#facc3b;color:#ffffff;background:rgba(250,204,59,0.2);transform:scale(1.04)}
      .alt-chip.active{border-color:#facc3b;background:#facc3b;color:#12152e;font-weight:700}
      .saved{margin-top:6px;font-size:11px;font-weight:600;color:#4ade80;display:none}
      .saved[data-warn="true"]{color:#fbbf24}
      .save-btn{background:#facc3b;color:#12152e;border:1px solid #d4a311;cursor:pointer;padding:5px 12px;border-radius:8px;font-size:11.5px;font-weight:700;display:none;align-items:center;gap:4px;margin-top:8px;box-shadow:0 1px 3px rgba(0,0,0,0.2), 0 2px 6px rgba(250,204,59,0.3);transition:background .1s,transform .1s}
      .save-btn:hover{background:#ffe270;transform:scale(1.03)}
      .save-btn.saved{background:rgba(34,197,94,.16);color:#4ade80;border:1px solid rgba(34,197,94,.38);cursor:default;transform:none;box-shadow:none}
      .x{position:absolute;top:6px;right:6px;width:20px;height:20px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#959cc2;border-radius:5px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);font-size:14px;line-height:1;transition:all .12s}
      .x:hover{color:#ffffff;background:rgba(239,68,68,0.3);border-color:rgba(239,68,68,0.5);transform:scale(1.1)}
    </style>
    <div class="tip">
      <span class="x">×</span>
      <div class="orig-line">
        <div class="orig" title="Click to edit word"></div>
        <input type="text" class="orig-input" style="display:none;" />
        <button class="edit-btn edit-orig-btn" title="Edit word" aria-label="Edit word">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
        <button class="save-edit-btn save-orig-btn" title="Apply change" style="display:none;">✓</button>
        <span class="pos-badge"></span>
        <button class="spk-btn" title="Pronounce in English" aria-label="Listen">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
          </svg>
        </button>
      </div>
      <div class="tr-line">
        <div class="tr" title="Click to edit translation"></div>
        <input type="text" class="tr-input" style="display:none;" />
        <button class="edit-btn edit-tr-btn" title="Edit translation" aria-label="Edit translation">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
        <button class="save-edit-btn save-tr-btn" title="Apply change" style="display:none;">✓</button>
      </div>
      <div class="corr-row"></div>
      <div class="alts-row"></div>
      <button class="save-btn" title="Save word to My Words">+ Save to My Words</button>
      <div class="saved"></div>
    </div>`;
  const tip = shadow.querySelector(".tip");
  const origEl = shadow.querySelector(".orig");
  const origInput = shadow.querySelector(".orig-input");
  const editOrigBtn = shadow.querySelector(".edit-orig-btn");
  const saveOrigBtn = shadow.querySelector(".save-orig-btn");
  const posEl = shadow.querySelector(".pos-badge");
  const spkBtn = shadow.querySelector(".spk-btn");
  const trEl = shadow.querySelector(".tr");
  const trInput = shadow.querySelector(".tr-input");
  const editTrBtn = shadow.querySelector(".edit-tr-btn");
  const saveTrBtn = shadow.querySelector(".save-tr-btn");
  const corrEl = shadow.querySelector(".corr-row");
  const altsEl = shadow.querySelector(".alts-row");
  const saveBtn = shadow.querySelector(".save-btn");
  const savedEl = shadow.querySelector(".saved");
  shadow.querySelector(".x").addEventListener("click", (e) => {
    e.stopPropagation();
    hideTip();
  });

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

  let currentOrigText = "";
  let currentSrcLang = "en";

  function playRemoteTts(text, code) {
    safeSendMessage({ type: "tts:speak", text, lang: code }, (res) => {
      if (!res || !res.ok || !res.dataUrl) {
        spkBtn.classList.remove("speaking");
        return;
      }
      try {
        const audio = new Audio(res.dataUrl);
        audio.onended = () => spkBtn.classList.remove("speaking");
        audio.onerror = () => spkBtn.classList.remove("speaking");
        audio.play().catch(() => spkBtn.classList.remove("speaking"));
      } catch (_) {
        spkBtn.classList.remove("speaking");
      }
    });
  }

  spkBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!currentOrigText) return;
    const code = (currentSrcLang && currentSrcLang !== "auto" ? currentSrcLang : "en").toLowerCase().slice(0, 2);
    spkBtn.classList.add("speaking");

    if (!("speechSynthesis" in window)) {
      playRemoteTts(currentOrigText, code);
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const voices = window.speechSynthesis.getVoices();
      const voice = voices.find((v) => v.lang.toLowerCase().startsWith(code) && !v.localService) ||
                    voices.find((v) => v.lang.toLowerCase().startsWith(code));

      if (!voice && voices.length > 0) {
        playRemoteTts(currentOrigText, code);
        return;
      }

      const u = new SpeechSynthesisUtterance(currentOrigText);
      u.lang = LANG_VOICES[code] || "en-US";
      u.rate = 0.92;
      if (voice) u.voice = voice;

      u.onend = () => spkBtn.classList.remove("speaking");
      u.onerror = () => playRemoteTts(currentOrigText, code);
      window.speechSynthesis.speak(u);
    } catch (_) {
      playRemoteTts(currentOrigText, code);
    }
  });

  function mount() {
    // In fullscreen only the fullscreen element's subtree is visible.
    const parent = document.fullscreenElement || document.documentElement;
    if (host.parentNode !== parent) parent.appendChild(host);
  }
  document.addEventListener("fullscreenchange", () => host.isConnected && mount());

  let hideTimer = null;
  let tipToken = 0; // lets late replies know the tooltip has moved on
  const AUTO_CLOSE_DELAY_MS = 850; // 0.85s as requested by user

  function findActiveVideo() {
    const videos = Array.from(document.querySelectorAll("video"));
    if (videos.length === 0) return null;
    if (videos.length === 1) return videos[0];
    return (
      videos.find((v) => !v.paused && v.readyState > 1) ||
      videos.find((v) => v.clientHeight > 100 && v.clientWidth > 100) ||
      videos[0]
    );
  }

  function isVideoPaused() {
    const v = findActiveVideo();
    if (v) return v.paused;
    if (typeof wasPlaying !== "undefined" && !wasPlaying) return true;
    return false;
  }

  function hideTip() {
    if (tip.dataset.editing) return;
    clearTimeout(hideTimer);
    origInput.style.display = "none";
    saveOrigBtn.style.display = "none";
    origEl.style.display = "";
    editOrigBtn.style.display = "";
    trInput.style.display = "none";
    saveTrBtn.style.display = "none";
    trEl.style.display = "";
    editTrBtn.style.display = "";
    tip.style.display = "none";
    delete tip.dataset.hovered;
    delete tip.dataset.editing;
  }

  // Freeze auto-close when video pauses; schedule close when video resumes
  document.addEventListener(
    "pause",
    (e) => {
      if (e.target && e.target.tagName === "VIDEO") {
        clearTimeout(hideTimer);
      }
    },
    true
  );

  document.addEventListener(
    "play",
    (e) => {
      if (e.target && e.target.tagName === "VIDEO") {
        if (tip && tip.style.display === "block" && !tip.dataset.hovered && !tip.dataset.editing) {
          clearTimeout(hideTimer);
          hideTimer = setTimeout(hideTip, AUTO_CLOSE_DELAY_MS);
        }
      }
    },
    true
  );

  let currentPendingEntry = null;

  // ── Inline Edit Handlers: Edit Word or Translation on Click / Pencil ─────
  function enterOrigEdit() {
    tip.dataset.editing = "1";
    clearTimeout(hideTimer);
    origEl.style.display = "none";
    editOrigBtn.style.display = "none";
    posEl.style.display = "none";
    origInput.style.display = "inline-block";
    saveOrigBtn.style.display = "inline-flex";
    origInput.value = currentOrigText || origEl.textContent || "";
    origInput.focus();
    origInput.select();
  }

  function exitOrigEdit(apply) {
    delete tip.dataset.editing;
    const newText = origInput.value.trim();
    origInput.style.display = "none";
    saveOrigBtn.style.display = "none";
    origEl.style.display = "";
    editOrigBtn.style.display = "";
    if (posEl.textContent && posEl.textContent.trim()) {
      posEl.style.display = "inline-flex";
    }

    if (apply && newText && newText !== currentOrigText) {
      currentOrigText = newText;
      origEl.textContent = newText;
      trEl.textContent = "…";
      setNote("Translating…", false);
      const target = settings.targetLang;
      safeSendMessage({ type: "translate", text: newText, target, srcLang: currentSrcLang }, (res) => {
        if (!isContextValid()) return;
        if (!res || !res.ok) {
          trEl.textContent = "Translation failed";
          return;
        }
        trEl.textContent = res.text;
        if (res.pos) {
          posEl.textContent = POS_LABELS[res.pos.toLowerCase()] || res.pos;
          posEl.style.display = "inline-flex";
        }
        if (currentPendingEntry) {
          currentPendingEntry.text = newText;
          currentPendingEntry.translation = res.text;
          currentPendingEntry.pos = res.pos || null;
          safeSendMessage({ type: "history:add", entry: currentPendingEntry });
          safeSendMessage({ type: "save", entry: currentPendingEntry }, (saved) => {
            if (!isContextValid()) return;
            if (saved && saved.ok && saved.cloud !== "signed-out") {
              savedWordsSet.add(normWord(newText));
              const note = SAVE_NOTES[saved.cloud] || SAVE_NOTES.synced;
              setNote(note.text, note.warn);
              saveBtn.classList.add("saved");
              saveBtn.textContent = "✓ In your words";
            } else {
              saveBtn.classList.remove("saved");
              saveBtn.textContent = "+ Save to My Words";
              const msg = (saved && saved.error) || "Failed to save · Please sign in";
              setNote(msg, true);
            }
          });
        }
      });
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
  saveOrigBtn.addEventListener("click", (e) => {
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
    tip.dataset.editing = "1";
    clearTimeout(hideTimer);
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
    delete tip.dataset.editing;
    const newTr = trInput.value.trim();
    trInput.style.display = "none";
    saveTrBtn.style.display = "none";
    trEl.style.display = "";
    editTrBtn.style.display = "";

    if (apply && newTr && newTr !== trEl.textContent && currentPendingEntry) {
      trEl.textContent = newTr;
      currentPendingEntry.translation = newTr;
      safeSendMessage({ type: "history:add", entry: currentPendingEntry });
      setNote("Saving…", false);
      safeSendMessage({ type: "save", entry: currentPendingEntry }, (saved) => {
        if (!isContextValid()) return;
        if (saved && saved.ok && saved.cloud !== "signed-out") {
          savedWordsSet.add(normWord(currentPendingEntry.text));
          const note = SAVE_NOTES[saved.cloud] || SAVE_NOTES.synced;
          setNote(note.text, note.warn);
          saveBtn.classList.add("saved");
          saveBtn.textContent = "✓ In your words";
        } else {
          saveBtn.classList.remove("saved");
          saveBtn.textContent = "+ Save to My Words";
          const msg = (saved && saved.error) || "Failed to save · Please sign in";
          setNote(msg, true);
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

  saveBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!currentPendingEntry || saveBtn.classList.contains("saved")) return;
    saveBtn.textContent = "Saving…";
    safeSendMessage({ type: "save", entry: currentPendingEntry }, (saved) => {
      if (!isContextValid()) return;
      if (saved && saved.ok && saved.cloud !== "signed-out") {
        saveBtn.classList.add("saved");
        saveBtn.textContent = "✓ In your words";
        savedWordsSet.add(normWord(currentPendingEntry.text));
        const note = SAVE_NOTES[saved.cloud] || SAVE_NOTES.synced;
        setNote(note.text, note.warn);
      } else {
        saveBtn.classList.remove("saved");
        saveBtn.textContent = "+ Save to My Words";
        const msg = (saved && saved.error) || "Failed to save · Please sign in";
        setNote(msg, true);
      }
    });
  });

  function setNote(note, warn) {
    savedEl.textContent = note;
    savedEl.dataset.warn = String(Boolean(warn));
    savedEl.style.display = note ? "block" : "none";
  }

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

  function showTip(x, y, original, translated, rtl, note, warn, srcLang, pos, alternatives, willSave, correction) {
    mount();
    currentOrigText = original;
    if (srcLang) currentSrcLang = srcLang;
    origInput.style.display = "none";
    saveOrigBtn.style.display = "none";
    origEl.style.display = "";
    editOrigBtn.style.display = "";
    trInput.style.display = "none";
    saveTrBtn.style.display = "none";
    trEl.style.display = "";
    editTrBtn.style.display = "";
    delete tip.dataset.editing;
    origEl.textContent = original;
    if (pos) {
      posEl.textContent = POS_LABELS[pos.toLowerCase()] || pos;
      posEl.style.display = "inline-flex";
    } else {
      posEl.style.display = "none";
    }
    trEl.textContent = translated;
    trEl.dir = rtl ? "rtl" : "ltr";

    corrEl.innerHTML = "";
    if (correction && correction.toLowerCase() !== original.trim().toLowerCase()) {
      corrEl.style.display = "flex";
      const icon = document.createElement("span");
      icon.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:3px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
      const label = document.createElement("span");
      label.textContent = "Did you mean:";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "corr-link";
      btn.textContent = correction;
      btn.title = `Switch to correct word: "${correction}"`;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        currentOrigText = correction;
        origEl.textContent = correction;
        trEl.textContent = "…";
        setNote("Translating…", false);
        const target = settings.targetLang;
        safeSendMessage({ type: "translate", text: correction, target, srcLang: currentSrcLang }, (res) => {
          if (!isContextValid()) return;
          if (!res || !res.ok) {
            trEl.textContent = "Translation failed";
            return;
          }
          showTip(x, y, correction, res.text, RTL_LANGS.includes(target), willSave ? "Saving…" : "", false, currentSrcLang, res.pos, res.alternatives, willSave, res.correction);
        });
      });
      corrEl.append(icon, label, btn);
    } else {
      corrEl.style.display = "none";
    }

    altsEl.innerHTML = "";
    altsEl.dir = rtl ? "rtl" : "ltr";
    const alts = Array.isArray(alternatives) ? alternatives : [];
    if (alts.length > 0) {
      altsEl.style.display = "flex";
      for (const alt of alts) {
        if (!alt || alt === translated) continue;
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "alt-chip";
        chip.textContent = alt;
        chip.title = `Switch translation to "${alt}"`;
        chip.addEventListener("click", (e) => {
          e.stopPropagation();
          trEl.textContent = alt;
          const chips = altsEl.querySelectorAll(".alt-chip");
          chips.forEach((c) => c.classList.remove("active"));
          chip.classList.add("active");

          if (currentPendingEntry) {
            currentPendingEntry.translation = alt;
            safeSendMessage({ type: "history:add", entry: currentPendingEntry });

            if (willSave || isWordSaved(currentPendingEntry.text)) {
              setNote("Saving…", false);
              safeSendMessage({ type: "save", entry: currentPendingEntry }, (saved) => {
                if (!isContextValid()) return;
                if (saved && saved.ok && saved.cloud !== "signed-out") {
                  savedWordsSet.add(normWord(currentPendingEntry.text));
                  const n = SAVE_NOTES[saved.cloud] || SAVE_NOTES.synced;
                  setNote(n.text, n.warn);
                  saveBtn.classList.add("saved");
                  saveBtn.textContent = "✓ In your words";
                } else {
                  saveBtn.classList.remove("saved");
                  saveBtn.textContent = "+ Save to My Words";
                  const msg = (saved && saved.error) || "Failed to save · Please sign in";
                  setNote(msg, true);
                }
              });
            } else {
              saveBtn.style.display = "inline-flex";
              saveBtn.classList.remove("saved");
              saveBtn.textContent = "+ Save to My Words";
              setNote("", false);
            }
          }
        });
        altsEl.appendChild(chip);
      }
      if (!altsEl.children.length) altsEl.style.display = "none";
    } else {
      altsEl.style.display = "none";
    }

    setNote(note, warn);
    saveBtn.style.display = "none";
    saveBtn.classList.remove("saved");
    saveBtn.textContent = "+ Save to My Words";
    tip.style.display = "block";
    const r = tip.getBoundingClientRect();
    const left = Math.min(Math.max(8, x - r.width / 2), window.innerWidth - r.width - 8);
    let top = y - r.height - 14;
    if (top < 8) top = y + 28;
    tip.style.left = left + "px";
    tip.style.top = top + "px";

    if (!tip.dataset.hoverWired) {
      tip.dataset.hoverWired = "1";
      tip.addEventListener("mouseenter", () => {
        tip.dataset.hovered = "1";
        clearTimeout(hideTimer);
      });
      tip.addEventListener("mouseleave", () => {
        delete tip.dataset.hovered;
        clearTimeout(hideTimer);
        // If video is paused, do NOT auto-close! Keep open for studying/reading.
        if (isVideoPaused()) return;
        hideTimer = setTimeout(hideTip, AUTO_CLOSE_DELAY_MS);
      });
    }

    // Close the tooltip by itself:
    // 1. Never close while translation is still loading (translated === "…")
    // 2. Never close while video is paused (user is studying/reading)
    // 3. Never close while hovered
    // 4. When video is playing, wait 0.85s (850ms) AFTER translation is shown!
    clearTimeout(hideTimer);
    if (translated !== "…" && !tip.dataset.hovered && !isVideoPaused()) {
      hideTimer = setTimeout(hideTip, AUTO_CLOSE_DELAY_MS);
    }
  }

  // ---------- Word under the cursor ----------
  function wordAtPoint(x, y) {
    const range = document.caretRangeFromPoint ? document.caretRangeFromPoint(x, y) : null;
    if (!range || range.startContainer.nodeType !== Node.TEXT_NODE) return null;

    const text = range.startContainer.textContent;
    let start = range.startOffset;
    let end = start;
    while (start > 0 && WORD_CHAR.test(text[start - 1])) start--;
    while (end < text.length && WORD_CHAR.test(text[end])) end++;
    const word = text.slice(start, end).replace(/^[-'’]+|[-'’]+$/g, "");
    return word || null;
  }

  function lineAtTarget(el) {
    const cont = el.closest(SUBTITLE_SELECTOR);
    if (!cont) return null;
    const seg =
      el.closest(".caption-visual-line") ||
      el.closest(".player-timedtext-text-container") ||
      el.closest('[class*="subtitles-cue"]') ||
      el.closest('[class*="subtitles-line"]') ||
      cont;
    return (seg.innerText || seg.textContent || "").replace(/\s+/g, " ").trim();
  }

  // ---------- Keep the video playing ----------
  // Remember whether the video was playing right before the press, so we can
  // undo any pause the player itself triggers from the click.
  let wasPlaying = false;
  document.addEventListener(
    "pointerdown",
    (e) => {
      if (!settings.enabled) return;
      if (e.target.closest && e.target.closest(SUBTITLE_SELECTOR)) {
        const v = findActiveVideo();
        wasPlaying = !!(v && !v.paused);
      }
    },
    true
  );

  function resumeIfNeeded() {
    if (!wasPlaying) return;
    const v = findActiveVideo();
    const resume = () => v && v.paused && v.play().catch(() => {});
    setTimeout(resume, 0);
    setTimeout(resume, 120);
  }

  // ---------- Subtitle Language Detection ----------
  const GERMAN_WORDS = new Set([
    "ich", "du", "er", "sie", "es", "wir", "ihr",
    "der", "die", "das", "den", "dem", "des",
    "ein", "eine", "einer", "einem", "einen", "eines",
    "nicht", "ist", "sind", "war", "waren", "wird", "werden",
    "und", "oder", "aber", "denn", "doch", "weil", "dass", "wenn", "wie",
    "auch", "noch", "nach", "bei", "von", "mit", "zu", "im", "am", "an", "auf",
    "für", "fuer", "über", "ueber", "unter", "vor", "hinter", "zwischen",
    "sehr", "hier", "da", "dort", "jetzt", "immer", "nie", "etwas", "alles", "nichts",
    "man", "sich", "mich", "dich", "uns", "euch", "ihnen",
    "haben", "hat", "hatte", "hatten", "habe", "hast", "habt",
    "sein", "bin", "bist", "seid",
    "kann", "kannst", "können", "koennen", "könnt",
    "muss", "musst", "müssen", "muessen", "müsst",
    "will", "willst", "wollen", "wollt",
    "soll", "sollst", "sollen", "sollt",
    "darf", "darfst", "dürfen",
    "was", "wer", "wen", "wem", "wo", "woher", "wohin", "wann", "warum", "wieso",
    "bitte", "danke", "gut", "ja", "nein", "so", "nur", "viel", "mehr", "schon", "mal",
    "gibt", "sehen", "geht", "gehen", "kommt", "kommen", "macht", "machen", "sagte", "sagen",
    "leben", "lebens", "tag", "tage", "zeit", "minuten", "stunden", "mensch", "menschen",
    "rest", "deines", "meines", "seines", "ihres", "unseres", "eures",
    "heute", "morgen", "gestern", "immer", "wieder", "einfach", "selbst", "ganz"
  ]);

  const ENGLISH_WORDS = new Set([
    "the", "are", "were", "have", "has", "had", "with",
    "this", "that", "these", "those", "they", "their", "them",
    "from", "what", "where", "which", "who", "whom", "whose", "why",
    "will", "would", "could", "should", "about", "into", "more", "some",
    "there", "then", "than", "out", "only", "other",
    "time", "people", "your", "because", "been", "being"
  ]);

  function scoreTextLanguage(text) {
    if (!text) return null;
    let de = 0;
    let en = 0;
    if (/[äöüßÄÖÜ]/.test(text)) de += 5; // German umlauts are definitive
    const words = text.toLowerCase().match(/[\p{L}]+/gu) || [];
    for (const w of words) {
      if (GERMAN_WORDS.has(w)) de += 2;
      if (ENGLISH_WORDS.has(w)) en += 2;
    }
    if (de > en && de >= 2) return "de";
    if (en > de && en >= 2) return "en";
    return null;
  }

  let observedSubLang = null;
  try {
    const po = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const name = entry.name || "";
        if (name.includes("timedtext")) {
          const mLang = name.match(/[?&]lang=([a-z]{2})/i);
          if (mLang && mLang[1]) observedSubLang = mLang[1].toLowerCase();
          const mTlang = name.match(/[?&]tlang=([a-z]{2})/i);
          if (mTlang && mTlang[1]) observedSubLang = mTlang[1].toLowerCase();
          const mVss = name.match(/[?&]vss_id=[^&]*?([a-z]{2})/i);
          if (mVss && mVss[1]) observedSubLang = mVss[1].toLowerCase();
        }
      }
    });
    po.observe({ type: "resource", buffered: true });
  } catch (_) {}

  function getSubtitleFileLanguage() {
    if (observedSubLang) return observedSubLang;
    try {
      const entries = performance.getEntriesByType("resource");
      for (let i = entries.length - 1; i >= 0; i--) {
        const name = entries[i].name || "";
        if (name.includes("timedtext")) {
          const mLang = name.match(/[?&]lang=([a-z]{2})/i);
          if (mLang && mLang[1]) return mLang[1].toLowerCase();
          const mTlang = name.match(/[?&]tlang=([a-z]{2})/i);
          if (mTlang && mTlang[1]) return mTlang[1].toLowerCase();
          const mVss = name.match(/[?&]vss_id=[^&]*?([a-z]{2})/i);
          if (mVss && mVss[1]) return mVss[1].toLowerCase();
        }
      }
    } catch (_) {}
    return null;
  }

  function getYouTubeInitialLanguage() {
    try {
      for (const s of document.scripts) {
        const txt = s.textContent || "";
        if (txt.includes("captionTracks")) {
          const m = txt.match(/"captionTracks":\s*\[\s*\{[^}]*?"languageCode":\s*"([a-z]{2})"/i);
          if (m && m[1]) return m[1].toLowerCase();
        }
        if (txt.includes("defaultAudioLanguage")) {
          const m = txt.match(/"defaultAudioLanguage":\s*"([a-z]{2})"/i);
          if (m && m[1]) return m[1].toLowerCase();
        }
      }
    } catch (_) {}
    return null;
  }

  function detectSubtitleTrackLanguage() {
    try {
      const v = document.querySelector("video");
      if (v && v.textTracks) {
        for (let i = 0; i < v.textTracks.length; i++) {
          const t = v.textTracks[i];
          if (t.mode === "showing" && t.language) {
            const lang = t.language.toLowerCase().slice(0, 2);
            if (lang && lang !== "un") return lang;
          }
          if (t.mode === "showing" && t.label) {
            const lbl = t.label.toLowerCase();
            if (lbl.includes("german") || lbl.includes("deutsch")) return "de";
            if (lbl.includes("english") || lbl.includes("englisch")) return "en";
            if (lbl.includes("spanish") || lbl.includes("español")) return "es";
            if (lbl.includes("french") || lbl.includes("français")) return "fr";
          }
        }
      }
      const ytWin = document.querySelector(".ytp-caption-window-container, .caption-window");
      if (ytWin) {
        const langAttr = ytWin.getAttribute("lang") || ytWin.closest("[lang]")?.getAttribute("lang");
        if (langAttr) return langAttr.toLowerCase().slice(0, 2);
      }
    } catch (_) {}
    return null;
  }

  function detectLanguageFromTitle() {
    try {
      const raw = (document.title || "") + " " + (document.querySelector("h1.ytd-watch-metadata, #title h1")?.textContent || "");
      const title = raw.toLowerCase();
      if (/\b(german|deutsch|deutschland|aleman|allemand|tedesco)\b/i.test(title)) return "de";
      if (/\b(english|englisch|ingles|anglais|inglese)\b/i.test(title)) return "en";
      if (/\b(spanish|español|espanol|spanisch|espagnol)\b/i.test(title)) return "es";
      if (/\b(french|français|francais|französisch|frances)\b/i.test(title)) return "fr";
      // Also score words in the title itself (e.g. "5 MINUTEN FÜR DEN REST DEINES LEBENS")
      const titleScore = scoreTextLanguage(raw);
      if (titleScore) return titleScore;
    } catch (_) {}
    return null;
  }

  let currentVideoKey = "";
  let currentVideoSubLang = null;

  function updateVideoSession() {
    let key = location.pathname;
    try {
      const u = new URL(location.href);
      if (u.hostname.includes("youtube.com")) {
        key = u.searchParams.get("v") || location.pathname;
      }
    } catch (_) {}
    if (key !== currentVideoKey) {
      currentVideoKey = key;
      currentVideoSubLang = null;
    }
  }

  function getVisibleCaptionsLanguage() {
    try {
      const segs = document.querySelectorAll(".ytp-caption-segment, .caption-visual-line, .player-timedtext-text-container");
      let allText = "";
      for (const s of segs) {
        allText += " " + (s.textContent || "");
      }
      if (allText.trim()) {
        return scoreTextLanguage(allText);
      }
    } catch (_) {}
    return null;
  }

  function resolveSubtitleLanguage(fullLine) {
    updateVideoSession();

    // If already locked for this video session, every subtitle word inherits this language!
    if (currentVideoSubLang) {
      return currentVideoSubLang;
    }

    // 1. Inspect subtitle file request URL directly (YouTube timedtext!)
    const fileLang = getSubtitleFileLanguage();
    if (fileLang) {
      currentVideoSubLang = fileLang;
      return fileLang;
    }

    // 2. Check video title words (e.g. "Slow German", "5 MINUTEN FÜR DEN REST DEINES LEBENS")
    const titleLang = detectLanguageFromTitle();
    if (titleLang) {
      currentVideoSubLang = titleLang;
      return titleLang;
    }

    // 3. Check all visible subtitle segments on screen
    const visibleLang = getVisibleCaptionsLanguage();
    if (visibleLang) {
      currentVideoSubLang = visibleLang;
      return visibleLang;
    }

    // 4. Check the clicked subtitle line
    const lineLang = scoreTextLanguage(fullLine);
    if (lineLang) {
      currentVideoSubLang = lineLang;
      return lineLang;
    }

    // 5. Inspect YouTube initial player response embedded in script tags
    const ytLang = getYouTubeInitialLanguage();
    if (ytLang) {
      currentVideoSubLang = ytLang;
      return ytLang;
    }

    // 6. Check HTML5 showing track or DOM caption element
    const trackLang = detectSubtitleTrackLanguage();
    if (trackLang) {
      currentVideoSubLang = trackLang;
      return trackLang;
    }

    return "auto";
  }

  // ---------- Click handling ----------
  document.addEventListener(
    "click",
    (e) => {
      if (!settings.enabled) return;
      if (e.composedPath().includes(host)) return; // clicks inside our tooltip

      const inSubs = e.target.closest && e.target.closest(SUBTITLE_SELECTOR);
      if (!inSubs) {
        if (tip.style.display === "block") hideTip();
        return;
      }

      // Stop the player from toggling play/pause.
      e.preventDefault();
      e.stopImmediatePropagation();

      const fullLine = lineAtTarget(e.target) || "";
      const text = e.shiftKey ? fullLine : wordAtPoint(e.clientX, e.clientY);
      if (!text) {
        resumeIfNeeded();
        return;
      }

      resumeIfNeeded();

      const target = settings.targetLang;
      const token = ++tipToken;

      const detectedSrc = resolveSubtitleLanguage(fullLine);

      showTip(e.clientX, e.clientY, text, "…", false, "", false, detectedSrc !== "auto" ? detectedSrc : undefined);

      safeSendMessage({ type: "translate", text, target, srcLang: detectedSrc, context: fullLine }, (res) => {
        if (!isContextValid() || token !== tipToken) return;
        if (!res || !res.ok) {
          showTip(e.clientX, e.clientY, text, "Translation failed", false, "", false);
          return;
        }

        // Lock in final source language: if subtitle was resolved (e.g. "de"), force it!
        const finalSrc = (detectedSrc && detectedSrc !== "auto") ? detectedSrc : (res.src || "auto");
        if (finalSrc && finalSrc !== "auto") {
          currentVideoSubLang = finalSrc;
        }

        const willSave =
          settings.translateSaveMode === "auto" ||
          settings.translateSaveMode === "subtitles_only" ||
          (settings.saveWords === true && settings.translateSaveMode !== "manual");
        showTip(
          e.clientX,
          e.clientY,
          text,
          res.text,
          RTL_LANGS.includes(target),
          willSave ? "Saving…" : "",
          false,
          finalSrc,
          res.pos,
          res.alternatives,
          willSave,
          res.correction
        );

        const titleContext =
          fullLine && fullLine.trim() && fullLine.trim().length > text.length
            ? `"${fullLine.trim()}" — ${document.title}`
            : document.title;

        const entry = {
          text,
          translation: res.text,
          lang: target,
          src: finalSrc,
          pos: res.pos || null,
          page: location.href,
          title: titleContext,
          sentence: fullLine ? fullLine.trim() : "",
          source: "subtitle",
          saved: Boolean(willSave),
        };
        currentPendingEntry = entry;

        // Always record to translation history
        safeSendMessage({ type: "history:add", entry });

        const alreadySaved = isWordSaved(entry.text);

        if (!willSave) {
          // Manual Save Mode: show the Save button!
          saveBtn.style.display = "inline-flex";
          if (alreadySaved) {
            saveBtn.classList.add("saved");
            saveBtn.textContent = "✓ In your words";
            saveBtn.title = "Already saved in your words";
          } else {
            saveBtn.classList.remove("saved");
            saveBtn.textContent = "+ Save to My Words";
            saveBtn.title = "Save to My Words";
          }
          safeSendMessage({ type: "word:is-saved", text: entry.text }, (check) => {
            if (!isContextValid() || token !== tipToken) return;
            if (check && check.saved) {
              savedWordsSet.add(normWord(entry.text));
              saveBtn.classList.add("saved");
              saveBtn.textContent = "✓ In your words";
              saveBtn.title = "Already saved in your words";
            }
          });
          return;
        }

        // Auto Save Mode:
        saveBtn.style.display = "none";
        if (alreadySaved) {
          setNote("✓ In your words", false);
          return;
        }
        safeSendMessage({ type: "save", entry }, (saved) => {
          if (!isContextValid() || token !== tipToken) return;
          if (!saved || !saved.ok || saved.cloud === "signed-out") {
            const msg = (saved && saved.error) || "Failed to save · Please sign in";
            setNote(msg, true);
            return;
          }
          savedWordsSet.add(normWord(entry.text));
          const note = SAVE_NOTES[saved.cloud] || SAVE_NOTES.synced;
          setNote(note.text, note.warn);
        });
      });
    },
    true
  );

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideTip();
  });

  // ---------- Subtitle Health Telemetry & Canvas Fallback Detector ----------
  function getStreamingPlatform() {
    const h = location.hostname.toLowerCase();
    if (h.includes("youtube.com")) return "youtube";
    if (h.includes("netflix.com")) return "netflix";
    if (h.includes("primevideo.com") || h.includes("amazon.")) return "primevideo";
    if (h.includes("disneyplus.com")) return "disneyplus";
    if (h.includes("udemy.com")) return "udemy";
    if (h.includes("coursera.org")) return "coursera";
    if (h.includes("ted.com")) return "ted";
    if (h.includes("bbc.")) return "bbc";
    return null;
  }

  let healthCheckedOnce = false;
  let canvasFallbackPill = null;

  function reportSubtitleHealth(platform, status, details = {}) {
    safeSendMessage({
      type: "telemetry:subtitle-health",
      health: {
        platform,
        status, // "healthy_dom" | "canvas_or_broken_dom" | "no_active_video"
        url: location.origin + location.pathname,
        timestamp: Date.now(),
        ...details,
      },
    });
  }

  function showCanvasFallbackNotice(videoEl) {
    if (canvasFallbackPill || !videoEl) return;
    const parent = videoEl.parentElement || document.body;
    const pill = document.createElement("div");
    pill.className = "wordtap-canvas-ocr-hint";
    pill.style.cssText = `
      position: absolute;
      bottom: 64px;
      right: 20px;
      z-index: 2147483640;
      background: rgba(14, 16, 34, 0.94);
      border: 1px solid rgba(250, 204, 59, 0.6);
      color: #ffffff;
      font-size: 11px;
      font-weight: 600;
      padding: 6px 12px;
      border-radius: 999px;
      box-shadow: 0 4px 18px rgba(0,0,0,0.6);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 7px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      user-select: none;
      transition: transform 0.15s ease;
    `;
    pill.innerHTML = `
      <span style="background:#facc3b;color:#0b0d1e;font-size:10px;font-weight:800;padding:2px 6px;border-radius:999px;">OCR</span>
      <span>Subtitles on Canvas? Press <strong>Alt+S</strong> to translate</span>
      <span style="opacity:0.6;margin-left:4px;font-size:12px;cursor:pointer;" title="Dismiss">✕</span>
    `;

    pill.addEventListener("mouseenter", () => {
      pill.style.transform = "scale(1.03)";
    });
    pill.addEventListener("mouseleave", () => {
      pill.style.transform = "scale(1)";
    });

    pill.addEventListener("click", (e) => {
      e.stopPropagation();
      if (e.target.textContent === "✕") {
        pill.remove();
        canvasFallbackPill = null;
        return;
      }
      safeSendMessage({ type: "ocr:start-on-active-tab" });
    });

    try {
      parent.appendChild(pill);
      canvasFallbackPill = pill;
      setTimeout(() => {
        if (canvasFallbackPill === pill) {
          pill.remove();
          canvasFallbackPill = null;
        }
      }, 9000);
    } catch (_) {}
  }

  function runSubtitleHealthCheck() {
    const platform = getStreamingPlatform();
    if (!platform) return;

    const video = document.querySelector("video");
    if (!video || video.paused || video.currentTime < 5) return;

    // Check if DOM subtitles exist
    const hasDomSubs = Boolean(document.querySelector(SUBTITLE_SELECTOR));

    // Check if HTML5 textTracks exist
    let hasTextTracks = false;
    try {
      if (video.textTracks && video.textTracks.length > 0) {
        for (let i = 0; i < video.textTracks.length; i++) {
          const t = video.textTracks[i];
          if (t.mode === "showing" || (t.activeCues && t.activeCues.length > 0)) {
            hasTextTracks = true;
            break;
          }
        }
      }
    } catch (_) {}

    // Check for canvas player / DRM rendering layer
    const hasCanvas = Boolean(document.querySelector("canvas"));

    if (hasDomSubs || hasTextTracks) {
      reportSubtitleHealth(platform, "healthy_dom", { hasDomSubs, hasTextTracks });
      if (canvasFallbackPill) {
        canvasFallbackPill.remove();
        canvasFallbackPill = null;
      }
    } else if (hasCanvas) {
      reportSubtitleHealth(platform, "canvas_or_broken_dom", {
        reason: "Canvas player detected with no DOM subtitle match",
        hasCanvas: true,
      });
      // Show subtle fallback notice once per video session
      if (!healthCheckedOnce) {
        showCanvasFallbackNotice(video);
        healthCheckedOnce = true;
      }
    }
  }

  // Periodic health check every 12 seconds during active playback
  setInterval(runSubtitleHealthCheck, 12000);
})();

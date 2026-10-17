/**
 * WordTap – Instant Selection Translator
 * Automatically shows a clean translation pop-up or floating icon when text
 * is selected on any webpage, with dynamic English speech pronunciation.
 */
(() => {
  if (
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.host.includes("wordtap"))
  ) {
    function syncSettingsFromWeb() {
      try {
        const raw = localStorage.getItem("wordtap_settings");
        if (raw && isContextValid() && chrome.storage && chrome.storage.sync) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.translateSaveMode) {
            const isManual = parsed.translateSaveMode === "manual";
            chrome.storage.sync.set({
              translateSaveMode: parsed.translateSaveMode,
              saveWords: !isManual,
            });
          }
        }
      } catch (_) {}
    }
    syncSettingsFromWeb();
    window.addEventListener("storage", syncSettingsFromWeb);
    window.addEventListener("message", (e) => {
      if (e.data && e.data.type === "wordtap:sync-settings") {
        syncSettingsFromWeb();
      }
    });
    return;
  }

  const RTL_LANGS = ["ar", "fa", "ur", "he"];
  const SUBTITLE_SELECTOR = [
    ".ytp-caption-window-container",
    ".caption-window",
    ".player-timedtext",
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
    selectionMode: "immediate" // "immediate" | "icon" | "off"
  };

  if (isContextValid() && chrome.storage && chrome.storage.sync) {
    try {
      chrome.storage.sync.get(settings, (v) => {
        if (v) Object.assign(settings, v);
      });
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "sync") return;
        for (const k in changes) settings[k] = changes[k].newValue;
        if (!settings.enabled || settings.selectionMode === "off") {
          hideAll();
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

    /* Floating icon for "Show icon" mode */
    .icon-btn {
      position: fixed;
      display: none;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #151833;
      border: 2px solid #262a52;
      cursor: pointer;
      pointer-events: auto;
      box-shadow: 0 4px 14px rgba(0,0,0,0.45);
      transition: transform 0.12s ease, box-shadow 0.12s ease;
      user-select: none;
    }
    .icon-btn:hover {
      transform: scale(1.12);
      box-shadow: 0 6px 18px rgba(0,0,0,0.6);
    }
    .icon-btn svg { display: block; }

    /* Translation pop-up card */
    .card {
      position: fixed;
      display: none;
      flex-direction: column;
      gap: 7px;
      min-width: 190px;
      max-width: 330px;
      padding: 12px 14px 11px;
      background: #151833;
      color: #ffffff;
      border-radius: 14px;
      border: 1px solid #262a52;
      box-shadow: 0 10px 30px rgba(0,0,0,0.6);
      pointer-events: auto;
      font: 13px/1.4 "Segoe UI", system-ui, sans-serif;
      animation: fadeIn 0.12s ease-out;
      user-select: text;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Header row with word, speaker icon, and close button */
    .card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .orig-wrap {
      display: flex;
      align-items: center;
      gap: 7px;
      flex: 1;
      min-width: 0;
    }
    .orig {
      font-size: 13px;
      font-weight: 600;
      color: #a9aed3;
      word-break: break-word;
      max-height: 38px;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Dynamic Speaker Button */
    .speak-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: none;
      border: none;
      color: #ffd23f;
      cursor: pointer;
      padding: 3px 5px;
      border-radius: 6px;
      flex: none;
      transition: color 0.15s, transform 0.1s, background-color 0.15s;
    }
    .speak-btn:hover {
      color: #ffe270;
      background: rgba(255, 210, 63, 0.16);
      transform: scale(1.12);
    }
    .speak-btn:active {
      transform: scale(0.96);
    }
    .speak-btn.speaking {
      color: #3fd69a;
      background: rgba(63, 214, 154, 0.18);
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

    .close-btn {
      background: none;
      border: none;
      color: #a9aed3;
      cursor: pointer;
      font-size: 16px;
      line-height: 1;
      padding: 0 2px;
      flex: none;
      transition: color 0.1s;
    }
    .close-btn:hover { color: #ffffff; }

    /* Translation text */
    .tr {
      font-size: 18px;
      font-weight: 700;
      word-break: break-word;
      color: #ffffff;
      line-height: 1.35;
    }
    .tr[dir="rtl"] { text-align: right; }

    .div {
      height: 1px;
      background: #262a52;
      margin: 1px 0;
    }

    /* Bottom action & status */
    .card-bottom {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .status {
      font-size: 11px;
      color: #34d399;
      display: none;
      flex: 1;
      word-break: break-word;
    }
    .status[data-warn="true"] { color: #fbbf24; }

    .save-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: #ffd23f;
      color: #261d00;
      border: none;
      border-radius: 8px;
      padding: 5px 11px;
      font: 600 12px/1 inherit;
      cursor: pointer;
      white-space: nowrap;
      flex: none;
      transition: background 0.12s;
    }
    .save-btn:hover { background: #ffe270; }
    .save-btn:disabled { opacity: 0.5; cursor: default; }
    .save-btn[hidden] { display: none !important; }

    /* Loading animation */
    @keyframes pulse {
      0%, 80%, 100% { opacity: 0.25; transform: scale(0.8); }
      40% { opacity: 1; transform: scale(1.1); }
    }
    .loading {
      display: inline-flex;
      gap: 4px;
      align-items: center;
      padding: 4px 0;
    }
    .dot {
      display: inline-block;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #ffd23f;
      animation: pulse 1.1s infinite;
    }
    .dot:nth-child(2) { animation-delay: 0.18s; }
    .dot:nth-child(3) { animation-delay: 0.36s; }
  </style>

  <!-- Small floating logo icon for click mode -->
  <div class="icon-btn" id="iconBtn" title="Translate with WordTap" aria-label="Translate with WordTap">
    <svg width="18" height="13" viewBox="0 0 30 22" aria-hidden="true">
      <rect x="0.5" y="0.5" width="29" height="21" rx="5" fill="#151833" stroke="#262a52"/>
      <rect x="6" y="8" width="18" height="3" rx="1.5" fill="#fff"/>
      <rect x="9" y="14" width="12" height="2.5" rx="1.25" fill="#ffd23f"/>
    </svg>
  </div>

  <!-- Translation Card -->
  <div class="card" id="card" role="dialog" aria-label="WordTap Translation">
    <div class="card-top">
      <div class="orig-wrap">
        <span class="orig" id="orig"></span>
        <button class="speak-btn" id="speakBtn" title="Pronounce in English" aria-label="Pronounce in English">
          <svg class="speaker-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path class="wave wave-1" d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
            <path class="wave wave-2" d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
          </svg>
        </button>
      </div>
      <button class="close-btn" id="closeBtn" title="Close" aria-label="Close">×</button>
    </div>
    <div class="tr" id="tr"></div>
    <div class="div"></div>
    <div class="card-bottom">
      <span class="status" id="status"></span>
      <button class="save-btn" id="saveBtn">＋ Save word</button>
    </div>
  </div>
  `;

  const iconBtn  = shadow.getElementById("iconBtn");
  const card     = shadow.getElementById("card");
  const origEl   = shadow.getElementById("orig");
  const speakBtn = shadow.getElementById("speakBtn");
  const trEl     = shadow.getElementById("tr");
  const statusEl = shadow.getElementById("status");
  const saveBtn  = shadow.getElementById("saveBtn");
  const closeBtn = shadow.getElementById("closeBtn");

  let tipToken = 0;
  let lastEntry = null;
  let lastText = "";
  let pendingTranslation = null;
  let debounceTimer = null;

  function mount() {
    const parent = document.fullscreenElement || document.body || document.documentElement;
    if (host.parentNode !== parent) {
      parent.appendChild(host);
    }
  }

  function hideAll() {
    clearTimeout(debounceTimer);
    iconBtn.style.display = "none";
    card.style.display    = "none";
    speakBtn.classList.remove("speaking");
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

  // ── Dynamic Text-to-Speech (Speaks German in German, English in English, etc.) ──
  function speakWord(text, lang) {
    if (!("speechSynthesis" in window) || !text) return;
    try {
      window.speechSynthesis.cancel();
      const clean = text.replace(/<[^>]+>/g, "").trim();
      const utterance = new SpeechSynthesisUtterance(clean);
      const code = (lang && lang !== "auto" ? lang : lastSrcLang || "en").toLowerCase().slice(0, 2);
      utterance.lang = LANG_VOICES[code] || "en-US";
      utterance.rate = 0.92;

      const voices = window.speechSynthesis.getVoices();
      const voice = voices.find(v => v.lang.toLowerCase().startsWith(code) && !v.localService) ||
                    voices.find(v => v.lang.toLowerCase().startsWith(code));
      if (voice) utterance.voice = voice;

      speakBtn.classList.add("speaking");
      utterance.onend = () => speakBtn.classList.remove("speaking");
      utterance.onerror = () => speakBtn.classList.remove("speaking");

      window.speechSynthesis.speak(utterance);
    } catch (_) {
      speakBtn.classList.remove("speaking");
    }
  }

  speakBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (lastText) {
      speakWord(lastText, lastSrcLang);
    }
  });

  function positionElement(el, targetX, targetY) {
    el.style.display = "flex";
    const r = el.getBoundingClientRect();
    const padding = 12;

    let left = targetX - r.width / 2;
    if (left < padding) left = padding;
    if (left + r.width > window.innerWidth - padding) {
      left = window.innerWidth - padding - r.width;
    }

    let top = targetY - r.height - 12;
    if (top < padding) {
      top = targetY + 24;
    }
    if (top + r.height > window.innerHeight - padding) {
      top = Math.max(padding, window.innerHeight - padding - r.height);
    }

    el.style.left = Math.round(left) + "px";
    el.style.top  = Math.round(top)  + "px";
  }

  function showLoadingCard(x, y, text) {
    mount();
    origEl.textContent = text.length > 70 ? text.slice(0, 67) + "…" : text;
    trEl.innerHTML = `<span class="loading"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span>`;
    setStatus("", false);
    saveBtn.hidden   = true;
    saveBtn.disabled = false;
    positionElement(card, x, y);
  }

  function finaliseCard(x, y, translated, rtl, entry) {
    trEl.textContent = translated;
    trEl.dir = rtl ? "rtl" : "ltr";
    lastEntry = entry;

    // Always record to translation history
    safeSendMessage({ type: "history:add", entry });

    const willSave = settings.saveWords === true && settings.translateSaveMode !== "manual";

    if (willSave) {
      saveBtn.hidden = true;
      setStatus("Saving…", false);
      doSave(entry);
    } else {
      saveBtn.hidden = false;
      saveBtn.disabled = false;
      saveBtn.innerHTML = `⭐ + Save to My Words`;
      saveBtn.style.background = "#ffd23f";
      saveBtn.style.color = "#261d00";
      setStatus("", false);
    }

    positionElement(card, x, y);
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

  function triggerTranslation(x, y, text, context = "") {
    if (!isContextValid()) return;
    lastText = text;
    const target = settings.targetLang;
    const token = ++tipToken;
    showLoadingCard(x, y, text);

    const detectedSrc = detectContextLanguage(text, context);

    safeSendMessage({ type: "translate", text, target, srcLang: detectedSrc, context }, (res) => {
      if (!isContextValid() || token !== tipToken) return;
      if (!res || !res.ok) {
        trEl.textContent = "Translation failed";
        saveBtn.hidden   = true;
        positionElement(card, x, y);
        return;
      }

      lastSrcLang = res.src || (detectedSrc !== "auto" ? detectedSrc : "en");
      speakBtn.title = `Listen pronunciation (${lastSrcLang.toUpperCase()})`;

      const entry = {
        text,
        translation: res.text,
        lang: target,
        src: res.src,
        page: location.href,
        title: document.title
      };
      finaliseCard(x, y, res.text, RTL_LANGS.includes(target), entry);
    });
  }

  // ── Event Handlers ────────────────────────────────────────────────────────
  saveBtn.addEventListener("click", () => {
    if (!lastEntry || saveBtn.disabled) return;
    saveBtn.disabled = true;
    saveBtn.innerHTML = `Saving…`;
    setStatus("Saving…", false);
    safeSendMessage({ type: "save", entry: lastEntry }, (saved) => {
      if (!isContextValid()) return;
      if (!saved || !saved.ok) {
        setStatus("Could not save word", true);
        saveBtn.disabled = false;
        saveBtn.innerHTML = `⭐ + Save to My Words`;
        return;
      }
      const note = SAVE_NOTES[saved.cloud] || SAVE_NOTES.local;
      setStatus(note.text, note.warn);
      saveBtn.innerHTML = `✓ In My Words`;
      saveBtn.style.background = "rgba(52,211,153,.2)";
      saveBtn.style.color = "#34d399";
    });
  });

  closeBtn.addEventListener("click", hideAll);

  iconBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    iconBtn.style.display = "none";
    if (!pendingTranslation) return;
    const { x, y, text, context } = pendingTranslation;
    triggerTranslation(x, y, text, context);
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
    const mode = settings.selectionMode || "immediate";
    if (mode === "off") return;

    if (e && e.composedPath && e.composedPath().includes(host)) return;
    if (e && isIgnoredElement(e.target)) return;

    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;

    const text = sel.toString().trim();
    if (!text || text.length === 0) return;
    if (text === lastText && (card.style.display === "flex" || iconBtn.style.display === "flex")) {
      return;
    }

    let x = e ? e.clientX : window.innerWidth / 2;
    let y = e ? e.clientY : window.innerHeight / 2;

    try {
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        x = rect.left + rect.width / 2;
        y = rect.top;
      }
    } catch (_) {}

    let context = "";
    try {
      const container = sel.anchorNode?.parentElement;
      context = container?.innerText?.slice(0, 300) || "";
    } catch (_) {}

    mount();

    if (mode === "icon") {
      pendingTranslation = { x, y, text, context };
      card.style.display = "none";
      positionElement(iconBtn, x, y);
    } else {
      pendingTranslation = null;
      iconBtn.style.display = "none";
      triggerTranslation(x, y, text, context);
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
    }
  });

  document.addEventListener("selectionchange", () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      if (iconBtn.style.display === "flex") {
        hideAll();
      }
    }
  });
})();

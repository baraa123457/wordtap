(() => {
  // Containers that hold subtitles on supported sites.
  const SUBTITLE_SELECTOR = [
    ".ytp-caption-window-container", // YouTube
    ".caption-window", // YouTube
    ".player-timedtext", // Netflix
    ".vjs-text-track-display", // generic video.js
  ].join(",");

  const WORD_CHAR = /[\p{L}\p{M}\p{N}'’-]/u;
  const RTL_LANGS = ["ar", "fa", "ur", "he"];

  // What the tooltip says about where a saved word went.
  const SAVE_NOTES = {
    synced: { text: "✓ Saved to your WordTap account", warn: false },
    queued: { text: "✓ Saved here · will sync when you're online", warn: true },
    "signed-out": { text: "✓ Saved here · sign in from the toolbar icon to sync", warn: true },
    local: { text: "✓ Saved on this device", warn: true },
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
    pauseOnClick: false, // pause the video when a word is clicked
    saveWords: false, // keep every translated word
    translateSaveMode: "manual",
    hideSeconds: 3, // how long the tooltip stays (0 = until closed)
    targetLang: "ar",
  };
  if (isContextValid() && chrome.storage && chrome.storage.sync) {
    try {
      chrome.storage.sync.get(settings, (v) => Object.assign(settings, v));
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "sync") return;
        for (const k in changes) settings[k] = changes[k].newValue;
        if (!settings.enabled) hideTip();
      });
    } catch (_) {}
  }

  // ---------- Tooltip (Shadow DOM so page CSS can't break it) ----------
  const host = document.createElement("div");
  host.style.cssText = "all:initial;position:fixed;z-index:2147483647;top:0;left:0;";
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      .tip{position:fixed;display:none;max-width:320px;min-width:130px;padding:10px 12px;
        background:#111827;color:#fff;border-radius:10px;font:14px/1.4 system-ui,sans-serif;
        box-shadow:0 6px 24px rgba(0,0,0,.45);border:1px solid #374151;pointer-events:auto}
      .orig-line{display:flex;align-items:center;gap:6px;margin-bottom:4px;padding-right:16px}
      .orig{opacity:.75;font-size:12px;word-break:break-word}
      .spk-btn{background:none;border:none;color:#facc3b;cursor:pointer;padding:2px 4px;border-radius:4px;display:inline-flex;align-items:center;transition:transform .1s,color .1s}
      .spk-btn:hover{color:#ffe270;transform:scale(1.15)}
      .spk-btn.speaking{color:#3fd69a}
      .tr{font-size:17px;font-weight:600;word-break:break-word}
      .tr[dir=rtl]{text-align:right}
      .saved{margin-top:6px;font-size:11px;color:#34d399;display:none}
      .saved[data-warn="true"]{color:#fbbf24}
      .save-btn{background:#facc3b;color:#000;border:none;cursor:pointer;padding:4px 9px;border-radius:6px;font-size:11px;font-weight:700;display:none;align-items:center;gap:4px;margin-top:8px;transition:background .1s,transform .1s}
      .save-btn:hover{background:#ffe270;transform:scale(1.03)}
      .save-btn.saved{background:rgba(52,211,153,.2);color:#34d399;border:1px solid rgba(52,211,153,.3);cursor:default;transform:none}
      .x{position:absolute;top:2px;right:6px;cursor:pointer;opacity:.5;font-size:14px}
      .x:hover{opacity:1}
    </style>
    <div class="tip">
      <span class="x">×</span>
      <div class="orig-line">
        <div class="orig"></div>
        <button class="spk-btn" title="Pronounce in English" aria-label="Listen">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
          </svg>
        </button>
      </div>
      <div class="tr"></div>
      <button class="save-btn" title="Save word to My Words">⭐ + Save to My Words</button>
      <div class="saved"></div>
    </div>`;
  const tip = shadow.querySelector(".tip");
  const origEl = shadow.querySelector(".orig");
  const spkBtn = shadow.querySelector(".spk-btn");
  const trEl = shadow.querySelector(".tr");
  const saveBtn = shadow.querySelector(".save-btn");
  const savedEl = shadow.querySelector(".saved");
  shadow.querySelector(".x").addEventListener("click", hideTip);

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

  spkBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!currentOrigText || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(currentOrigText);
      const code = (currentSrcLang && currentSrcLang !== "auto" ? currentSrcLang : "en").toLowerCase().slice(0, 2);
      u.lang = LANG_VOICES[code] || "en-US";
      u.rate = 0.92;

      const voices = window.speechSynthesis.getVoices();
      const voice = voices.find(v => v.lang.toLowerCase().startsWith(code) && !v.localService) ||
                    voices.find(v => v.lang.toLowerCase().startsWith(code));
      if (voice) u.voice = voice;

      spkBtn.classList.add("speaking");
      u.onend = () => spkBtn.classList.remove("speaking");
      u.onerror = () => spkBtn.classList.remove("speaking");
      window.speechSynthesis.speak(u);
    } catch (_) {
      spkBtn.classList.remove("speaking");
    }
  });

  function mount() {
    // In fullscreen only the fullscreen element's subtree is visible.
    const parent = document.fullscreenElement || document.documentElement;
    if (host.parentNode !== parent) parent.appendChild(host);
  }
  document.addEventListener("fullscreenchange", () => host.isConnected && mount());

  let pausedByUs = null;
  let hideTimer = null;
  let tipToken = 0; // lets late replies know the tooltip has moved on

  function pauseVideo() {
    const v = document.querySelector("video");
    if (v && !v.paused) {
      v.pause();
      pausedByUs = v;
    }
  }

  function hideTip() {
    clearTimeout(hideTimer);
    tip.style.display = "none";
    if (pausedByUs) {
      pausedByUs.play().catch(() => {});
      pausedByUs = null;
    }
  }

  let currentPendingEntry = null;

  saveBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!currentPendingEntry || saveBtn.classList.contains("saved")) return;
    saveBtn.textContent = "Saving…";
    safeSendMessage({ type: "save", entry: currentPendingEntry }, (saved) => {
      if (!isContextValid()) return;
      if (saved && saved.ok) {
        saveBtn.classList.add("saved");
        saveBtn.textContent = "✓ In your words";
        const note = SAVE_NOTES[saved.cloud] || SAVE_NOTES.local;
        setNote(note.text, note.warn);
      } else {
        saveBtn.textContent = "⭐ + Save to My Words";
        setNote("Could not save this word", true);
      }
    });
  });

  function setNote(note, warn) {
    savedEl.textContent = note;
    savedEl.dataset.warn = String(Boolean(warn));
    savedEl.style.display = note ? "block" : "none";
  }

  function showTip(x, y, original, translated, rtl, note, warn, srcLang) {
    mount();
    currentOrigText = original;
    if (srcLang) currentSrcLang = srcLang;
    origEl.textContent = original;
    trEl.textContent = translated;
    trEl.dir = rtl ? "rtl" : "ltr";
    setNote(note, warn);
    saveBtn.style.display = "none";
    saveBtn.classList.remove("saved");
    saveBtn.textContent = "⭐ + Save to My Words";
    tip.style.display = "block";
    const r = tip.getBoundingClientRect();
    const left = Math.min(Math.max(8, x - r.width / 2), window.innerWidth - r.width - 8);
    let top = y - r.height - 14;
    if (top < 8) top = y + 28;
    tip.style.left = left + "px";
    tip.style.top = top + "px";

    // Close the tooltip by itself after the chosen time (0 = stay until closed).
    clearTimeout(hideTimer);
    const secs = Number(settings.hideSeconds);
    if (secs > 0 && translated !== "…") hideTimer = setTimeout(hideTip, secs * 1000);
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
      cont;
    return seg.innerText.replace(/\s+/g, " ").trim();
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
        const v = document.querySelector("video");
        wasPlaying = !!(v && !v.paused);
      }
    },
    true
  );

  function resumeIfNeeded() {
    if (settings.pauseOnClick || !wasPlaying) return;
    const v = document.querySelector("video");
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

      if (settings.pauseOnClick) pauseVideo();
      else resumeIfNeeded();

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

        const willSave = settings.saveWords === true && settings.translateSaveMode !== "manual";
        showTip(e.clientX, e.clientY, text, res.text, RTL_LANGS.includes(target), willSave ? "Saving…" : "", false, finalSrc);

        const entry = {
          text,
          translation: res.text,
          lang: target,
          src: finalSrc,
          page: location.href,
          title: document.title,
          saved: Boolean(willSave),
        };
        currentPendingEntry = entry;

        // Always record to translation history
        safeSendMessage({ type: "history:add", entry });

        if (!willSave) {
          // Manual Save Mode: show the Save button!
          saveBtn.style.display = "inline-flex";
          saveBtn.classList.remove("saved");
          saveBtn.textContent = "⭐ + Save to My Words";
          return;
        }

        // Auto Save Mode:
        saveBtn.style.display = "none";
        safeSendMessage({ type: "save", entry }, (saved) => {
          if (!isContextValid() || token !== tipToken) return;
          if (!saved || !saved.ok) {
            setNote("Could not save this word", true);
            return;
          }
          const note = SAVE_NOTES[saved.cloud] || SAVE_NOTES.local;
          setNote(note.text, note.warn);
        });
      });
    },
    true
  );

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideTip();
  });
})();

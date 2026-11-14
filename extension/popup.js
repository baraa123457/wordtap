import { CONFIG, getWebsiteUrl } from "./config.js";

const RTL = ["ar", "fa", "ur", "he"];
const $ = (id) => document.getElementById(id);
const send = (msg) => new Promise((resolve) => chrome.runtime.sendMessage(msg, resolve));

// ---------- View Navigation (Home <-> Settings) ----------
const viewHome = $("viewHome");
const viewSettings = $("viewSettings");
const openSettingsBtn = $("openSettingsBtn");
const backToHomeBtn = $("backToHomeBtn");
const heroSignInBtn = $("heroSignInBtn");

function showSettingsView() {
  if (!viewHome || !viewSettings) return;
  viewHome.classList.add("slide-left");
  viewHome.hidden = true;
  viewSettings.hidden = false;
  requestAnimationFrame(() => {
    viewSettings.classList.remove("slide-right");
    if (backToHomeBtn) backToHomeBtn.focus();
  });
}

function showHomeView() {
  if (!viewHome || !viewSettings) return;
  viewSettings.classList.add("slide-right");
  viewSettings.hidden = true;
  viewHome.hidden = false;
  requestAnimationFrame(() => {
    viewHome.classList.remove("slide-left");
    if (openSettingsBtn) openSettingsBtn.focus();
  });
}

if (openSettingsBtn) openSettingsBtn.addEventListener("click", showSettingsView);
if (backToHomeBtn) backToHomeBtn.addEventListener("click", showHomeView);
if (heroSignInBtn) {
  heroSignInBtn.addEventListener("click", () => {
    showSettingsView();
    setTimeout(() => {
      const emailInput = $("email");
      if (emailInput) emailInput.focus();
    }, 150);
  });
}

// Keyboard navigation between views
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (viewSettings && !viewSettings.hidden) {
      e.preventDefault();
      showHomeView();
    }
  }
});

// ---------- Master On/Off Switch ----------
function updateEnabledUI(isEnabled) {
  const homeBody = $("homeBody");
  const disabledBanner = $("disabledBanner");
  if (homeBody) homeBody.classList.toggle("is-disabled", !isEnabled);
  if (disabledBanner) disabledBanner.classList.toggle("show", !isEnabled);
}

// ---------- Segmented Control for Save Mode ----------
const SAVE_MODE_HELPERS = {
  manual: "Click ⭐ on any translation tooltip to save",
  subtitles_only: "Auto-saves words clicked in video subtitles",
  auto: "Automatically saves every translated word",
};

function updateSaveModeUI(mode) {
  const normalized = mode === "auto" || mode === "subtitles_only" ? mode : "manual";
  const segmentBtns = document.querySelectorAll(".segment-btn");
  segmentBtns.forEach((btn) => {
    const isActive = btn.dataset.mode === normalized;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-checked", String(isActive));
  });

  const helper = $("saveModeHelper");
  if (helper) {
    helper.textContent = SAVE_MODE_HELPERS[normalized] || SAVE_MODE_HELPERS.manual;
  }

  const legacySelect = $("translateSaveMode");
  if (legacySelect) legacySelect.value = normalized;
}

document.querySelectorAll(".segment-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const mode = btn.dataset.mode;
    updateSaveModeUI(mode);
    chrome.storage.sync.set({
      translateSaveMode: mode,
      saveWords: mode !== "manual",
    });
  });
});

// ---------- Sync Status Indicator ----------
function updateSyncStatusUI({ syncing = false, offline = false, pending = 0, lastSync = null }) {
  const dot = $("syncDot");
  const text = $("syncText");
  const container = $("syncStatus");
  if (!dot || !text) return;

  dot.className = "sync-dot";

  if (syncing) {
    dot.classList.add("syncing");
    text.textContent = "Syncing…";
    if (container) container.title = "Synchronizing words with your WordTap account…";
  } else if (offline) {
    dot.classList.add("offline");
    text.textContent = "Offline · will sync later";
    if (container) container.title = "Could not connect to WordTap. Saved words will sync automatically once online.";
  } else if (pending > 0) {
    dot.classList.add("queued");
    text.textContent = `${pending} waiting to sync`;
    if (container) container.title = `${pending} ${pending === 1 ? "word is" : "words are"} queued to sync with your account.`;
  } else {
    text.textContent = "Synced just now";
    if (container) container.title = "All saved words are safely backed up to your WordTap cloud account.";
  }
}

// ---------- Settings Initialization ----------
const DEFAULTS = {
  enabled: true,
  saveWords: false,
  translateSaveMode: "manual",
  targetLang: "ar",
  selectionMode: "immediate",
};

chrome.storage.sync.get(DEFAULTS, (s) => {
  const isEnabled = s.enabled !== false;
  if ($("enabled")) $("enabled").checked = isEnabled;
  updateEnabledUI(isEnabled);

  const mode = s.translateSaveMode || (s.saveWords ? "auto" : "manual");
  updateSaveModeUI(mode);

  if ($("lang")) $("lang").value = s.targetLang || "ar";
  if ($("selectionMode")) $("selectionMode").value = s.selectionMode || "immediate";
});

if ($("enabled")) {
  $("enabled").addEventListener("change", (e) => {
    const isChecked = e.target.checked;
    updateEnabledUI(isChecked);
    chrome.storage.sync.set({ enabled: isChecked });
  });
}

if ($("lang")) {
  $("lang").addEventListener("change", (e) => chrome.storage.sync.set({ targetLang: e.target.value }));
}

if ($("selectionMode")) {
  $("selectionMode").addEventListener("change", (e) =>
    chrome.storage.sync.set({ selectionMode: e.target.value })
  );
}

if ($("openOptionsBtn")) {
  $("openOptionsBtn").addEventListener("click", () => {
    if (chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage();
    else window.open(chrome.runtime.getURL("options.html"));
  });
}

// Screen OCR Action
if ($("ocrCaptureBtn")) {
  $("ocrCaptureBtn").addEventListener("click", () => {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      if (tab && tab.id) {
        chrome.runtime.sendMessage({
          type: "ocr:start-tab",
          tabId: tab.id,
        });
      }
      setTimeout(() => window.close(), 100);
    });
  });
}

// ---------- Account & Hero State ----------
const panels = ["acctLoading", "acctUnconfigured", "signInForm", "signedIn"];
function showPanel(name) {
  for (const id of panels) {
    const el = $(id);
    if (el) el.hidden = id !== name;
  }
}

async function renderAccount(s) {
  const webUrl = await getWebsiteUrl().catch(() => CONFIG.WEBSITE_URL);
  if ($("signUpLink")) $("signUpLink").href = webUrl + "/signup";
  if ($("openSite")) $("openSite").href = webUrl + "/practice";
  if ($("viewAllWordsLink")) $("viewAllWordsLink").href = webUrl + "/words";
  if ($("logoLink")) $("logoLink").href = webUrl;

  const heroSignedIn = $("heroSignedInState");
  const heroSignedOut = $("heroSignedOutState");

  if (!s || !s.ok) {
    showPanel("acctUnconfigured");
    if (heroSignedIn) heroSignedIn.hidden = true;
    if (heroSignedOut) heroSignedOut.hidden = false;
    updateSyncStatusUI({ offline: true });
    return;
  }

  if (!s.configured) {
    showPanel("acctUnconfigured");
    if (heroSignedIn) heroSignedIn.hidden = true;
    if (heroSignedOut) heroSignedOut.hidden = false;
    updateSyncStatusUI({ offline: false, pending: s.pending || 0 });
    return;
  }

  if (!s.signedIn) {
    showPanel("signInForm");
    if (heroSignedIn) heroSignedIn.hidden = true;
    if (heroSignedOut) heroSignedOut.hidden = false;
    updateSyncStatusUI({ offline: false, pending: s.pending || 0 });
    return;
  }

  // Signed in!
  if (heroSignedIn) heroSignedIn.hidden = false;
  if (heroSignedOut) heroSignedOut.hidden = true;

  if ($("who")) $("who").textContent = s.email;

  // Fetch real study stats (due, streak, XP) from WordTap backend
  send({ type: "stats:get" }).then((st) => {
    const dueCountEl = $("heroDueCount");
    const dueLabelEl = $("heroDueLabel");
    const practiceBtn = $("openSite");
    const streakEl = $("heroStreakText");
    const xpEl = $("heroXpText");
    const studyBadge = $("studyBadge");

    if (st && st.ok) {
      const due = typeof st.due === "number" ? st.due : 0;
      const streak = typeof st.streak === "number" ? st.streak : 0;
      const xp = typeof st.xp === "number" ? st.xp : 0;

      if (dueCountEl) dueCountEl.textContent = String(due);
      if (streakEl) streakEl.textContent = `${streak}-day streak`;
      if (xpEl) xpEl.textContent = `${xp} XP`;

      if (due > 0) {
        if (dueLabelEl) dueLabelEl.textContent = due === 1 ? "word due today" : "words due today";
        if (practiceBtn) {
          practiceBtn.textContent = "Practice now →";
          practiceBtn.className = "btn btn-primary btn-block";
        }
      } else {
        if (dueLabelEl) dueLabelEl.textContent = "You're all caught up!";
        if (practiceBtn) {
          practiceBtn.textContent = "Review words anyway";
          practiceBtn.className = "btn btn-secondary btn-block";
        }
      }

      if (studyBadge) {
        const parts = [
          `${due} due today`,
          streak > 0 ? `${streak}-day streak` : null,
          `${xp} XP`,
        ].filter(Boolean);
        studyBadge.textContent = parts.join(" · ");
        studyBadge.hidden = false;
      }
    } else {
      if (dueCountEl) dueCountEl.textContent = "0";
      if (dueLabelEl) dueLabelEl.textContent = "Ready to practice";
      if (studyBadge) studyBadge.hidden = true;
    }
  });

  const pending = typeof s.pending === "number" ? s.pending : 0;
  if ($("syncLine")) {
    $("syncLine").textContent =
      pending === 0
        ? "All saved words are backed up to your account."
        : `${pending} ${pending === 1 ? "word is" : "words are"} waiting to sync.`;
  }
  if ($("syncError")) $("syncError").hidden = true;

  updateSyncStatusUI({ pending });
  showPanel("signedIn");
}

async function refreshAccount() {
  renderAccount(await send({ type: "auth:status" }));
}

// Sign In Form Submission
if ($("signInForm")) {
  $("signInForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("signInBtn");
    btn.disabled = true;
    btn.textContent = "Signing in…";
    if ($("authError")) $("authError").hidden = true;

    const res = await send({
      type: "auth:signIn",
      email: $("email").value.trim(),
      password: $("password").value,
    });

    btn.disabled = false;
    btn.textContent = "Sign in";
    if (!res || !res.ok) {
      if ($("authError")) {
        $("authError").textContent = (res && res.error) || "Could not sign in. Check your credentials and try again.";
        $("authError").hidden = false;
      }
      return;
    }
    if ($("password")) $("password").value = "";
    renderAccount(res);
    loadWords();
    showHomeView();
  });
}

// Password eye visibility toggle
const EYE_OPEN = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
const EYE_CLOSED = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>';

if ($("pwToggle")) {
  $("pwToggle").addEventListener("click", () => {
    const pw = $("password");
    if (!pw) return;
    const showing = pw.type === "text";
    pw.type = showing ? "password" : "text";
    if ($("eyeIcon")) $("eyeIcon").innerHTML = showing ? EYE_OPEN : EYE_CLOSED;
    $("pwToggle").setAttribute("aria-label", showing ? "Show password" : "Hide password");
  });
}

if ($("signOutBtn")) {
  $("signOutBtn").addEventListener("click", async () => {
    renderAccount(await send({ type: "auth:signOut" }));
  });
}

if ($("syncBtn")) {
  $("syncBtn").addEventListener("click", async () => {
    const btn = $("syncBtn");
    btn.disabled = true;
    btn.textContent = "Syncing…";
    updateSyncStatusUI({ syncing: true });

    const res = await send({ type: "sync" });
    btn.disabled = false;
    btn.textContent = "Sync now";
    renderAccount(res);

    if (res && !res.ok) {
      if ($("syncError")) {
        $("syncError").textContent = res.error || "Could not sync. Try again in a moment.";
        $("syncError").hidden = false;
      }
      updateSyncStatusUI({ offline: true });
    } else {
      updateSyncStatusUI({ pending: 0 });
    }
    loadWords();
  });
}

refreshAccount();

// ---------- Saved Words (Device Cache & 5 Recent Display) ----------
let words = {};

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
  zh: "zh-CN",
};

function entries() {
  return Object.entries(words).sort((a, b) => (b[1].lastSeen || 0) - (a[1].lastSeen || 0));
}

function render() {
  const allRows = entries();
  const totalCount = allRows.length;

  if ($("count")) $("count").textContent = String(totalCount);
  if ($("cacheCountText")) $("cacheCountText").textContent = String(totalCount);
  if ($("confirmWordCount")) $("confirmWordCount").textContent = String(totalCount);

  const list = $("list");
  if (!list) return;
  list.textContent = "";

  if (!totalCount) {
    const emptyCard = document.createElement("div");
    emptyCard.className = "empty-words-card";
    emptyCard.innerHTML = `
      <div class="empty-icon">📖</div>
      <div class="empty-title">No words saved yet</div>
      <div class="empty-desc">Click any word in video subtitles or select text on any page to translate and save.</div>
    `;
    list.appendChild(emptyCard);
    return;
  }

  // Render ONLY the 5 latest recent words for high performance & clean fit
  const recentRows = allRows.slice(0, 5);

  for (const [key, w] of recentRows) {
    const row = document.createElement("div");
    row.className = "word-row";

    const cleanText = (w.text || "")
      .replace(/::[a-z]{2,5}$/i, "")
      .replace(/[\u200B-\u200F\uFEFF\u2060]/g, "")
      .trim();

    const textCol = document.createElement("div");
    textCol.className = "word-text-col";

    const srcSpan = document.createElement("span");
    srcSpan.className = "word-src";
    srcSpan.textContent = cleanText;
    srcSpan.title = cleanText;

    const trSpan = document.createElement("span");
    trSpan.className = "word-tr";
    trSpan.textContent = w.translation || "";
    trSpan.dir = "auto";
    trSpan.title = w.translation || "";

    textCol.append(srcSpan, trSpan);

    const actions = document.createElement("div");
    actions.className = "word-actions";

    // Audio button
    const spk = document.createElement("button");
    spk.type = "button";
    spk.className = "action-icon-btn spk";
    spk.title = `Pronounce "${cleanText}"`;
    spk.setAttribute("aria-label", `Pronounce ${cleanText}`);
    spk.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
      </svg>
    `;
    spk.addEventListener("click", (e) => {
      e.stopPropagation();
      const code = (w.src && w.src !== "auto" ? w.src : "en").toLowerCase().slice(0, 2);
      const fallbackRemote = async () => {
        try {
          const res = await send({ type: "tts:speak", text: cleanText, lang: code });
          if (res && res.ok && res.dataUrl) {
            const audio = new Audio(res.dataUrl);
            audio.onended = () => spk.classList.remove("speaking");
            audio.onerror = () => spk.classList.remove("speaking");
            await audio.play();
            return;
          }
        } catch (_) {}
        spk.classList.remove("speaking");
      };

      spk.classList.add("speaking");
      if (!("speechSynthesis" in window)) {
        void fallbackRemote();
        return;
      }
      try {
        window.speechSynthesis.cancel();
        const voices = window.speechSynthesis.getVoices();
        const voice =
          voices.find((v) => v.lang.toLowerCase().startsWith(code) && !v.localService) ||
          voices.find((v) => v.lang.toLowerCase().startsWith(code));

        if (!voice && voices.length > 0) {
          void fallbackRemote();
          return;
        }

        const u = new SpeechSynthesisUtterance(cleanText);
        u.lang = LANG_VOICES[code] || "en-US";
        u.rate = 0.92;
        if (voice) u.voice = voice;

        u.onend = () => spk.classList.remove("speaking");
        u.onerror = () => { void fallbackRemote(); };
        window.speechSynthesis.speak(u);
      } catch (_) {
        void fallbackRemote();
      }
    });

    // Delete button (reveals on hover/focus)
    const del = document.createElement("button");
    del.type = "button";
    del.className = "action-icon-btn del-btn";
    del.title = `Delete "${cleanText}"`;
    del.setAttribute("aria-label", `Delete word ${cleanText}`);
    del.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `;
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      const targetText = w.text;
      const targetSrc = w.src;
      const targetLang = w.lang;
      delete words[key];
      chrome.storage.local.set({ words }, render);
      chrome.runtime.sendMessage({
        type: "word:delete",
        text: targetText,
        srcLang: targetSrc,
        targetLang: targetLang,
      });
    });

    actions.append(spk, del);
    row.append(textCol, actions);
    list.appendChild(row);
  }
}

function loadWords() {
  chrome.storage.local.get({ words: {} }, (v) => {
    words = v.words || {};
    render();
  });
}
loadWords();

// Storage change listener
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.words) {
    words = changes.words.newValue || {};
    render();
  }
  if (area === "local" && (changes.words || changes.session)) refreshAccount();
  if (area === "sync" && changes.enabled) {
    if ($("enabled")) $("enabled").checked = changes.enabled.newValue !== false;
    updateEnabledUI(changes.enabled.newValue !== false);
  }
  if (area === "sync" && changes.translateSaveMode) {
    updateSaveModeUI(changes.translateSaveMode.newValue);
  }
});

// ---------- Device Cache Clearing with Inline Confirmation ----------
const clearBtn = $("clearBtn");
const clearConfirmBox = $("clearConfirmBox");
const cancelClearBtn = $("cancelClearBtn");
const confirmClearBtn = $("confirmClearBtn");

if (clearBtn && clearConfirmBox) {
  clearBtn.addEventListener("click", () => {
    if (!Object.keys(words).length) return;
    clearConfirmBox.hidden = false;
  });
}

if (cancelClearBtn && clearConfirmBox) {
  cancelClearBtn.addEventListener("click", () => {
    clearConfirmBox.hidden = true;
  });
}

if (confirmClearBtn && clearConfirmBox) {
  confirmClearBtn.addEventListener("click", () => {
    chrome.storage.local.set({ words: {} }, () => {
      words = {};
      clearConfirmBox.hidden = true;
      render();
    });
  });
}

// Legacy clear button fallback
if ($("clear")) {
  $("clear").addEventListener("click", () => {
    if (clearBtn) clearBtn.click();
  });
}

// ---------- CSV Export with UTF-8 BOM ----------
if ($("export")) {
  $("export").addEventListener("click", () => {
    const rows = Object.values(words).sort((a, b) => (a.firstSeen || 0) - (b.firstSeen || 0));
    if (!rows.length) return;
    const esc = (s) => '"' + String(s ?? "").replace(/"/g, '""') + '"';
    const csv =
      "word,translation,from,to,times,first_seen,source\n" +
      rows
        .map((w) =>
          [
            w.text,
            w.translation,
            w.src,
            w.lang,
            w.count,
            w.firstSeen ? new Date(w.firstSeen).toISOString() : "",
            w.title || "",
          ]
            .map(esc)
            .join(",")
        )
        .join("\n");
    // BOM (\uFEFF) so Excel displays Arabic glyphs properly
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "saved-words.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  });
}

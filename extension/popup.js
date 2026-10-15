import { CONFIG } from "./config.js";

const RTL = ["ar", "fa", "ur", "he"];
const $ = (id) => document.getElementById(id);
const send = (msg) => new Promise((resolve) => chrome.runtime.sendMessage(msg, resolve));

// ---------- Settings ----------
const DEFAULTS = {
  enabled: true,
  pauseOnClick: false,
  saveWords: true,
  hideSeconds: 3,
  targetLang: "ar",
  selectionMode: "immediate",
};

chrome.storage.sync.get(DEFAULTS, (s) => {
  $("enabled").checked = s.enabled;
  $("pauseOnClick").checked = s.pauseOnClick;
  $("saveWords").checked = s.saveWords;
  $("lang").value = s.targetLang;
  $("hideSeconds").value = String(s.hideSeconds);
  if ($("selectionMode")) $("selectionMode").value = s.selectionMode || "immediate";
});

for (const id of ["enabled", "pauseOnClick", "saveWords"]) {
  $(id).addEventListener("change", (e) => chrome.storage.sync.set({ [id]: e.target.checked }));
}
$("lang").addEventListener("change", (e) => chrome.storage.sync.set({ targetLang: e.target.value }));
$("hideSeconds").addEventListener("change", (e) =>
  chrome.storage.sync.set({ hideSeconds: Number(e.target.value) })
);
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

// ---------- Account ----------
const panels = ["acctLoading", "acctUnconfigured", "signInForm", "signedIn"];
function showPanel(name) {
  for (const id of panels) $(id).hidden = id !== name;
}

function renderAccount(s) {
  if (!s || !s.ok) {
    showPanel("acctUnconfigured");
    return;
  }
  $("signUpLink").href = CONFIG.WEBSITE_URL + "/signup";
  $("openSite").href = CONFIG.WEBSITE_URL + "/dashboard";

  if (!s.configured) return showPanel("acctUnconfigured");
  if (!s.signedIn) return showPanel("signInForm");

  $("who").textContent = s.email;
  $("syncLine").textContent =
    s.pending === 0
      ? "All saved words are in your account."
      : `${s.pending} ${s.pending === 1 ? "word is" : "words are"} waiting to sync.`;
  $("syncError").hidden = true;
  showPanel("signedIn");
}

async function refreshAccount() {
  renderAccount(await send({ type: "auth:status" }));
}

$("signInForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("signInBtn");
  btn.disabled = true;
  btn.textContent = "Signing in…";
  $("authError").hidden = true;

  const res = await send({
    type: "auth:signIn",
    email: $("email").value.trim(),
    password: $("password").value,
  });

  btn.disabled = false;
  btn.textContent = "Sign in";
  if (!res || !res.ok) {
    $("authError").textContent = (res && res.error) || "Could not sign in. Check your connection and try again.";
    $("authError").hidden = false;
    return;
  }
  $("password").value = "";
  renderAccount(res);
  loadWords();
});

// Show / hide password toggle
const EYE_OPEN = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
const EYE_CLOSED = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>';
$("pwToggle").addEventListener("click", () => {
  const pw = $("password");
  const showing = pw.type === "text";
  pw.type = showing ? "password" : "text";
  $("eyeIcon").innerHTML = showing ? EYE_OPEN : EYE_CLOSED;
  $("pwToggle").setAttribute("aria-label", showing ? "Show password" : "Hide password");
});
$("signOutBtn").addEventListener("click", async () => {
  renderAccount(await send({ type: "auth:signOut" }));
});

$("syncBtn").addEventListener("click", async () => {
  const btn = $("syncBtn");
  btn.disabled = true;
  btn.textContent = "Syncing…";
  const res = await send({ type: "sync" });
  btn.disabled = false;
  btn.textContent = "Sync now";
  renderAccount(res);
  if (res && !res.ok) {
    $("syncError").textContent = res.error || "Could not sync. Try again in a moment.";
    $("syncError").hidden = false;
  }
  loadWords();
});

refreshAccount();

// ---------- Saved words on this device ----------
let words = {};
let currentLangFilter = "all";
const pendingOf = (w) => (typeof w.pending === "number" ? w.pending : w.count || 1);

const LANG_NAMES = {
  en: "English",
  de: "German",
  fr: "French",
  es: "Spanish",
  it: "Italian",
  pt: "Portuguese",
  tr: "Turkish",
  ru: "Russian",
  ar: "Arabic",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese",
  auto: "Other",
};

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
  const q = $("search").value.trim().toLowerCase();
  return Object.entries(words)
    .filter(([, w]) => {
      if (currentLangFilter !== "all") {
        const srcCode = (w.src || "auto").toLowerCase();
        if (srcCode !== currentLangFilter) return false;
      }
      return !q || w.text.toLowerCase().includes(q) || w.translation.toLowerCase().includes(q);
    })
    .sort((a, b) => b[1].lastSeen - a[1].lastSeen);
}

function render() {
  const rows = entries();
  $("count").textContent = Object.keys(words).length;
  const list = $("list");
  list.textContent = "";

  const langPills = $("langPills");
  if (langPills) {
    langPills.innerHTML = "";
    const counts = new Map();
    for (const w of Object.values(words)) {
      const code = (w.src || "auto").toLowerCase();
      counts.set(code, (counts.get(code) || 0) + 1);
    }
    if (counts.size > 1) {
      langPills.style.display = "flex";
      const makeBtn = (id, label) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "lang-pill" + (currentLangFilter === id ? " active" : "");
        btn.textContent = label;
        btn.addEventListener("click", () => {
          currentLangFilter = id;
          render();
        });
        return btn;
      };
      langPills.appendChild(makeBtn("all", `All (${Object.keys(words).length})`));
      for (const [code, cnt] of counts.entries()) {
        const name = LANG_NAMES[code] || code.toUpperCase();
        langPills.appendChild(makeBtn(code, `${name} (${cnt})`));
      }
    } else {
      langPills.style.display = "none";
    }
  }

  if (!rows.length) {
    const d = document.createElement("div");
    d.className = "empty";
    d.textContent = Object.keys(words).length ? "No matches in this language" : "No saved words yet";
    list.appendChild(d);
    return;
  }

  for (const [key, w] of rows) {
    const item = document.createElement("div");
    item.className = "item";

    const box = document.createElement("div");
    box.className = "w";
    const cleanText = (w.text || "").replace(/::[a-z]{2,5}$/i, "").replace(/[\u200B-\u200F\uFEFF\u2060]/g, "").trim();
    const t = document.createElement("div");
    t.className = "t";
    t.textContent = cleanText;
    const tr = document.createElement("div");
    tr.className = "tr";
    tr.textContent = w.translation;
    tr.dir = RTL.includes(w.lang) ? "rtl" : "ltr";
    const c = document.createElement("div");
    c.className = "c";
    const srcName = LANG_NAMES[w.src] || (w.src ? w.src.toUpperCase() : "?");
    c.textContent = `${srcName} → ${w.lang} · ×${w.count || 1}` + (pendingOf(w) > 0 ? " · not synced" : "");
    box.append(t, tr, c);

    const spk = document.createElement("button");
    spk.className = "spk";
    const langLabel = LANG_NAMES[w.src] || "Pronounce";
    spk.title = `Listen in ${langLabel}`;
    spk.setAttribute("aria-label", `Listen in ${langLabel}`);
    spk.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>`;
    spk.addEventListener("click", () => {
      if (!("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(cleanText);
      const code = (w.src && w.src !== "auto" ? w.src : "en").toLowerCase().slice(0, 2);
      u.lang = LANG_VOICES[code] || "en-US";
      u.rate = 0.92;

      const voices = window.speechSynthesis.getVoices();
      const voice = voices.find(v => v.lang.toLowerCase().startsWith(code) && !v.localService) ||
                    voices.find(v => v.lang.toLowerCase().startsWith(code));
      if (voice) u.voice = voice;

      spk.classList.add("speaking");
      u.onend = () => spk.classList.remove("speaking");
      u.onerror = () => spk.classList.remove("speaking");
      window.speechSynthesis.speak(u);
    });

    const del = document.createElement("button");
    del.className = "del";
    del.title = "Delete from this device";
    del.textContent = "×";
    del.addEventListener("click", () => {
      delete words[key];
      chrome.storage.local.set({ words }, render);
    });

    item.append(box, spk, del);
    list.appendChild(item);
  }
}

function loadWords() {
  chrome.storage.local.get({ words: {} }, (v) => {
    words = v.words;
    render();
  });
}
loadWords();
$("search").addEventListener("input", render);

// Stay in sync if a word is saved (or synced) while the popup is open.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.words) {
    words = changes.words.newValue || {};
    render();
  }
  if (area === "local" && (changes.words || changes.session)) refreshAccount();
});

$("clear").addEventListener("click", () => {
  if (!Object.keys(words).length) return;
  if (confirm("Delete all words saved on this device? Words already in your account stay there.")) {
    chrome.storage.local.set({ words: {} });
  }
});

$("export").addEventListener("click", () => {
  const rows = Object.values(words).sort((a, b) => a.firstSeen - b.firstSeen);
  if (!rows.length) return;
  const esc = (s) => '"' + String(s ?? "").replace(/"/g, '""') + '"';
  const csv =
    "word,translation,from,to,times,first_seen,source\n" +
    rows
      .map((w) =>
        [w.text, w.translation, w.src, w.lang, w.count, new Date(w.firstSeen).toISOString(), w.title]
          .map(esc)
          .join(",")
      )
      .join("\n");
  // BOM so Excel shows Arabic correctly.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "saved-words.csv";
  a.click();
  URL.revokeObjectURL(a.href);
});

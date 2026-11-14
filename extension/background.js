// Service worker: translation, TTS audio, context menus, and syncing saved words to WordTap.
import { CONFIG, getWebsiteUrl } from "./config.js";

// ---------------------------------------------------------------------------
// Translation & TTS
// ---------------------------------------------------------------------------
const cache = new Map();
const ttsCache = new Map();

function stripHtmlTags(str) {
  return String(str || "").replace(/<[^>]+>/g, "").trim();
}

async function translate(text, target, srcLang = "auto", context = "") {
  let sl = srcLang && srcLang !== "auto" ? srcLang.toLowerCase() : "auto";

  // If language is still auto and we have a full subtitle sentence, detect from the sentence!
  if (sl === "auto" && context && context.trim().length > text.trim().length) {
    try {
      const detectUrl =
        "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=" +
        encodeURIComponent(target) +
        "&dt=t&q=" +
        encodeURIComponent(context.trim());
      const detectRes = await fetch(detectUrl);
      if (detectRes.ok) {
        const detectData = await detectRes.json();
        if (detectData[2] && detectData[2] !== "auto") {
          sl = detectData[2].toLowerCase();
        }
      }
    } catch (_) {}
  }

  const key = sl + "|" + target + "|" + text.toLowerCase();
  if (cache.has(key)) return cache.get(key);

  const url =
    "https://translate.googleapis.com/translate_a/single?client=gtx&sl=" +
    encodeURIComponent(sl) +
    "&tl=" +
    encodeURIComponent(target) +
    "&dt=t&dt=bd&dt=qca&dt=at&q=" +
    encodeURIComponent(text);

  const res = await fetch(url);
  if (!res.ok) throw new Error("HTTP " + res.status);
  const data = await res.json();

  const detected = sl !== "auto" ? sl : data[2] ? data[2].toLowerCase() : "auto";
  const mainText = (data[0] || []).map((part) => part[0]).join("");

  let partsOfSpeech = [];
  const altSet = new Set();

  if (Array.isArray(data[1])) {
    partsOfSpeech = data[1]
      .map((item) => (Array.isArray(item) && typeof item[0] === "string" ? item[0].toLowerCase() : null))
      .filter(Boolean);
    for (const group of data[1]) {
      if (Array.isArray(group) && Array.isArray(group[1])) {
        for (const term of group[1]) {
          if (typeof term === "string" && term.trim() && term.trim().toLowerCase() !== mainText.trim().toLowerCase()) {
            altSet.add(term.trim());
          }
        }
      }
    }
  }

  // Check English dictionary definitions in data[12] for verb tenses
  if (Array.isArray(data[12])) {
    for (const group of data[12]) {
      if (Array.isArray(group) && group[0] === "verb") {
        if (!partsOfSpeech.includes("verb")) partsOfSpeech.unshift("verb");
        const defStr = JSON.stringify(group[1] || "").toLowerCase();
        if (defStr.includes("past participle") && !partsOfSpeech.includes("past_participle")) {
          partsOfSpeech.push("past_participle");
        }
        if (defStr.includes("past of") || defStr.includes("past tense") || defStr.includes("past and")) {
          if (!partsOfSpeech.includes("past")) partsOfSpeech.push("past");
        }
      }
    }
  }

  if (Array.isArray(data[5]) && Array.isArray(data[5][0]) && Array.isArray(data[5][0][2])) {
    for (const cand of data[5][0][2]) {
      if (Array.isArray(cand) && typeof cand[0] === "string") {
        const val = cand[0].trim();
        if (val && val.toLowerCase() !== mainText.trim().toLowerCase()) {
          altSet.add(val);
        }
      }
    }
  }

  let correction = null;
  if (Array.isArray(data[7])) {
    const rawCorr = typeof data[7][1] === "string" && data[7][1].trim() ? data[7][1] : stripHtmlTags(data[7][0]);
    if (rawCorr && rawCorr.toLowerCase() !== text.trim().toLowerCase()) {
      correction = rawCorr;
    }
  }

  // Fallback dictionary for non-English words if dictionary was empty
  if (partsOfSpeech.length === 0 && !text.includes(" ") && text.trim().length <= 35) {
    try {
      const enDictUrl =
        "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=bd&q=" +
        encodeURIComponent(text.trim());
      const enRes = await fetch(enDictUrl);
      if (enRes.ok) {
        const enData = await enRes.json();
        if (Array.isArray(enData[1])) {
          partsOfSpeech = enData[1]
            .map((item) => (Array.isArray(item) && typeof item[0] === "string" ? item[0].toLowerCase() : null))
            .filter(Boolean);
        }
      }
    } catch (_) {}
  }

  const primaryPos = partsOfSpeech[0] || null;
  const alternatives = Array.from(altSet).slice(0, 6);

  const result = {
    text: mainText,
    src: detected,
    partsOfSpeech,
    pos: primaryPos,
    alternatives,
    correction,
  };

  if (cache.size > 500) cache.delete(cache.keys().next().value);
  cache.set(key, result);
  return result;
}

async function fetchTtsDataUrl(text, lang = "en") {
  const clean = (text || "").trim().slice(0, 180);
  if (!clean) return { ok: false, error: "Empty text" };
  const tl = (lang && lang !== "auto" ? lang : "en").toLowerCase().split("-")[0];
  const cacheKey = `${tl}|${clean}`;
  if (ttsCache.has(cacheKey)) {
    return { ok: true, dataUrl: ttsCache.get(cacheKey) };
  }

  try {
    const ttsUrl =
      `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(tl)}&q=${encodeURIComponent(clean)}`;
    const res = await fetch(ttsUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    const dataUrl = `data:audio/mpeg;base64,${btoa(binary)}`;
    if (ttsCache.size > 80) ttsCache.delete(ttsCache.keys().next().value);
    ttsCache.set(cacheKey, dataUrl);
    return { ok: true, dataUrl };
  } catch (e) {
    return { ok: false, error: e?.message || "TTS fetch failed" };
  }
}

// ---------------------------------------------------------------------------
// Local word list
//
// Every saved word is kept on this device first, as { "<src>|<target>|<word>": entry }.
// Separating by source language prevents words with identical spellings across
// languages (e.g. "in", "name", "hand" in German vs English) from clashing.
// ---------------------------------------------------------------------------
let chain = Promise.resolve();
function enqueue(fn) {
  const run = chain.then(fn);
  chain = run.catch(() => {});
  return run;
}

const readWords = async () => (await chrome.storage.local.get({ words: {} })).words;
const pendingOf = (w) => (typeof w.pending === "number" ? w.pending : w.count || 1);

function saveLocal(e) {
  return enqueue(async () => {
    const words = await readWords();
    const srcCode = (e.src && e.src !== "auto") ? e.src.toLowerCase() : "auto";
    const key = srcCode + "|" + e.lang + "|" + e.text.toLowerCase();
    const now = Date.now();
    const prev = words[key];
    words[key] = prev
      ? {
          ...prev,
          translation: e.translation,
          title: e.title || prev.title || "",
          page: e.page || prev.page || "",
          count: (prev.count || 1) + 1,
          pending: pendingOf(prev) + 1,
          rejected: false,
          lastSeen: now,
        }
      : {
          text: e.text,
          translation: e.translation,
          lang: e.lang,
          src: e.src,
          title: e.title || "",
          page: e.page || "",
          count: 1,
          pending: 1,
          firstSeen: now,
          lastSeen: now,
        };
    await chrome.storage.local.set({ words });
  });
}

async function pendingTotal() {
  const words = await readWords();
  return Object.values(words).filter((w) => pendingOf(w) > 0).length;
}

// ---------------------------------------------------------------------------
// Supabase over plain REST (no SDK needed in a service worker)
// ---------------------------------------------------------------------------
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function configured() {
  const { SUPABASE_URL: url, SUPABASE_ANON_KEY: key } = CONFIG;
  return Boolean(url && key) && !url.includes("YOUR-PROJECT") && !key.startsWith("YOUR-");
}

async function request(path, { body, token, method } = {}) {
  const httpMethod = method || (body ? "POST" : "GET");
  const headers = {
    apikey: CONFIG.SUPABASE_ANON_KEY,
    Authorization: "Bearer " + (token || CONFIG.SUPABASE_ANON_KEY),
  };
  if (body) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(CONFIG.SUPABASE_URL + path, {
    method: httpMethod,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const message =
      (data && (data.error_description || data.msg || data.message || data.error)) || "HTTP " + res.status;
    throw new HttpError(res.status, message);
  }
  return data;
}

async function storeSession(data, fallbackUserId) {
  const session = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at || Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
    email: (data.user && data.user.email) || "",
    user_id: (data.user && data.user.id) || fallbackUserId || "",
  };
  await chrome.storage.local.set({ session });
  return session;
}

let refreshing = null;

/** Returns a valid access token, refreshing it when needed. Null when signed out. */
async function getToken(force = false) {
  const { session } = await chrome.storage.local.get("session");
  if (!session) return null;
  if (!force && session.expires_at - 60 > Date.now() / 1000) return session.access_token;

  if (!refreshing) {
    refreshing = (async () => {
      try {
        const data = await request("/auth/v1/token?grant_type=refresh_token", {
          body: { refresh_token: session.refresh_token },
        });
        return (await storeSession(data, session.user_id)).access_token;
      } catch (e) {
        // The refresh token was rejected: the user has to sign in again.
        if (e instanceof HttpError && [400, 401, 403].includes(e.status)) {
          await chrome.storage.local.remove("session");
          return null;
        }
        throw e; // network trouble: keep the session and try again later
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}

async function signIn(email, password) {
  if (!configured()) throw new Error("The extension is not connected to a Supabase project yet (see config.js).");
  const data = await request("/auth/v1/token?grant_type=password", { body: { email, password } });
  const session = await storeSession(data);

  // Words saved while signed in as someone else belong to that account, not this one.
  const { lastUserId } = await chrome.storage.local.get("lastUserId");
  if (lastUserId && lastUserId !== session.user_id) {
    await enqueue(() => chrome.storage.local.set({ words: {} }));
  }
  await chrome.storage.local.set({ lastUserId: session.user_id });

  try {
    await flush();
    await pullCloudWords();
  } catch {
    // Offline right after signing in: the queue is kept and retried later.
  }
  return { ok: true, ...(await status()) };
}

async function signOut() {
  const token = await getToken().catch(() => null);
  if (token) await request("/auth/v1/logout", { token }).catch(() => {});
  await chrome.storage.local.remove("session");
  return { ok: true, ...(await status()) };
}

async function status() {
  const { session } = await chrome.storage.local.get("session");
  return {
    configured: configured(),
    signedIn: Boolean(session),
    email: session ? session.email : "",
    pending: await pendingTotal(),
  };
}

function cleanWordText(text) {
  return (text || "")
    .replace(/::[a-z]{2,5}$/i, "")
    .replace(/[\u200B-\u200F\uFEFF\u2060]/g, "")
    .trim();
}

function tagWordByLang(text, lang) {
  const clean = cleanWordText(text);
  const code = (lang || "en").toLowerCase().slice(0, 2);
  if (code === "en" || code === "auto" || !code) return clean;
  return clean + "::" + code;
}

// ---------------------------------------------------------------------------
// Syncing
// ---------------------------------------------------------------------------
async function pushEntry(w, times) {
  let srcCode = (w.src || "auto").toLowerCase();
  let text = w.text || "";
  let translation = w.translation || "";
  let targetLang = w.lang || "ar";

  const isTextArabic = /[\u0600-\u06FF]/.test(text);
  const isTransArabic = /[\u0600-\u06FF]/.test(translation);
  const isTransLatin = /[a-zA-Z]/.test(translation);

  if ((isTextArabic && isTransLatin && !isTransArabic) || (srcCode === "ar" && isTransLatin)) {
    const temp = text;
    text = translation;
    translation = temp;
    srcCode = srcCode === "ar" ? "en" : srcCode;
    targetLang = "ar";
  } else if (srcCode === "ar" && (targetLang === "ar" || !isTextArabic)) {
    srcCode = "en";
  }

  const taggedText = tagWordByLang(text, srcCode);
  const titleContext =
    w.sentence && w.title && !w.title.includes(w.sentence)
      ? `"${w.sentence}" — ${w.title}`
      : w.title || "";
  const args = {
    p_text: taggedText,
    p_translation: translation,
    p_src_lang: srcCode,
    p_target_lang: targetLang,
    p_source_title: titleContext,
    p_source_url: w.page || "",
    p_times: times,
    p_sentence: w.sentence || "",
  };
  let token = await getToken();
  if (!token) throw new HttpError(401, "signed out");
  try {
    await request("/rest/v1/rpc/save_word", { body: args, token });
  } catch (e) {
    if (e instanceof HttpError && e.status === 401) {
      token = await getToken(true); // token expired early: refresh once and retry
      if (!token) throw e;
      await request("/rest/v1/rpc/save_word", { body: args, token });
      return;
    }
    // Gracefully fallback if migration 006 hasn't added p_sentence yet
    if (args.p_sentence !== undefined) {
      const noSentence = { ...args };
      delete noSentence.p_sentence;
      try {
        await request("/rest/v1/rpc/save_word", { body: noSentence, token });
        return;
      } catch (e2) {
        if (noSentence.p_src_lang) {
          const legacy = { ...noSentence };
          delete legacy.p_src_lang;
          await request("/rest/v1/rpc/save_word", { body: legacy, token });
          return;
        }
        throw e2;
      }
    }
    throw e;
  }
}

async function doFlush(forceAll = false) {
  if (!configured()) return;
  const { session } = await chrome.storage.local.get("session");
  if (!session) return;

  const { deleted = [] } = await chrome.storage.local.get({ deleted: [] });
  const snapshot = await enqueue(readWords);
  for (const [key, w] of Object.entries(snapshot)) {
    // Never resurrect words marked deleted
    if (w && w.text && deleted.includes(w.text.trim().toLowerCase())) {
      await enqueue(async () => {
        const words = await readWords();
        delete words[key];
        await chrome.storage.local.set({ words });
      });
      continue;
    }

    // Only push words that actually have pending changes to upload
    const sending = pendingOf(w);
    if (sending <= 0) continue;

    let rejected = false;
    try {
      await pushEntry(w, sending);
    } catch (e) {
      // Network, server and auth problems stop the run and are retried later.
      // A word the server refuses (bad data) is set aside so it cannot block the rest.
      const refused =
        e instanceof HttpError && e.status >= 400 && e.status < 500 && ![401, 408, 429].includes(e.status);
      if (!refused) throw e;
      rejected = true;
    }

    await enqueue(async () => {
      const words = await readWords();
      const cur = words[key];
      if (!cur) return;
      // Taps made while this request was in flight stay pending.
      cur.pending = rejected ? 0 : Math.max(0, pendingOf(cur) - sending);
      if (rejected) cur.rejected = true;
      await chrome.storage.local.set({ words });
    });
  }
}

let flushing = null;
function flush(forceAll = false) {
  if (!flushing) flushing = doFlush(forceAll).finally(() => (flushing = null));
  return flushing;
}

function isValidWordToSave(text) {
  if (!text || typeof text !== "string") return false;
  const clean = text.trim();
  if (clean.length < 2) return false;
  if (clean.length > 150) return false;
  return true;
}

/** Called after every save. Reports where the word ended up. */
async function saveWord(entry) {
  if (!entry || !entry.text || !isValidWordToSave(entry.text)) {
    return { ok: false, error: "Invalid word" };
  }
  await saveLocal(entry);
  if (!configured()) return { ok: true, cloud: "local" };
  const { session } = await chrome.storage.local.get("session");
  if (!session) return { ok: true, cloud: "signed-out" };
  try {
    await flush();
    // A run that started before this tap won't include it; run once more if needed.
    if ((await pendingTotal()) > 0) await flush();
  } catch {
    return { ok: true, cloud: "queued" };
  }
  return { ok: true, cloud: (await pendingTotal()) === 0 ? "synced" : "queued" };
}

async function pullCloudWords() {
  const token = await getToken().catch(() => null);
  if (!token) return;
  try {
    const list = await request("/rest/v1/words?select=id,text,translation,src_lang,target_lang", { token });
    if (Array.isArray(list)) {
      const { deleted = [] } = await chrome.storage.local.get({ deleted: [] });
      await enqueue(async () => {
        const words = await readWords();
        for (const item of list) {
          if (!item.text) continue;
          let clean = item.text.replace(/::[a-z]{2,5}$/i, "").trim();
          let trans = item.translation || "";
          let src = (item.src_lang && item.src_lang !== "auto") ? item.src_lang.toLowerCase() : "auto";
          let target = item.target_lang || "ar";

          const isTextArabic = /[\u0600-\u06FF]/.test(clean);
          const isTransArabic = /[\u0600-\u06FF]/.test(trans);
          const isTransLatin = /[a-zA-Z]/.test(trans);

          if ((isTextArabic && isTransLatin && !isTransArabic) || (src === "ar" && isTransLatin)) {
            const temp = clean;
            clean = trans;
            trans = temp;
            src = src === "ar" ? "en" : src;
            target = "ar";
          } else if (src === "ar" && target === "ar") {
            src = "en";
          }

          if (deleted.includes(clean.toLowerCase())) continue;
          const key = src + "|" + target + "|" + clean.toLowerCase();
          if (!words[key]) {
            words[key] = {
              text: clean,
              translation: trans,
              src: src,
              lang: target,
              count: 1,
              pending: 0,
              firstSeen: Date.now(),
              lastSeen: Date.now(),
            };
          }
        }
        await chrome.storage.local.set({ words });
      });
    }
  } catch (_) {
    // Non-fatal if offline
  }
}

async function isWordSavedInDb(rawText) {
  if (!rawText) return false;
  const norm = rawText.trim().toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
  const { deleted = [] } = await chrome.storage.local.get({ deleted: [] });
  if (deleted.includes(norm) || deleted.includes(rawText.trim().toLowerCase())) return false;

  const words = await readWords();
  for (const [k, w] of Object.entries(words)) {
    if (w && w.text) {
      const wNorm = w.text.trim().toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
      if (wNorm === norm || w.text.trim().toLowerCase() === rawText.trim().toLowerCase()) {
        return true;
      }
    }
    const parts = k.split("|");
    if (parts.length >= 3) {
      const kWord = parts.slice(2).join("|").trim().toLowerCase();
      const kNorm = kWord.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
      if (kNorm === norm || kWord === rawText.trim().toLowerCase()) {
        return true;
      }
    }
  }
  return false;
}

async function syncNow(forceAll = true) {
  try {
    await flush(forceAll);
    if ((await pendingTotal()) > 0) await flush();
    await pullCloudWords();
    return { ok: true, ...(await status()) };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : "Could not reach WordTap.", ...(await status()) };
  }
}

function setupContextMenus() {
  if (!chrome.contextMenus) return;
  try {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: "wordtap-translate-selection",
        title: 'Translate "%s" with WordTap',
        contexts: ["selection"],
      });
      chrome.contextMenus.create({
        id: "wordtap-ocr-snip",
        title: "WordTap: Capture Screen Text (OCR)",
        contexts: ["page", "video", "image"],
      });
    });
  } catch (_) {}
}

if (chrome.contextMenus?.onClicked) {
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (!tab?.id) return;
    if (info.menuItemId === "wordtap-translate-selection" && info.selectionText) {
      chrome.tabs
        .sendMessage(tab.id, {
          type: "wordtap:translate-context",
          text: info.selectionText.trim(),
        })
        .catch(() => {});
    } else if (info.menuItemId === "wordtap-ocr-snip") {
      startSnipOnTab(tab.id);
    }
  });
}

chrome.runtime.onInstalled?.addListener(() => {
  setupContextMenus();
  flush(true).then(pullCloudWords).catch(() => {});
});

chrome.runtime.onStartup.addListener(() => {
  setupContextMenus();
  flush(true).then(pullCloudWords).catch(() => {});
});

// Immediate run when background script initializes:
flush(true).then(pullCloudWords).catch(() => {});

async function addHistory(entry) {
  try {
    const { history = [] } = await chrome.storage.local.get({ history: [] });
    const cleanText = (entry.text || "").trim();
    const filtered = history.filter(
      (h) => !(h.text && h.text.toLowerCase() === cleanText.toLowerCase() && h.lang === entry.lang)
    );
    const newItem = {
      id: "ext-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      text: cleanText,
      translation: (entry.translation || "").trim(),
      src: entry.src || "auto",
      lang: entry.lang || "ar",
      title: entry.title || "",
      page: entry.page || "",
      source: entry.source || "selection",
      timestamp: new Date().toISOString(),
      saved: Boolean(entry.saved),
    };
    const updated = [newItem, ...filtered].slice(0, 300);
    await chrome.storage.local.set({ history: updated });
    return { ok: true, item: newItem };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function deleteHistoryItem(id, text, lang) {
  try {
    const { history = [] } = await chrome.storage.local.get({ history: [] });
    const cleanText = (text || "").trim().toLowerCase();
    const updated = history.filter((h) => {
      if (id && h.id === id) return false;
      if (cleanText && h.text && h.text.trim().toLowerCase() === cleanText) {
        if (!lang || h.lang === lang) return false;
      }
      return true;
    });
    await chrome.storage.local.set({ history: updated });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function clearAllHistory() {
  try {
    await chrome.storage.local.set({ history: [] });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function getAccountStats() {
  if (!configured()) return { ok: false };
  try {
    const token = await getToken();
    if (!token) return { ok: false };
    const [wordRows, statsRows] = await Promise.all([
      request("/rest/v1/words?select=next_review,box", { method: "GET", token }).catch(() => []),
      request("/rest/v1/user_stats?select=streak,xp,daily_goal,today_xp&limit=1", { method: "GET", token }).catch(() => []),
    ]);
    const nowMs = Date.now();
    const words = Array.isArray(wordRows) ? wordRows : [];
    const due = words.filter((w) => w.next_review && new Date(w.next_review).getTime() <= nowMs).length;
    const st = Array.isArray(statsRows) && statsRows[0] ? statsRows[0] : {};
    if (chrome.action?.setBadgeText) {
      chrome.action.setBadgeText({ text: due > 0 ? (due > 99 ? "99+" : String(due)) : "" });
      chrome.action.setBadgeBackgroundColor({ color: "#facc3b" });
    }
    return {
      ok: true,
      due,
      total: words.length,
      streak: Number(st.streak || 0),
      xp: Number(st.xp || 0),
      dailyGoal: Number(st.daily_goal || 20),
      todayXp: Number(st.today_xp || 0),
    };
  } catch {
    return { ok: false };
  }
}

async function deleteCloudWord(text, srcLang = "auto", targetLang = "ar") {
  if (!text) return { ok: true };
  const clean = text.trim();

  // 1. Remove from local words cache and record tombstone
  await enqueue(async () => {
    const words = await readWords();
    // Delete ALL matching keys in local words map regardless of language prefix
    for (const k of Object.keys(words)) {
      const w = words[k];
      if (w && w.text && w.text.trim().toLowerCase() === clean.toLowerCase()) {
        delete words[k];
      }
    }
    const { deleted = [] } = await chrome.storage.local.get({ deleted: [] });
    if (!deleted.includes(clean.toLowerCase())) {
      deleted.push(clean.toLowerCase());
      if (deleted.length > 500) deleted.shift();
    }
    await chrome.storage.local.set({ words, deleted });
  });

  // 2. Delete from Supabase if configured and user is signed in
  if (configured()) {
    try {
      const token = await getToken();
      if (token) {
        await request("/rest/v1/rpc/delete_word_by_text", {
          body: { p_text: clean, p_src_lang: srcLang || "auto" },
          token,
        });
        // Also perform direct delete to catch any tagged entries (e.g., "word::en")
        const enc = encodeURIComponent(clean);
        await request("/rest/v1/words?text=ilike." + enc, {
          method: "DELETE",
          token,
        }).catch(() => {});
        await request("/rest/v1/words?text=ilike." + encodeURIComponent(clean + "::*"), {
          method: "DELETE",
          token,
        }).catch(() => {});
      }
    } catch (e) {
      console.warn("Could not delete word from cloud:", e);
    }
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// OCR & Screen Snip Translation
// ---------------------------------------------------------------------------
const OCR_LANG_MAP = {
  en: "eng",
  de: "ger",
  fr: "fre",
  es: "spa",
  it: "ita",
  pt: "por",
  tr: "tur",
  ru: "rus",
  ar: "ara",
  ja: "jpn",
  ko: "kor",
  zh: "chs",
};

async function recognizeTextFromImage(imageBase64, srcLang = "en") {
  // 1. Try local/configured WordTap server first if reachable (max 3s timeout)
  const webUrl = await getWebsiteUrl();
  try {
    const localRes = await fetch(`${webUrl}/api/ocr`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: imageBase64, lang: srcLang }),
      signal: AbortSignal.timeout(3000),
    });
    if (localRes.ok) {
      const data = await localRes.json();
      if (data && data.text && data.text.trim()) {
        return data.text.trim();
      }
    }
  } catch (_) {
    // Web server not running or timed out; proceed to Cloud OCR fallback
  }

  // 2. Cloud OCR Engine fallback
  const langCode = (srcLang && srcLang !== "auto" ? srcLang : "en").toLowerCase().slice(0, 2);
  const ocrLang = OCR_LANG_MAP[langCode] || "eng";

  const form = new URLSearchParams();
  form.append("base64Image", imageBase64);
  form.append("language", ocrLang);
  form.append("scale", "true");
  form.append("isOverlayRequired", "false");
  form.append("detectOrientation", "true");

  const { ocrApiKey } = await chrome.storage.sync.get(["ocrApiKey"]).catch(() => ({}));
  const apiKeys = [
    ...(typeof ocrApiKey === "string" && ocrApiKey.trim() ? [ocrApiKey.trim()] : []),
    "K84725916788957",
    "helloworld",
  ];
  for (const key of apiKeys) {
    try {
      const cloudRes = await fetch("https://api.ocr.space/parse/image", {
        method: "POST",
        signal: AbortSignal.timeout(6000),
        headers: {
          apikey: key,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form,
      });

      if (!cloudRes.ok) continue;

      const cloudData = await cloudRes.json();
      if (cloudData && Array.isArray(cloudData.ParsedResults) && cloudData.ParsedResults.length > 0) {
        const text = (cloudData.ParsedResults[0].ParsedText || "")
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
          .join(" ")
          .trim();

        if (text) return text;
      }
    } catch (_) {}
  }

  throw new Error("No readable text detected in the selected area.");
}

async function processOcrAndTranslate(imageBase64, target = "ar", srcLang = "auto") {
  const extractedText = await recognizeTextFromImage(imageBase64, srcLang);
  if (!extractedText) {
    throw new Error("No readable text detected in the selected area.");
  }

  // Immediately translate the extracted OCR text
  const trans = await translate(extractedText, target, srcLang);

  return {
    ok: true,
    text: extractedText,
    translation: trans.text,
    src: trans.src,
    pos: trans.pos || null,
    partsOfSpeech: trans.partsOfSpeech || [],
    alternatives: trans.alternatives || [],
    correction: trans.correction || null,
  };
}

async function startSnipOnTab(tabId) {
  if (!tabId) return;
  try {
    await chrome.tabs.sendMessage(tabId, { type: "ocr:start-snip" });
  } catch (_) {
    // If content script was not already loaded on this tab, inject it now!
    try {
      if (chrome.scripting) {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ["select-translate.js"],
        });
        setTimeout(() => {
          chrome.tabs.sendMessage(tabId, { type: "ocr:start-snip" }).catch(() => {});
        }, 120);
      }
    } catch (e) {
      console.warn("Could not inject OCR script into tab:", e);
    }
  }
}

// ---------------------------------------------------------------------------
// Keyboard Shortcut & Commands Listener
// ---------------------------------------------------------------------------
chrome.commands.onCommand.addListener((command) => {
  if (command === "take-ocr-screenshot") {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      if (tabs && tabs[0] && tabs[0].id) {
        startSnipOnTab(tabs[0].id);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Messages from the page script and the popup
// ---------------------------------------------------------------------------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return;

  const reply = (promise) => {
    promise
      .then(sendResponse)
      .catch((e) => sendResponse({ ok: false, error: e && e.message ? e.message : String(e) }));
    return true; // keep the channel open for the async response
  };

  switch (msg.type) {
    case "ocr:capture-screen":
      return reply(
        new Promise((resolve, reject) => {
          const winId = sender && sender.tab ? sender.tab.windowId : undefined;
          chrome.tabs.captureVisibleTab(winId, { format: "png" }, (dataUrl) => {
            if (chrome.runtime.lastError || !dataUrl) {
              chrome.tabs.captureVisibleTab(null, { format: "png" }, (retryUrl) => {
                if (chrome.runtime.lastError || !retryUrl) {
                  reject(
                    new Error(
                      chrome.runtime.lastError ? chrome.runtime.lastError.message : "Screen capture failed",
                    ),
                  );
                } else {
                  resolve({ ok: true, dataUrl: retryUrl });
                }
              });
            } else {
              resolve({ ok: true, dataUrl });
            }
          });
        }),
      );
    case "ocr:process":
      return reply(processOcrAndTranslate(msg.image, msg.target, msg.srcLang));
    case "ocr:start-tab":
    case "ocr:start-on-active-tab": {
      if (msg.tabId) {
        startSnipOnTab(msg.tabId);
        return reply(Promise.resolve({ ok: true }));
      }
      chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
        if (tabs && tabs[0] && tabs[0].id) {
          startSnipOnTab(tabs[0].id);
        }
      });
      return reply(Promise.resolve({ ok: true }));
    }
    case "auth:sync-session": {
      if (msg.session && msg.session.access_token) {
        return reply(
          storeSession(msg.session)
            .then(() => pullCloudWords())
            .then(() => ({ ok: true }))
        );
      }
      return reply(Promise.resolve({ ok: false }));
    }
    case "words:save-batch": {
      if (Array.isArray(msg.words)) {
        return reply(
          enqueue(async () => {
            const words = await readWords();
            const { deleted = [] } = await chrome.storage.local.get({ deleted: [] });
            for (const item of msg.words) {
              if (!item || !item.text) continue;
              const clean = item.text.replace(/::[a-z]{2,5}$/i, "").trim();
              if (deleted.includes(clean.toLowerCase())) continue;
              const src = (item.src && item.src !== "auto") ? item.src.toLowerCase() : "auto";
              const target = item.target || "ar";
              const key = src + "|" + target + "|" + clean.toLowerCase();
              if (!words[key]) {
                words[key] = {
                  text: clean,
                  translation: item.translation || "",
                  src: item.src || "auto",
                  lang: target,
                  count: 1,
                  pending: 0,
                  firstSeen: Date.now(),
                  lastSeen: Date.now(),
                };
              }
            }
            await chrome.storage.local.set({ words });
            return { ok: true, count: Object.keys(words).length };
          })
        );
      }
      return reply(Promise.resolve({ ok: false }));
    }
    case "translate":
      return reply(translate(msg.text, msg.target, msg.srcLang, msg.context).then((r) => ({ ok: true, ...r })));
    case "tts:speak":
      return reply(fetchTtsDataUrl(msg.text, msg.lang));
    case "stats:get":
      return reply(getAccountStats());
    case "config:get-web-url":
      return reply(getWebsiteUrl().then((url) => ({ ok: true, url })));
    case "save":
      return reply(saveWord(msg.entry));
    case "word:is-saved":
      return reply(isWordSavedInDb(msg.text).then((saved) => ({ ok: true, saved })));
    case "word:delete":
      return reply(deleteCloudWord(msg.text, msg.srcLang, msg.targetLang));
    case "history:add":
      return reply(addHistory(msg.entry));
    case "history:get":
      return reply(chrome.storage.local.get({ history: [] }));
    case "history:delete":
      return reply(deleteHistoryItem(msg.id, msg.text, msg.lang));
    case "history:clear":
      return reply(clearAllHistory());
    case "auth:status":
      return reply(status().then((s) => ({ ok: true, ...s })));
    case "auth:signIn":
      return reply(signIn(msg.email, msg.password));
    case "auth:signOut":
      return reply(signOut());
    case "sync":
      return reply(syncNow());
    default:
      return undefined;
  }
});

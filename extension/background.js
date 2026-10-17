// Service worker: translation, account sign-in, and syncing saved words to WordTap.
import { CONFIG } from "./config.js";

// ---------------------------------------------------------------------------
// Translation
// ---------------------------------------------------------------------------
const cache = new Map();

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
    "&dt=t&q=" +
    encodeURIComponent(text);

  const res = await fetch(url);
  if (!res.ok) throw new Error("HTTP " + res.status);
  const data = await res.json();

  const detected = sl !== "auto" ? sl : data[2] ? data[2].toLowerCase() : "auto";
  const result = {
    text: (data[0] || []).map((part) => part[0]).join(""),
    src: detected,
  };

  if (cache.size > 500) cache.delete(cache.keys().next().value);
  cache.set(key, result);
  return result;
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

async function request(path, { body, token } = {}) {
  const res = await fetch(CONFIG.SUPABASE_URL + path, {
    method: "POST",
    headers: {
      apikey: CONFIG.SUPABASE_ANON_KEY,
      Authorization: "Bearer " + (token || CONFIG.SUPABASE_ANON_KEY),
      "Content-Type": "application/json",
    },
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
  const srcCode = (w.src || "auto").toLowerCase();
  const taggedText = tagWordByLang(w.text, srcCode);
  const args = {
    p_text: taggedText,
    p_translation: w.translation,
    p_src_lang: srcCode,
    p_target_lang: w.lang,
    p_source_title: w.title || "",
    p_source_url: w.page || "",
    p_times: times,
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
    // If remote database has legacy save_word without p_src_lang, retry without p_src_lang:
    if (args.p_src_lang) {
      const fallback = { ...args };
      delete fallback.p_src_lang;
      await request("/rest/v1/rpc/save_word", { body: fallback, token });
      return;
    }
    throw e;
  }
}

async function doFlush(forceAll = false) {
  if (!configured()) return;
  const { session } = await chrome.storage.local.get("session");
  if (!session) return;

  const snapshot = await enqueue(readWords);
  for (const [key, w] of Object.entries(snapshot)) {
    const sending = forceAll ? (w.count || 1) : pendingOf(w);
    if (!forceAll && sending <= 0) continue;

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

/** Called after every save. Reports where the word ended up. */
async function saveWord(entry) {
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

async function syncNow(forceAll = true) {
  try {
    await flush(forceAll);
    if ((await pendingTotal()) > 0) await flush();
    return { ok: true, ...(await status()) };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : "Could not reach WordTap.", ...(await status()) };
  }
}

chrome.runtime.onInstalled?.addListener(() => {
  flush(true).catch(() => {});
});

chrome.runtime.onStartup.addListener(() => {
  flush(true).catch(() => {});
});

// Immediate run when background script initializes:
flush(true).catch(() => {});

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

// ---------------------------------------------------------------------------
// Messages from the page script and the popup
// ---------------------------------------------------------------------------
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg) return;

  const reply = (promise) => {
    promise
      .then(sendResponse)
      .catch((e) => sendResponse({ ok: false, error: e && e.message ? e.message : String(e) }));
    return true; // keep the channel open for the async response
  };

  switch (msg.type) {
    case "translate":
      return reply(translate(msg.text, msg.target, msg.srcLang, msg.context).then((r) => ({ ok: true, ...r })));
    case "save":
      return reply(saveWord(msg.entry));
    case "history:add":
      return reply(addHistory(msg.entry));
    case "history:get":
      return reply(chrome.storage.local.get({ history: [] }));
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

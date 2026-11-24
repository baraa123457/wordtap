// Service worker: translation, TTS audio, context menus, and syncing saved words to WordTap.
import { CONFIG, getWebsiteUrl } from "./config.js";

// ---------------------------------------------------------------------------
// Translation & TTS
// ---------------------------------------------------------------------------
const cache = new Map();
const ttsCache = new Map();

// Initialize persistent translation cache from chrome.storage.local
chrome.storage.local.get({ tr_cache: {} }).then(({ tr_cache }) => {
  if (tr_cache && typeof tr_cache === "object") {
    for (const [k, v] of Object.entries(tr_cache)) {
      if (k && v && typeof v === "object") cache.set(k, v);
    }
  }
}).catch(() => {});

let persistCacheTimer = null;
const pendingCacheBatch = new Map();

function persistCacheEntry(key, value) {
  if (cache.size > 1500) cache.delete(cache.keys().next().value);
  cache.set(key, value);
  pendingCacheBatch.set(key, value);

  if (!persistCacheTimer) {
    persistCacheTimer = setTimeout(async () => {
      persistCacheTimer = null;
      try {
        const { tr_cache = {} } = await chrome.storage.local.get({ tr_cache: {} });
        for (const [k, v] of pendingCacheBatch.entries()) {
          tr_cache[k] = v;
        }
        pendingCacheBatch.clear();

        // Keep local cache bounded to 1,000 items
        const keys = Object.keys(tr_cache);
        if (keys.length > 1000) {
          for (let i = 0; i < keys.length - 1000; i++) {
            delete tr_cache[keys[i]];
          }
        }
        await chrome.storage.local.set({ tr_cache });
      } catch (_) {}
    }, 1500);
  }
}

function stripHtmlTags(str) {
  return String(str || "").replace(/<[^>]+>/g, "").trim();
}

function isInflectionOrPlural(input, candidate) {
  const a = input.toLowerCase().trim();
  const b = candidate.toLowerCase().trim();
  if (a === b) return true;
  if (b === a + "s" || a === b + "s") return true;
  if (b === a + "es" || a === b + "es") return true;
  if (b === a + "d" || a === b + "d") return true;
  if (b === a + "ed" || a === b + "ed") return true;
  if (b === a + "ing" || a === b + "ing") return true;
  return false;
}

function levenshtein(a, b) {
  const an = a.length;
  const bn = b.length;
  if (an === 0) return bn;
  if (bn === 0) return an;
  const matrix = Array.from({ length: bn + 1 }, () => Array(an + 1).fill(0));
  for (let i = 0; i <= an; ++i) matrix[0][i] = i;
  for (let i = 1; i <= bn; ++i) matrix[i][0] = i;
  for (let i = 1; i <= bn; ++i) {
    for (let j = 1; j <= an; ++j) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
        );
      }
    }
  }
  return matrix[bn][an];
}

async function findSuggestCorrection(text) {
  const clean = text.trim();
  if (!clean || clean.length < 3 || clean.length > 50) return null;
  const lowerInput = clean.toLowerCase();

  try {
    const suggestUrl = `https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(clean)}`;
    const sRes = await fetch(suggestUrl);
    if (!sRes.ok) return null;
    const sData = await sRes.json();
    const suggestions = Array.isArray(sData && sData[1]) ? sData[1] : [];

    let bestCandidate = null;
    let lowestDist = 999;

    for (const raw of suggestions) {
      if (typeof raw !== "string") continue;
      const stripped = raw
        .replace(/[\u0600-\u06FF]+/g, "")
        .replace(/\b(meaning|translate|translation|definition|synonyms?|antonyms?|in python|in java|movie|film)\b/gi, "")
        .replace(/[^a-zA-Z\s'-]/g, "")
        .trim();
      if (!stripped) continue;

      const tokens = stripped.split(/\s+/).filter(Boolean);
      const isSingle = !lowerInput.includes(" ");
      const candidateList = isSingle ? [tokens[0]].filter(Boolean) : [stripped, tokens[0]];

      for (const cand of candidateList) {
        if (!cand) continue;
        const candLower = cand.toLowerCase();
        if (!candLower || candLower === lowerInput) continue;
        if (isInflectionOrPlural(lowerInput, candLower)) continue;
        const dist = levenshtein(lowerInput, candLower);
        const maxLen = Math.max(lowerInput.length, candLower.length);
        const similarity = 1 - dist / maxLen;

        const maxAllowedDist = maxLen >= 7 ? 3 : 2;
        if (dist <= maxAllowedDist && similarity >= 0.6) {
          if (dist < lowestDist) {
            lowestDist = dist;
            bestCandidate = candLower;
          }
        }
      }
    }

    return bestCandidate;
  } catch {
    return null;
  }
}

async function translate(text, target, srcLang = "auto", context = "", requestedProvider = null) {
  let provider = requestedProvider;
  if (!provider) {
    const s = await chrome.storage.sync.get({ translationProvider: "google" }).catch(() => ({}));
    provider = s.translationProvider || "google";
  }

  let sl = srcLang && srcLang !== "auto" ? srcLang.toLowerCase() : "auto";

  // Fast offline context inference if language is auto (0ms, zero network delay)
  if (sl === "auto" && context) {
    const c = context.toLowerCase();
    if (/[äöüß]/.test(c)) sl = "de";
    else if (/[éèêëàâùûîïôçœæ]/.test(c)) sl = "fr";
    else if (/[áéíóúüñ¿¡]/.test(c)) sl = "es";
    else if (/[àèéìíîòóùú]/.test(c)) sl = "it";
    else if (/[ğüşöçıİ]/.test(c)) sl = "tr";
    else if (/[\u0400-\u04FF]/.test(c)) sl = "ru";
    else if (/[\u0600-\u06FF]/.test(c)) sl = "ar";
    else if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(c)) sl = "ja";
    else if (/[\uac00-\ud7af]/.test(c)) sl = "ko";
  }

  const key = provider + "|" + sl + "|" + target + "|" + text.toLowerCase();
  if (cache.has(key)) return cache.get(key);

  // -------------------------------------------------------------------------
  // Provider: U-Dictionary (Youdao Deep Dictionary API)
  // -------------------------------------------------------------------------
  if (provider === "udictionary") {
    try {
      const uRes = await fetch("https://dict.youdao.com/jsonapi?q=" + encodeURIComponent(text.trim()), {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });
      if (uRes.ok) {
        const uData = await uRes.json();
        const simple = uData.simple?.word?.[0];
        const usphone = simple?.usphone || simple?.ukphone || "";
        const phonetic = usphone ? `/${usphone}/` : "";

        const partsOfSpeech = [];
        const altSet = new Set();
        const eeTrs = uData.ee?.word?.trs || [];
        for (const item of eeTrs) {
          if (item.pos) {
            const p = item.pos.replace(/\.$/, "").toLowerCase();
            if (!partsOfSpeech.includes(p)) partsOfSpeech.push(p);
          }
          if (Array.isArray(item.tr)) {
            for (const t of item.tr) {
              const defText = t.l?.i || t.i;
              if (defText && typeof defText === "string") altSet.add(defText);
            }
          }
        }

        let trans = "";
        if (target.startsWith("zh")) {
          trans = uData.ec?.word?.[0]?.trs?.[0]?.tr?.[0]?.l?.i?.[0] || "";
        }
        if (!trans) {
          const gUrl =
            "https://translate.googleapis.com/translate_a/single?client=gtx&sl=" +
            encodeURIComponent(sl) +
            "&tl=" +
            encodeURIComponent(target) +
            "&dt=t&dt=bd&q=" +
            encodeURIComponent(text);
          const gRes = await fetch(gUrl);
          if (gRes.ok) {
            const gData = await gRes.json();
            trans = (gData[0] || []).map((p) => p[0]).join("");
            if (Array.isArray(gData[1])) {
              for (const group of gData[1]) {
                if (Array.isArray(group) && Array.isArray(group[1])) {
                  for (const term of group[1]) {
                    if (term && typeof term === "string") altSet.add(term.trim());
                  }
                }
              }
            }
          }
        }

        const authSents = uData.auth_sents_part?.sent || [];
        const examples = authSents
          .slice(0, 2)
          .map((s) => String(s.foreign || "").replace(/<[^>]+>/g, "").trim())
          .filter(Boolean);

        const result = {
          text: trans || text,
          src: sl !== "auto" ? sl : "en",
          partsOfSpeech,
          pos: partsOfSpeech[0] || null,
          alternatives: Array.from(altSet).slice(0, 6),
          phonetic,
          examples,
          provider: "udictionary",
        };

        persistCacheEntry(key, result);
        return result;
      }
    } catch (e) {
      console.warn("Extension U-Dictionary lookup failed, falling back to Google:", e);
    }
  }

  // -------------------------------------------------------------------------
  // Provider: Google Translate with Multi-Client Rotation & Backend Failover
  // -------------------------------------------------------------------------

  let data = null;
  const clients = ["dict-chrome-ex", "gtx", "webapp"];

  for (const client of clients) {
    const url =
      `https://translate.googleapis.com/translate_a/single?client=${client}&sl=` +
      encodeURIComponent(sl) +
      "&tl=" +
      encodeURIComponent(target) +
      "&dt=t&dt=bd&dt=qca&dt=at&q=" +
      encodeURIComponent(text);

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(1800) });
      if (res.ok) {
        data = await res.json();
        if (data && data[2] && sl === "auto") {
          sl = data[2].toLowerCase();
        }
        break;
      }
      if (res.status === 429) {
        console.warn(`Translation client ${client} returned 429 (rate limited), trying fallback.`);
      }
    } catch (netErr) {
      console.warn(`Translation client ${client} network error:`, netErr);
    }
  }

  // If all free client parameters failed or got blocked, fall back to WordTap Backend Gateway
  if (!data) {
    try {
      const webUrl = getWebsiteUrl();
      const s = await chrome.storage.sync.get({ customApiKey: "" }).catch(() => ({}));
      const fallbackRes = await fetch(`${webUrl}/api/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          src: sl,
          target,
          context,
          apiKey: s.customApiKey || undefined,
        }),
      });
      if (fallbackRes.ok) {
        const fbData = await fallbackRes.json();
        if (fbData && fbData.translation) {
          data = [
            [[fbData.translation]],
            [],
            fbData.detectedSrcLang || (sl !== "auto" ? sl : "en"),
          ];
        }
      }
    } catch (fbErr) {
      console.warn("WordTap backend translation fallback error:", fbErr);
    }
  }

  if (!data) throw new Error("All translation providers failed");

  let detected = sl !== "auto" ? sl : data[2] ? data[2].toLowerCase() : "auto";
  if ((detected === "hi" || detected === "mr") && /^[a-zA-Z\s'-]+$/.test(text.trim())) {
    detected = "en";
  }

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
      if (!/^[a-zA-Z]/.test(text.trim()) || /[a-zA-Z]/.test(rawCorr)) {
        correction = rawCorr;
      }
    }
  }

  // Fallback to Google Suggest spell-check if data[7] didn't find an English spelling correction
  if (!correction && !text.includes(" ") && text.trim().length >= 3 && text.trim().length <= 40 && /^[a-zA-Z'-]+$/.test(text.trim())) {
    try {
      const suggestCorr = await findSuggestCorrection(text.trim());
      if (suggestCorr && suggestCorr.toLowerCase() !== text.trim().toLowerCase()) {
        correction = suggestCorr;
      }
    } catch (_) {}
  }

  // If word was a typo and dictionary had no POS or alternatives, fetch dictionary for the corrected word!
  if (correction && partsOfSpeech.length === 0) {
    try {
      const corrDictUrl =
        "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=" +
        encodeURIComponent(target) +
        "&dt=t&dt=bd&dt=qca&dt=at&q=" +
        encodeURIComponent(correction);
      const cRes = await fetch(corrDictUrl);
      if (cRes.ok) {
        const cData = await cRes.json();
        if (Array.isArray(cData[1])) {
          partsOfSpeech = cData[1]
            .map((item) => (Array.isArray(item) && typeof item[0] === "string" ? item[0].toLowerCase() : null))
            .filter(Boolean);
          for (const group of cData[1]) {
            if (Array.isArray(group) && Array.isArray(group[1])) {
              for (const term of group[1]) {
                if (typeof term === "string" && term.trim() && term.trim().toLowerCase() !== mainText.trim().toLowerCase()) {
                  altSet.add(term.trim());
                }
              }
            }
          }
        }
      }
    } catch (_) {}
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

  persistCacheEntry(key, result);
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
  const { session } = await chrome.storage.local.get("session");
  if (!session) {
    return {
      ok: false,
      error: "Failed to save · Please sign in to WordTap",
      cloud: "signed-out",
      notSignedIn: true,
    };
  }
  await saveLocal(entry);
  if (!configured()) return { ok: true, cloud: "local" };
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

function openQuickTranslationPopup(text) {
  if (!text) return;
  try {
    const url = chrome.runtime.getURL(`popup.html?word=${encodeURIComponent(text.trim())}`);
    chrome.windows.create({
      url,
      type: "popup",
      width: 380,
      height: 520,
      focused: true,
    });
  } catch (err) {
    console.warn("Could not open quick translation popup window:", err);
  }
}

async function handleSelectionTranslation(tab, text) {
  if (!tab?.id || !text) return;
  const clean = text.trim();
  if (!clean) return;

  const url = (tab.url || "").toLowerCase();
  const isPdf = url.includes(".pdf") || url.startsWith("file://");

  // In Chrome's native PDF viewer, <embed> plugin covers page DOM elements.
  // Directly open the floating quick translate window so it floats reliably above the PDF!
  if (isPdf) {
    openQuickTranslationPopup(clean);
    return;
  }

  // 1. Try sending directly to content script if already loaded
  try {
    const res = await chrome.tabs.sendMessage(tab.id, {
      type: "wordtap:translate-context",
      text: clean,
    });
    if (res && res.ok) return;
  } catch (_) {}

  // 2. If content script was not loaded on this tab, attempt programmatic injection
  try {
    if (chrome.scripting) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["select-translate.js"],
      });
      setTimeout(async () => {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            type: "wordtap:translate-context",
            text: clean,
          });
        } catch (_) {
          openQuickTranslationPopup(clean);
        }
      }, 120);
      return;
    }
  } catch (_) {}

  // 3. Fallback: open floating quick translate popup window
  openQuickTranslationPopup(clean);
}

if (chrome.contextMenus?.onClicked) {
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (!tab?.id) return;
    if (info.menuItemId === "wordtap-translate-selection" && info.selectionText) {
      handleSelectionTranslation(tab, info.selectionText);
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
setupContextMenus();
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

  // 2. Cloud OCR Engine fallback (OCR Engine 2 is multi-threaded and 3-4x faster)
  const langCode = (srcLang && srcLang !== "auto" ? srcLang : "en").toLowerCase().slice(0, 2);
  const ocrLang = OCR_LANG_MAP[langCode] || "eng";

  const form = new URLSearchParams();
  form.append("base64Image", imageBase64);
  form.append("language", ocrLang);
  form.append("OCREngine", "2");
  form.append("scale", "false");
  form.append("isOverlayRequired", "false");
  form.append("detectOrientation", "false");

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
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "take-ocr-screenshot") {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      if (tabs && tabs[0] && tabs[0].id) {
        startSnipOnTab(tabs[0].id);
      }
    });
  } else if (command === "translate-selection") {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, async (tabs) => {
      const tab = tabs && tabs[0];
      if (!tab?.id) return;
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => window.getSelection()?.toString() || "",
        });
        const selected = results && results[0] && results[0].result ? results[0].result.trim() : "";
        if (selected) {
          handleSelectionTranslation(tab, selected);
        } else {
          const url = (tab.url || "").toLowerCase();
          if (url.includes(".pdf") || url.startsWith("file://")) {
            openQuickTranslationPopup("");
          } else {
            chrome.tabs.sendMessage(tab.id, { type: "wordtap:check-pdf-selection" }).catch(() => {});
          }
        }
      } catch (_) {
        const url = (tab.url || "").toLowerCase();
        if (url.includes(".pdf") || url.startsWith("file://")) {
          openQuickTranslationPopup("");
        } else {
          chrome.tabs.sendMessage(tab.id, { type: "wordtap:check-pdf-selection" }).catch(() => {});
        }
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
    case "telemetry:subtitle-health": {
      const healthData = msg.health;
      if (healthData && healthData.platform) {
        chrome.storage.local.get(["wordtap_subtitle_health"], (data) => {
          const current = data.wordtap_subtitle_health || {};
          current[healthData.platform] = {
            ...healthData,
            reportedAt: Date.now(),
          };
          chrome.storage.local.set({ wordtap_subtitle_health: current });
        });

        // Forward to backend telemetry endpoint if configured (fire-and-forget)
        getWebsiteUrl().then((webUrl) => {
          fetch(`${webUrl}/api/telemetry/subtitle-health`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(healthData),
            signal: AbortSignal.timeout(3000),
          }).catch(() => {});
        }).catch(() => {});
      }
      return reply(Promise.resolve({ ok: true }));
    }
    case "telemetry:get-health": {
      return reply(
        new Promise((resolve) => {
          chrome.storage.local.get(["wordtap_subtitle_health"], (data) => {
            resolve({ ok: true, health: data.wordtap_subtitle_health || {} });
          });
        })
      );
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
      return reply(
        translate(msg.text, msg.target, msg.srcLang, msg.context, msg.provider).then((r) => ({
          ok: true,
          ...r,
        })),
      );
    case "tts:speak":
      return reply(fetchTtsDataUrl(msg.text, msg.lang));
    case "stats:get":
      return reply(getAccountStats());
    case "config:get-web-url":
      return reply(getWebsiteUrl().then((url) => ({ ok: true, url })));
    case "save":
    case "words:save":
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
      return reply(Promise.resolve({ ok: false, error: "unknown_message_type" }));
  }
});

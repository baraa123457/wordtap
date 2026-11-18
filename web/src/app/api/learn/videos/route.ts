import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getCorsHeaders, guardApiRequest, handleCorsPreflight } from "@/lib/api-guard";
import { maskWordInSentence } from "@/lib/placeholder";

export async function OPTIONS(req: Request) {
  return handleCorsPreflight(req);
}

type VerifiedVideoClip = {
  id: string;
  youtubeVideoId: string;
  videoTitle: string;
  channelName: string;
  source:
    | "youtube_supadata"
    | "youtube_transcriptapi"
    | "youtube_filmot"
    | "user_subtitle"
    | "user_contributed";
  timestampSeconds: number;
  verifiedTranscript: string;
  contextSentence: string;
  targetWordPosition: number;
  captionAvailable: boolean;
  videoAvailable: boolean;
};

type FallbackContextItem = {
  sentence: string;
  sourceLabel: string;
  pronunciation?: string;
};

type DiscoveryDiagnostics = {
  status:
    | "verified"
    | "missing_credentials"
    | "missing_transcript_provider"
    | "no_matches"
    | "provider_error";
  message: string;
  missingEnvVars: string[];
  providersAttempted: string[];
  cacheStatus: "memory_hit" | "db_hit" | "fresh_discovery" | "empty";
};

type MemoryCacheEntry = {
  clips: VerifiedVideoClip[];
  expiresAt: number;
};

const MEMORY_CACHE = new Map<string, MemoryCacheEntry>();
const MAX_MEMORY_ENTRIES = 500;
const MEMORY_TTL_MS = 15 * 60 * 1000; // 15 minutes
const DB_CACHE_TTL_DAYS = 30;

const contributeSchema = z.object({
  word: z.string().trim().min(1).max(120),
  youtubeUrl: z.string().trim().min(5).max(500),
  timestampSeconds: z.number().int().min(0).max(86_400),
  transcript: z.string().trim().min(6).max(600),
});

function setMemoryCache(wordNormalized: string, clips: VerifiedVideoClip[]) {
  if (clips.length === 0) return;
  const now = Date.now();
  if (MEMORY_CACHE.size >= MAX_MEMORY_ENTRIES) {
    for (const [k, v] of MEMORY_CACHE.entries()) {
      if (now >= v.expiresAt) MEMORY_CACHE.delete(k);
    }
    if (MEMORY_CACHE.size >= MAX_MEMORY_ENTRIES) {
      const oldest = MEMORY_CACHE.keys().next().value;
      if (oldest) MEMORY_CACHE.delete(oldest);
    }
  }
  MEMORY_CACHE.set(wordNormalized, { clips, expiresAt: now + MEMORY_TTL_MS });
}

function getMemoryCache(wordNormalized: string): VerifiedVideoClip[] | null {
  const entry = MEMORY_CACHE.get(wordNormalized);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    MEMORY_CACHE.delete(wordNormalized);
    return null;
  }
  return entry.clips;
}

/** Extracts a valid 11-character YouTube video ID from any standard YouTube URL or raw ID. */
function extractYouTubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "youtu.be") {
      const seg = url.pathname.split("/").filter(Boolean)[0];
      return seg && /^[A-Za-z0-9_-]{11}$/.test(seg) ? seg : null;
    }
    if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
      const v = url.searchParams.get("v");
      if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;
      const parts = url.pathname.split("/").filter(Boolean);
      if ((parts[0] === "embed" || parts[0] === "shorts" || parts[0] === "live") && parts[1]) {
        return /^[A-Za-z0-9_-]{11}$/.test(parts[1]) ? parts[1] : null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

/** Parses ?t=123, ?t=1m30s, or &start=123 from a YouTube URL. */
function extractYouTubeTimestamp(input: string): number {
  try {
    const url = new URL(input.trim());
    const raw = url.searchParams.get("t") || url.searchParams.get("start") || "";
    if (!raw) return 0;
    if (/^\d+$/.test(raw)) return Math.max(0, Number(raw));
    let total = 0;
    const h = raw.match(/(\d+)h/i);
    const m = raw.match(/(\d+)m/i);
    const s = raw.match(/(\d+)s/i);
    if (h) total += Number(h[1]) * 3600;
    if (m) total += Number(m[1]) * 60;
    if (s) total += Number(s[1]);
    return Math.max(0, total);
  } catch {
    return 0;
  }
}

/** Verifies a YouTube video exists and permits public embedding using YouTube's official oEmbed endpoint. */
async function verifyYouTubeOembed(
  videoId: string,
): Promise<{ title: string; authorName: string } | null> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`,
      { signal: AbortSignal.timeout(4000) },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { title?: string; author_name?: string };
    return {
      title: (data.title || "YouTube Video").trim(),
      authorName: (data.author_name || "YouTube").trim(),
    };
  } catch {
    return null;
  }
}

/**
 * Creates a Supabase server client using SERVICE_ROLE_KEY when available,
 * or forwarding the caller's authenticated Bearer JWT so RLS reads succeed.
 */
function getServerSupabase(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url) return null;

  if (serviceKey) {
    return createClient(url, serviceKey, { auth: { persistSession: false } });
  }
  if (!anonKey) return null;

  const authHeader = req.headers.get("authorization") || "";
  return createClient(url, anonKey, {
    auth: { persistSession: false },
    global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
  });
}

/** Cleans raw caption text (strips [Music], HTML entities, excessive spaces). */
function cleanCaptionText(text: string): string {
  return text
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+([.,!?;:])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

type TranscriptCue = { text: string; startSec: number };

/** Scans normalized transcript cues for an exact whole-word/inflected match and extracts clean context. */
function extractVerifiedCueMatch(
  cues: TranscriptCue[],
  word: string,
): { sentence: string; startSeconds: number; position: number } | null {
  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i]!;
    const rawText = cleanCaptionText(cue.text);
    if (!rawText) continue;

    if (!maskWordInSentence(rawText, word)) continue;

    const prevText = i > 0 ? cleanCaptionText(cues[i - 1]?.text || "") : "";
    const nextText = i < cues.length - 1 ? cleanCaptionText(cues[i + 1]?.text || "") : "";
    const combined = cleanCaptionText(`${prevText} ${rawText} ${nextText}`);
    const sentence = combined.length <= 220 && combined.length >= rawText.length ? combined : rawText;

    const masked = maskWordInSentence(sentence, word);
    if (!masked || sentence.length < 10) continue;

    return {
      sentence,
      startSeconds: Math.max(0, Math.floor(cue.startSec) - 1),
      position: masked.position,
    };
  }
  return null;
}

/**
 * Provider A: Filmot Subtitle Search API (RapidAPI) — direct indexed YouTube subtitle search.
 */
async function discoverViaFilmot(word: string): Promise<{ clips: VerifiedVideoClip[]; errored: boolean }> {
  const rapidKey = process.env.RAPIDAPI_FILMOT_KEY?.trim();
  if (!rapidKey) return { clips: [], errored: false };

  try {
    const url = `https://filmot-subtitle-search.p.rapidapi.com/getsearchsubtitles?query=${encodeURIComponent(`"${word}"`)}&lang=en&sortField=viewcount&sortOrder=desc`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(6500),
      headers: {
        "x-rapidapi-key": rapidKey,
        "x-rapidapi-host": "filmot-subtitle-search.p.rapidapi.com",
      },
    });
    if (!res.ok) {
      console.warn(`Filmot API returned HTTP ${res.status}`);
      return { clips: [], errored: true };
    }
    const json = (await res.json()) as {
      result?: Array<{
        id?: string;
        title?: string;
        channelname?: string;
        hits?: Array<{ start?: number; ctx_before?: string; token?: string; ctx_after?: string }>;
      }>;
    };

    const clips: VerifiedVideoClip[] = [];
    const seenIds = new Set<string>();

    for (const vid of (json.result || []).slice(0, 10)) {
      if (!vid.id || !/^[A-Za-z0-9_-]{11}$/.test(vid.id) || seenIds.has(vid.id)) continue;
      const hit = vid.hits?.[0];
      if (!hit || typeof hit.start !== "number") continue;

      const sentence = cleanCaptionText(
        `${hit.ctx_before || ""} ${hit.token || ""} ${hit.ctx_after || ""}`,
      );
      const masked = maskWordInSentence(sentence, word);
      if (!masked || sentence.length < 12) continue;

      const oembed = await verifyYouTubeOembed(vid.id);
      if (!oembed) continue;

      seenIds.add(vid.id);
      clips.push({
        id: `filmot-${vid.id}-${Math.floor(hit.start)}`,
        youtubeVideoId: vid.id,
        videoTitle: vid.title || oembed.title,
        channelName: vid.channelname || oembed.authorName,
        source: "youtube_filmot",
        timestampSeconds: Math.max(0, Math.floor(hit.start) - 1),
        verifiedTranscript: sentence,
        contextSentence: sentence,
        targetWordPosition: masked.position,
        captionAvailable: true,
        videoAvailable: true,
      });

      if (clips.length >= 5) break;
    }

    return { clips, errored: false };
  } catch (err) {
    console.warn("Filmot discovery error:", err instanceof Error ? err.message : err);
    return { clips: [], errored: true };
  }
}

/** Fetches verified transcript cues for a YouTube video via Supadata or TranscriptAPI.com. */
async function fetchLicensedTranscript(
  videoId: string,
): Promise<{ cues: TranscriptCue[]; source: "youtube_supadata" | "youtube_transcriptapi" } | null> {
  const supadataKey = process.env.SUPADATA_API_KEY?.trim();
  if (supadataKey) {
    try {
      const txRes = await fetch(
        `https://api.supadata.ai/v1/youtube/transcript?videoId=${encodeURIComponent(videoId)}&lang=en`,
        {
          signal: AbortSignal.timeout(6000),
          headers: { "x-api-key": supadataKey },
        },
      );
      if (txRes.ok) {
        const txJson = (await txRes.json()) as {
          content?: Array<{ text?: string; offset?: number }>;
        };
        const raw = Array.isArray(txJson.content) ? txJson.content : [];
        if (raw.length > 0) {
          const cues: TranscriptCue[] = raw.map((c) => {
            const off = c.offset ?? 0;
            return { text: c.text || "", startSec: off > 1000 ? off / 1000 : off };
          });
          return { cues, source: "youtube_supadata" };
        }
      }
    } catch {
      // Fall through to secondary transcript provider
    }
  }

  const transcriptApiKey = process.env.TRANSCRIPT_API_KEY?.trim();
  if (transcriptApiKey) {
    try {
      const txRes = await fetch(
        `https://transcriptapi.com/api/v2/youtube/transcript?video_url=${encodeURIComponent(videoId)}&include_timestamp=true`,
        {
          signal: AbortSignal.timeout(6000),
          headers: { Authorization: `Bearer ${transcriptApiKey}` },
        },
      );
      if (txRes.ok) {
        const txJson = (await txRes.json()) as {
          transcript?: Array<{ text?: string; start?: number }>;
        };
        const raw = Array.isArray(txJson.transcript) ? txJson.transcript : [];
        if (raw.length > 0) {
          const cues: TranscriptCue[] = raw.map((c) => ({
            text: c.text || "",
            startSec: Number(c.start || 0),
          }));
          return { cues, source: "youtube_transcriptapi" };
        }
      }
    } catch {
      // Ignore error
    }
  }

  return null;
}

/**
 * Provider B: Official YouTube Data API v3 search + embeddability verification + Licensed Transcript API.
 */
async function discoverViaYouTubeAndTranscripts(
  word: string,
): Promise<{ clips: VerifiedVideoClip[]; errored: boolean }> {
  const ytKey = process.env.YOUTUBE_API_KEY?.trim();
  const hasTranscriptProvider = Boolean(
    process.env.SUPADATA_API_KEY?.trim() || process.env.TRANSCRIPT_API_KEY?.trim(),
  );
  if (!ytKey || !hasTranscriptProvider) return { clips: [], errored: false };

  try {
    const query = `"${word}" (interview OR podcast OR "TED" OR conversation OR talk OR speech)`;
    const searchUrl =
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video` +
      `&videoEmbeddable=true&videoCaption=closedCaption&relevanceLanguage=en&safeSearch=strict` +
      `&maxResults=8&q=${encodeURIComponent(query)}&key=${encodeURIComponent(ytKey)}`;

    const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(6000) });
    if (!searchRes.ok) {
      console.warn(`YouTube Data API search returned HTTP ${searchRes.status}`);
      return { clips: [], errored: true };
    }
    const searchJson = (await searchRes.json()) as {
      items?: Array<{
        id?: { videoId?: string };
        snippet?: { title?: string; channelTitle?: string };
      }>;
    };

    const candidates = (searchJson.items || [])
      .map((item) => ({
        videoId: item.id?.videoId || "",
        title: cleanCaptionText(item.snippet?.title || "YouTube Video"),
        channelName: cleanCaptionText(item.snippet?.channelTitle || "YouTube"),
      }))
      .filter((c) => /^[A-Za-z0-9_-]{11}$/.test(c.videoId));

    if (candidates.length === 0) return { clips: [], errored: false };

    // Verify embeddable status via official videos.list (costs only 1 quota unit)
    const embeddableSet = new Set<string>(candidates.map((c) => c.videoId));
    try {
      const idsParam = candidates.map((c) => c.videoId).join(",");
      const statusRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=status&id=${encodeURIComponent(idsParam)}&key=${encodeURIComponent(ytKey)}`,
        { signal: AbortSignal.timeout(5000) },
      );
      if (statusRes.ok) {
        const statusJson = (await statusRes.json()) as {
          items?: Array<{ id?: string; status?: { embeddable?: boolean; privacyStatus?: string } }>;
        };
        embeddableSet.clear();
        for (const it of statusJson.items || []) {
          if (it.id && it.status?.embeddable !== false && it.status?.privacyStatus === "public") {
            embeddableSet.add(it.id);
          }
        }
      }
    } catch {
      // Proceed with oEmbed check if status check times out
    }

    const clips: VerifiedVideoClip[] = [];
    const seenIds = new Set<string>();

    for (const cand of candidates) {
      if (!embeddableSet.has(cand.videoId) || seenIds.has(cand.videoId)) continue;

      const tx = await fetchLicensedTranscript(cand.videoId);
      if (!tx) continue;

      const match = extractVerifiedCueMatch(tx.cues, word);
      if (!match) continue;

      seenIds.add(cand.videoId);
      clips.push({
        id: `yt-${cand.videoId}-${match.startSeconds}`,
        youtubeVideoId: cand.videoId,
        videoTitle: cand.title,
        channelName: cand.channelName,
        source: tx.source,
        timestampSeconds: match.startSeconds,
        verifiedTranscript: match.sentence,
        contextSentence: match.sentence,
        targetWordPosition: match.position,
        captionAvailable: true,
        videoAvailable: true,
      });

      if (clips.length >= 5) break;
    }

    return { clips, errored: false };
  } catch (err) {
    console.warn("YouTube+Transcript discovery error:", err instanceof Error ? err.message : err);
    return { clips: [], errored: true };
  }
}

/**
 * Fetches multiple real, authentic English usage sentences in parallel as an unblocked contextual
 * exercise fallback when no verified YouTube video clip is currently available. Never fabricates sentences.
 */
async function fetchAuthenticFallbackContexts(
  word: string,
  savedSentence?: string,
  sourceTitle?: string,
): Promise<FallbackContextItem[]> {
  const results: FallbackContextItem[] = [];
  const seen = new Set<string>();

  const addUnique = (sentence: string, sourceLabel: string, pronunciation?: string) => {
    const clean = cleanCaptionText(sentence);
    if (!clean || clean.length < 12) return;
    const key = clean.toLowerCase();
    if (seen.has(key)) return;
    if (!maskWordInSentence(clean, word)) return;
    seen.add(key);
    results.push({ sentence: clean, sourceLabel, pronunciation });
  };

  if (savedSentence) {
    addUnique(
      savedSentence,
      sourceTitle ? `Your Saved Context · ${sourceTitle}` : "Your Saved Context",
    );
  }

  const ua =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  const [youdaoRes, googleRes] = await Promise.allSettled([
    fetch(`https://dict.youdao.com/jsonapi?q=${encodeURIComponent(word.trim())}`, {
      signal: AbortSignal.timeout(6500),
      headers: { "User-Agent": ua },
    }).then((r) => (r.ok ? r.json() : null)),
    fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=en&dt=ex&q=${encodeURIComponent(word.trim())}`,
      {
        signal: AbortSignal.timeout(6500),
        headers: { "User-Agent": ua },
      },
    ).then((r) => (r.ok ? r.json() : null)),
  ]);

  if (youdaoRes.status === "fulfilled" && youdaoRes.value && typeof youdaoRes.value === "object") {
    const yData = youdaoRes.value as {
      simple?: { word?: Array<{ usphone?: string; ukphone?: string }> };
      auth_sents_part?: { sent?: Array<{ foreign?: string; source?: string }> };
      media_sents_part?: {
        sent?: Array<{
          eng?: string;
          snippets?: { snippet?: Array<{ source?: string }> };
        }>;
      };
      blng_sents_part?: { "sentence-pair"?: Array<{ sentence?: string }> };
    };
    const phone = yData.simple?.word?.[0]?.usphone || yData.simple?.word?.[0]?.ukphone || "";
    const pron = phone ? `/${phone}/` : "";

    for (const s of yData.auth_sents_part?.sent || []) {
      addUnique(
        s.foreign || "",
        s.source ? `Authentic Media · ${cleanCaptionText(s.source)}` : "Verified Authentic Example",
        pron,
      );
      if (results.length >= 3) break;
    }

    if (results.length < 3) {
      for (const m of yData.media_sents_part?.sent || []) {
        const src = m.snippets?.snippet?.[0]?.source;
        addUnique(
          m.eng || "",
          src ? `Broadcast Example · ${cleanCaptionText(src)}` : "Verified Broadcast Example",
          pron,
        );
        if (results.length >= 3) break;
      }
    }

    if (results.length < 3) {
      for (const b of yData.blng_sents_part?.["sentence-pair"] || []) {
        addUnique(b.sentence || "", "Verified Example Sentence", pron);
        if (results.length >= 3) break;
      }
    }
  }

  if (results.length < 3 && googleRes.status === "fulfilled" && Array.isArray(googleRes.value)) {
    const gData = googleRes.value as unknown[];
    const exGroups = Array.isArray(gData?.[13]) ? gData[13] : [];
    for (const group of exGroups) {
      if (!Array.isArray(group)) continue;
      for (const item of group) {
        if (Array.isArray(item) && typeof item[0] === "string") {
          addUnique(item[0], "Verified Dictionary Example");
          if (results.length >= 3) break;
        }
      }
      if (results.length >= 3) break;
    }
  }

  return results;
}

export async function GET(req: Request) {
  const blocked = guardApiRequest(req, "learn-videos", 45);
  if (blocked) return blocked;
  const corsHeaders = getCorsHeaders(req);

  const url = new URL(req.url);
  const word = (url.searchParams.get("word") || "").trim().slice(0, 120);
  const sourceUrl = (url.searchParams.get("sourceUrl") || "").trim().slice(0, 500);
  const savedSentence = (url.searchParams.get("sentence") || "").trim().slice(0, 600);
  const sourceTitle = (url.searchParams.get("sourceTitle") || "").trim().slice(0, 200);
  const forceRefresh = url.searchParams.get("refresh") === "1";

  if (!word) {
    return NextResponse.json({ error: "word is required" }, { status: 400, headers: corsHeaders });
  }

  const wordNormalized = word.toLowerCase();
  const clips: VerifiedVideoClip[] = [];
  const seenKeys = new Set<string>();
  const providersAttempted: string[] = [];
  let cacheStatus: DiscoveryDiagnostics["cacheStatus"] = "empty";

  const pushUnique = (clip: VerifiedVideoClip) => {
    const k = `${clip.youtubeVideoId}:${clip.timestampSeconds}`;
    if (seenKeys.has(k)) return;
    seenKeys.add(k);
    clips.push(clip);
  };

  // Tier 0A: In-memory server cache (15m TTL)
  if (!forceRefresh) {
    const memClips = getMemoryCache(wordNormalized);
    if (memClips && memClips.length > 0) {
      for (const c of memClips) pushUnique(c);
      cacheStatus = "memory_hit";
    }
  }

  // Tier 0B: Supabase verified video cache (30-day TTL, authenticated or service role)
  const supabase = getServerSupabase(req);
  if (!forceRefresh && clips.length === 0 && supabase) {
    try {
      const ttlCutoff = new Date(Date.now() - DB_CACHE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const { data: cached } = await supabase
        .from("vocabulary_video_examples")
        .select(
          "id,youtube_video_id,video_title,channel_name,source,timestamp_seconds,verified_transcript,context_sentence,target_word_position,caption_available,video_available",
        )
        .eq("word_normalized", wordNormalized)
        .eq("video_available", true)
        .gte("updated_at", ttlCutoff)
        .limit(10);

      for (const row of cached || []) {
        pushUnique({
          id: String(row.id),
          youtubeVideoId: String(row.youtube_video_id),
          videoTitle: String(row.video_title || "YouTube Video"),
          channelName: String(row.channel_name || "YouTube"),
          source: (row.source as VerifiedVideoClip["source"]) || "youtube_supadata",
          timestampSeconds: Number(row.timestamp_seconds || 0),
          verifiedTranscript: String(row.verified_transcript || ""),
          contextSentence: String(row.context_sentence || ""),
          targetWordPosition: Number(row.target_word_position || 0),
          captionAvailable: Boolean(row.caption_available),
          videoAvailable: Boolean(row.video_available),
        });
      }
      if (clips.length > 0) {
        cacheStatus = "db_hit";
        setMemoryCache(wordNormalized, clips);
      }
    } catch {
      // Migration 010 may not be applied yet — continue gracefully
    }
  }

  // Tier 1: User's own captured YouTube subtitle clip saved via WordTap extension
  if (sourceUrl && savedSentence) {
    const ytId = extractYouTubeVideoId(sourceUrl);
    const masked = maskWordInSentence(savedSentence, word);
    if (ytId && masked) {
      const oembed = await verifyYouTubeOembed(ytId);
      if (oembed) {
        pushUnique({
          id: `saved-${ytId}-${extractYouTubeTimestamp(sourceUrl)}`,
          youtubeVideoId: ytId,
          videoTitle: sourceTitle || oembed.title,
          channelName: oembed.authorName,
          source: "user_subtitle",
          timestampSeconds: Math.max(0, extractYouTubeTimestamp(sourceUrl) - 1),
          verifiedTranscript: savedSentence,
          contextSentence: savedSentence,
          targetWordPosition: masked.position,
          captionAvailable: true,
          videoAvailable: true,
        });
      }
    }
  }

  // Capability inspection
  const hasYouTubeKey = Boolean(process.env.YOUTUBE_API_KEY?.trim());
  const hasSupadataKey = Boolean(process.env.SUPADATA_API_KEY?.trim());
  const hasTranscriptApiKey = Boolean(process.env.TRANSCRIPT_API_KEY?.trim());
  const hasFilmotKey = Boolean(process.env.RAPIDAPI_FILMOT_KEY?.trim());
  const hasAnyTranscriptProvider = hasSupadataKey || hasTranscriptApiKey;

  // Tier 2: Automated real-time discovery when cache doesn't already hold >= 3 verified clips
  const newlyDiscovered: VerifiedVideoClip[] = [];
  let providerErrored = false;

  if (clips.length < 3 && hasFilmotKey) {
    providersAttempted.push("filmot");
    const filmotRes = await discoverViaFilmot(word);
    if (filmotRes.errored) providerErrored = true;
    for (const c of filmotRes.clips) {
      pushUnique(c);
      newlyDiscovered.push(c);
    }
  }

  if (clips.length < 3 && hasYouTubeKey && hasAnyTranscriptProvider) {
    providersAttempted.push(
      hasSupadataKey ? "youtube_v3+supadata" : "youtube_v3+transcriptapi",
    );
    const ytRes = await discoverViaYouTubeAndTranscripts(word);
    if (ytRes.errored) providerErrored = true;
    for (const c of ytRes.clips) {
      pushUnique(c);
      newlyDiscovered.push(c);
    }
  }

  // Persist newly discovered verified clips into memory & Supabase cache
  if (newlyDiscovered.length > 0) {
    cacheStatus = "fresh_discovery";
    setMemoryCache(wordNormalized, clips);
    if (supabase && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        await supabase.from("vocabulary_video_examples").upsert(
          newlyDiscovered.map((c) => ({
            word_normalized: wordNormalized,
            youtube_video_id: c.youtubeVideoId,
            video_title: c.videoTitle,
            channel_name: c.channelName,
            source: c.source === "youtube_transcriptapi" ? "youtube_supadata" : c.source,
            timestamp_seconds: c.timestampSeconds,
            verified_transcript: c.verifiedTranscript,
            context_sentence: c.contextSentence,
            target_word_position: c.targetWordPosition,
            caption_available: c.captionAvailable,
            video_available: c.videoAvailable,
            updated_at: new Date().toISOString(),
          })),
          { onConflict: "word_normalized,youtube_video_id,timestamp_seconds" },
        );
      } catch {
        // Ignore cache write error if migration 010 isn't applied yet
      }
    }
  }

  // Build clear diagnostic status
  let diagnostics: DiscoveryDiagnostics;
  if (clips.length > 0) {
    diagnostics = {
      status: "verified",
      message: `Found ${clips.length} verified YouTube ${clips.length === 1 ? "example" : "examples"}.`,
      missingEnvVars: [],
      providersAttempted,
      cacheStatus,
    };
  } else if (!hasFilmotKey && !hasYouTubeKey) {
    diagnostics = {
      status: "missing_credentials",
      message:
        "Automatic YouTube video discovery requires either RAPIDAPI_FILMOT_KEY or (YOUTUBE_API_KEY + SUPADATA_API_KEY / TRANSCRIPT_API_KEY) configured in server environment variables.",
      missingEnvVars: ["YOUTUBE_API_KEY", "SUPADATA_API_KEY (or TRANSCRIPT_API_KEY / RAPIDAPI_FILMOT_KEY)"],
      providersAttempted,
      cacheStatus,
    };
    console.warn(`[learn/videos] ${diagnostics.message} (word="${word}")`);
  } else if (hasYouTubeKey && !hasAnyTranscriptProvider && !hasFilmotKey) {
    diagnostics = {
      status: "missing_transcript_provider",
      message:
        "YOUTUBE_API_KEY is set, but YouTube Data API v3 does not expose third-party video transcripts. Configure SUPADATA_API_KEY or TRANSCRIPT_API_KEY (or RAPIDAPI_FILMOT_KEY) for verified caption timestamps.",
      missingEnvVars: ["SUPADATA_API_KEY (or TRANSCRIPT_API_KEY)"],
      providersAttempted,
      cacheStatus,
    };
    console.warn(`[learn/videos] ${diagnostics.message} (word="${word}")`);
  } else if (providerErrored) {
    diagnostics = {
      status: "provider_error",
      message: "Video discovery provider was temporarily unavailable. Using authentic contextual fallback.",
      missingEnvVars: [],
      providersAttempted,
      cacheStatus,
    };
  } else {
    diagnostics = {
      status: "no_matches",
      message: `No embeddable YouTube clips with verified captions containing "${word}" were found.`,
      missingEnvVars: [],
      providersAttempted,
      cacheStatus,
    };
  }

  // Tier 3: Multiple authentic real-world contextual sentences when no verified video is available
  const fallbackContexts =
    clips.length === 0
      ? await fetchAuthenticFallbackContexts(word, savedSentence, sourceTitle)
      : [];

  return NextResponse.json(
    {
      word,
      videos: clips,
      verifiedCount: clips.length,
      fallbackContext: fallbackContexts[0] || null,
      fallbackContexts,
      diagnostics,
      capabilities: {
        youtubeApiConfigured: hasYouTubeKey,
        supadataConfigured: hasSupadataKey,
        transcriptApiConfigured: hasTranscriptApiKey,
        filmotConfigured: hasFilmotKey,
      },
    },
    { headers: corsHeaders },
  );
}

/**
 * POST /api/learn/videos
 * Verifies a user-provided YouTube URL + timestamp + transcript snippet before accepting it as a real example.
 */
export async function POST(req: Request) {
  const blocked = guardApiRequest(req, "learn-videos-contribute", 20);
  if (blocked) return blocked;
  const corsHeaders = getCorsHeaders(req);

  try {
    const raw = await req.json();
    const parsed = contributeSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please provide a valid YouTube URL, timestamp, and transcript sentence." },
        { status: 400, headers: corsHeaders },
      );
    }

    const { word, youtubeUrl, timestampSeconds, transcript } = parsed.data;
    const videoId = extractYouTubeVideoId(youtubeUrl);
    if (!videoId) {
      return NextResponse.json(
        { error: "That doesn't look like a valid YouTube video URL." },
        { status: 400, headers: corsHeaders },
      );
    }

    const cleanTranscript = cleanCaptionText(transcript);
    const masked = maskWordInSentence(cleanTranscript, word);
    if (!masked) {
      return NextResponse.json(
        { error: `The transcript must actually contain the target word "${word}".` },
        { status: 400, headers: corsHeaders },
      );
    }

    const oembed = await verifyYouTubeOembed(videoId);
    if (!oembed) {
      return NextResponse.json(
        { error: "This YouTube video is unavailable or does not allow embedding." },
        { status: 422, headers: corsHeaders },
      );
    }

    const clip: VerifiedVideoClip = {
      id: `contrib-${videoId}-${timestampSeconds}`,
      youtubeVideoId: videoId,
      videoTitle: oembed.title,
      channelName: oembed.authorName,
      source: "user_contributed",
      timestampSeconds,
      verifiedTranscript: cleanTranscript,
      contextSentence: cleanTranscript,
      targetWordPosition: masked.position,
      captionAvailable: true,
      videoAvailable: true,
    };

    // Refresh in-memory cache immediately so subsequent learners see this verified clip
    const wordNormalized = word.toLowerCase();
    const existing = getMemoryCache(wordNormalized) || [];
    setMemoryCache(wordNormalized, [clip, ...existing.filter((c) => c.id !== clip.id)]);

    return NextResponse.json({ clip }, { status: 201, headers: corsHeaders });
  } catch {
    return NextResponse.json(
      { error: "Invalid request payload." },
      { status: 400, headers: corsHeaders },
    );
  }
}

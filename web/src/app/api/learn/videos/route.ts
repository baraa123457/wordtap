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
  source: "youtube_supadata" | "youtube_filmot" | "user_subtitle" | "user_contributed";
  timestampSeconds: number;
  verifiedTranscript: string;
  contextSentence: string;
  targetWordPosition: number;
  captionAvailable: boolean;
  videoAvailable: boolean;
};

type FallbackContext = {
  sentence: string;
  sourceLabel: string;
  pronunciation?: string;
} | null;

const contributeSchema = z.object({
  word: z.string().trim().min(1).max(120),
  youtubeUrl: z.string().trim().min(5).max(500),
  timestampSeconds: z.number().int().min(0).max(86_400),
  transcript: z.string().trim().min(6).max(600),
});

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

/**
 * Verifies a YouTube video exists and permits public embedding using YouTube's official oEmbed endpoint.
 */
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

function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Cleans raw caption text (strips [Music], HTML entities, excessive spaces). */
function cleanCaptionText(text: string): string {
  return text
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Tier 2A: Search Filmot (indexed YouTube subtitle search) via RapidAPI when RAPIDAPI_FILMOT_KEY is configured.
 */
async function discoverViaFilmot(word: string): Promise<VerifiedVideoClip[]> {
  const rapidKey = process.env.RAPIDAPI_FILMOT_KEY?.trim();
  if (!rapidKey) return [];

  try {
    const url = `https://filmot-subtitle-search.p.rapidapi.com/getsearchsubtitles?query=${encodeURIComponent(`"${word}"`)}&lang=en&sortField=viewcount&sortOrder=desc`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(6500),
      headers: {
        "x-rapidapi-key": rapidKey,
        "x-rapidapi-host": "filmot-subtitle-search.p.rapidapi.com",
      },
    });
    if (!res.ok) return [];
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

    for (const vid of (json.result || []).slice(0, 8)) {
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

    return clips;
  } catch (err) {
    console.warn("Filmot discovery error:", err instanceof Error ? err.message : err);
    return [];
  }
}

/**
 * Tier 2B: Official YouTube Data API v3 search + Supadata licensed transcript verification.
 */
async function discoverViaYouTubeAndSupadata(word: string): Promise<VerifiedVideoClip[]> {
  const ytKey = process.env.YOUTUBE_API_KEY?.trim();
  const supadataKey = process.env.SUPADATA_API_KEY?.trim();
  if (!ytKey || !supadataKey) return [];

  try {
    const query = `"${word}" (interview OR podcast OR talk OR conversation OR speech)`;
    const searchUrl =
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video` +
      `&videoEmbeddable=true&videoCaption=closedCaption&relevanceLanguage=en&safeSearch=strict` +
      `&maxResults=6&q=${encodeURIComponent(query)}&key=${encodeURIComponent(ytKey)}`;

    const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(6000) });
    if (!searchRes.ok) return [];
    const searchJson = (await searchRes.json()) as {
      items?: Array<{
        id?: { videoId?: string };
        snippet?: { title?: string; channelTitle?: string };
      }>;
    };

    const clips: VerifiedVideoClip[] = [];
    const seenIds = new Set<string>();

    for (const item of searchJson.items || []) {
      const videoId = item.id?.videoId;
      if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId) || seenIds.has(videoId)) continue;

      try {
        const txRes = await fetch(
          `https://api.supadata.ai/v1/youtube/transcript?videoId=${encodeURIComponent(videoId)}&lang=en`,
          {
            signal: AbortSignal.timeout(6000),
            headers: { "x-api-key": supadataKey },
          },
        );
        if (!txRes.ok) continue;
        const txJson = (await txRes.json()) as {
          content?: Array<{ text?: string; offset?: number; duration?: number }>;
        };
        const cues = Array.isArray(txJson.content) ? txJson.content : [];

        for (let i = 0; i < cues.length; i++) {
          const cue = cues[i]!;
          const rawText = cleanCaptionText(cue.text || "");
          if (!rawText) continue;

          // Combine surrounding cue window for fuller conversational context
          const prevText = i > 0 ? cleanCaptionText(cues[i - 1]?.text || "") : "";
          const nextText = i < cues.length - 1 ? cleanCaptionText(cues[i + 1]?.text || "") : "";
          const combined = cleanCaptionText(`${prevText} ${rawText} ${nextText}`);

          const maskedCue = maskWordInSentence(rawText, word);
          if (!maskedCue) continue;

          const contextSentence = combined.length <= 220 ? combined : rawText;
          const maskedContext = maskWordInSentence(contextSentence, word);
          if (!maskedContext) continue;

          const startSeconds = Math.max(
            0,
            Math.floor(((cue.offset ?? 0) > 1000 ? (cue.offset ?? 0) / 1000 : cue.offset ?? 0)) - 1,
          );

          seenIds.add(videoId);
          clips.push({
            id: `yt-${videoId}-${startSeconds}`,
            youtubeVideoId: videoId,
            videoTitle: cleanCaptionText(item.snippet?.title || "YouTube Video"),
            channelName: cleanCaptionText(item.snippet?.channelTitle || "YouTube"),
            source: "youtube_supadata",
            timestampSeconds: startSeconds,
            verifiedTranscript: contextSentence,
            contextSentence,
            targetWordPosition: maskedContext.position,
            captionAvailable: true,
            videoAvailable: true,
          });
          break;
        }
      } catch {
        // Skip failed transcript video
      }

      if (clips.length >= 5) break;
    }

    return clips;
  } catch (err) {
    console.warn("YouTube+Supadata discovery error:", err instanceof Error ? err.message : err);
    return [];
  }
}

/** Fetches a real authentic English usage example from dictionary sources as graceful fallback context. */
async function fetchAuthenticDictionaryExample(word: string): Promise<FallbackContext> {
  // 1. Free Dictionary API
  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.toLowerCase())}`,
      { signal: AbortSignal.timeout(3500) },
    );
    if (res.ok) {
      const data = (await res.json()) as Array<{
        phonetic?: string;
        meanings?: Array<{
          definitions?: Array<{ example?: string }>;
        }>;
      }>;

      const first = data?.[0];
      for (const m of first?.meanings || []) {
        for (const d of m.definitions || []) {
          if (d.example && maskWordInSentence(d.example, word)) {
            return {
              sentence: d.example.trim(),
              sourceLabel: "Verified Dictionary Example",
              pronunciation: first?.phonetic || "",
            };
          }
        }
      }
    }
  } catch {
    // continue
  }

  // 2. Google Dictionary authentic example sentences (dt=ex)
  try {
    const gRes = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=en&dt=ex&q=${encodeURIComponent(word.trim())}`,
      {
        signal: AbortSignal.timeout(4000),
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      },
    );
    if (gRes.ok) {
      const gData = (await gRes.json()) as unknown[];
      const exGroups = Array.isArray(gData?.[13]) ? gData[13] : [];
      for (const group of exGroups) {
        if (!Array.isArray(group)) continue;
        for (const item of group) {
          if (Array.isArray(item) && typeof item[0] === "string") {
            const clean = cleanCaptionText(item[0]);
            if (clean && maskWordInSentence(clean, word)) {
              return {
                sentence: clean,
                sourceLabel: "Verified Dictionary Example",
              };
            }
          }
        }
      }
    }
  } catch {
    // continue
  }

  // 3. Youdao authentic sentences
  try {
    const yRes = await fetch(
      `https://dict.youdao.com/jsonapi?q=${encodeURIComponent(word.trim())}`,
      {
        signal: AbortSignal.timeout(4000),
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      },
    );
    if (yRes.ok) {
      const yData = (await yRes.json()) as {
        auth_sents_part?: { sent?: Array<{ foreign?: string; source?: string }> };
      };
      for (const s of yData.auth_sents_part?.sent || []) {
        const clean = cleanCaptionText(s.foreign || "");
        if (clean && maskWordInSentence(clean, word)) {
          return {
            sentence: clean,
            sourceLabel: s.source ? `Authentic Example · ${cleanCaptionText(s.source)}` : "Verified Authentic Example",
          };
        }
      }
    }
  } catch {
    // ignore
  }

  return null;
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

  if (!word) {
    return NextResponse.json({ error: "word is required" }, { status: 400, headers: corsHeaders });
  }

  const wordNormalized = word.toLowerCase();
  const clips: VerifiedVideoClip[] = [];
  const seenKeys = new Set<string>();

  const pushUnique = (clip: VerifiedVideoClip) => {
    const k = `${clip.youtubeVideoId}:${clip.timestampSeconds}`;
    if (seenKeys.has(k)) return;
    seenKeys.add(k);
    clips.push(clip);
  };

  // Tier 0: Cached verified video examples from Supabase
  const supabase = getServerSupabase();
  if (supabase) {
    try {
      const { data: cached } = await supabase
        .from("vocabulary_video_examples")
        .select(
          "id,youtube_video_id,video_title,channel_name,source,timestamp_seconds,verified_transcript,context_sentence,target_word_position,caption_available,video_available",
        )
        .eq("word_normalized", wordNormalized)
        .eq("video_available", true)
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
    } catch {
      // Table may not exist before migration 010 — continue gracefully
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

  // Tier 2: Automated discovery if we have fewer than 3 cached verified clips
  const newlyDiscovered: VerifiedVideoClip[] = [];
  if (clips.length < 3) {
    const filmotClips = await discoverViaFilmot(word);
    for (const c of filmotClips) {
      pushUnique(c);
      newlyDiscovered.push(c);
    }
  }
  if (clips.length < 3) {
    const ytClips = await discoverViaYouTubeAndSupadata(word);
    for (const c of ytClips) {
      pushUnique(c);
      newlyDiscovered.push(c);
    }
  }

  // Cache newly discovered verified clips in Supabase (requires service role key)
  if (supabase && process.env.SUPABASE_SERVICE_ROLE_KEY && newlyDiscovered.length > 0) {
    try {
      await supabase.from("vocabulary_video_examples").upsert(
        newlyDiscovered.map((c) => ({
          word_normalized: wordNormalized,
          youtube_video_id: c.youtubeVideoId,
          video_title: c.videoTitle,
          channel_name: c.channelName,
          source: c.source,
          timestamp_seconds: c.timestampSeconds,
          verified_transcript: c.verifiedTranscript,
          context_sentence: c.contextSentence,
          target_word_position: c.targetWordPosition,
          caption_available: c.captionAvailable,
          video_available: c.videoAvailable,
        })),
        { onConflict: "word_normalized,youtube_video_id,timestamp_seconds", ignoreDuplicates: true },
      );
    } catch {
      // Ignore cache write error if migration 010 isn't applied yet
    }
  }

  // Tier 3: Honest fallback context when zero verified YouTube videos are available
  let fallbackContext: FallbackContext = null;
  if (clips.length === 0) {
    if (savedSentence && maskWordInSentence(savedSentence, word)) {
      fallbackContext = {
        sentence: savedSentence,
        sourceLabel: sourceTitle ? `Your Saved Context · ${sourceTitle}` : "Your Saved Context",
      };
    } else {
      fallbackContext = await fetchAuthenticDictionaryExample(word);
    }
  }

  return NextResponse.json(
    {
      word,
      videos: clips,
      verifiedCount: clips.length,
      fallbackContext,
      capabilities: {
        youtubeApiConfigured: Boolean(process.env.YOUTUBE_API_KEY?.trim()),
        supadataConfigured: Boolean(process.env.SUPADATA_API_KEY?.trim()),
        filmotConfigured: Boolean(process.env.RAPIDAPI_FILMOT_KEY?.trim()),
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

    return NextResponse.json({ clip }, { status: 201, headers: corsHeaders });
  } catch {
    return NextResponse.json(
      { error: "Invalid request payload." },
      { status: 400, headers: corsHeaders },
    );
  }
}

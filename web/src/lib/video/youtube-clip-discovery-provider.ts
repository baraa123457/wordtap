import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { maskWordInSentence } from "../placeholder";
import { detectSubtitleLanguage } from "./subtitle-language-checker";
import {
  cleanCaptionText,
  scoreContextCandidate,
  verifyYouTubeOembed,
} from "./transcript-provider";
import { isNonEnglishVideoTitle } from "./video-language-filter";
import type {
  CaptionCue,
  DiscoveryQuery,
  IVideoDiscoveryProvider,
  VerifiedVideoExample,
} from "./types";

const MAX_CLIPS_PER_WORD = 5;
const MAX_CLIP_DURATION_SEC = 12;
const MAX_VIDEO_DURATION_SEC = 25 * 60; // Skip videos > 25 min to conserve transcript quota
const CLIP_PADDING_SEC = 1;

type WordClipRow = {
  id: string;
  word: string;
  video_id: string;
  start_sec: number;
  end_sec: number;
  sentence: string;
  source: string;
  created_at: string;
};

type YouTubeSearchResponse = {
  items?: Array<{
    id?: { videoId?: string };
    snippet?: { title?: string; channelTitle?: string };
  }>;
};

type YouTubeVideosListResponse = {
  items?: Array<{
    id?: string;
    contentDetails?: { duration?: string };
  }>;
};

type SupadataTranscriptResponse = {
  content?: Array<{
    text?: string;
    offset?: number;
    duration?: number;
    lang?: string;
  }>;
  lang?: string;
};

function createSupabaseReadClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const key = serviceKey || anonKey;
  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function createSupabaseWriteClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) return null;

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Parses ISO 8601 duration (e.g. "PT4M13S") into whole seconds. */
function parseIsoDurationSeconds(iso: string | undefined): number | null {
  if (!iso) return null;
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (!m) return null;
  const hours = Number(m[1] || 0);
  const minutes = Number(m[2] || 0);
  const seconds = Number(m[3] || 0);
  return hours * 3600 + minutes * 60 + seconds;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isSpoilerDefinitionTitle(title: string): boolean {
  const lower = title.toLowerCase();
  return (
    /\bwhat does\b.+\bmean\b/.test(lower) ||
    /\bmeaning of\b/.test(lower) ||
    /\bdefinition of\b/.test(lower) ||
    /\bhow to pronounce\b/.test(lower) ||
    /\bpronunciation of\b/.test(lower) ||
    /\bword of the day\b/.test(lower)
  );
}

function toVerifiedExample(
  row: {
    id: string;
    word: string;
    video_id: string;
    start_sec: number;
    end_sec: number;
    sentence: string;
    source: string;
    created_at?: string;
  },
  meta?: {
    wordId?: string | null;
    videoTitle?: string;
    channelName?: string;
    qualityScore?: number;
    captionCues?: CaptionCue[];
  },
): VerifiedVideoExample | null {
  const masked = maskWordInSentence(row.sentence, row.word);
  if (!masked) return null;

  const startSec = Math.max(0, Math.floor(row.start_sec));
  const endSec = Math.max(startSec + 2, Math.ceil(row.end_sec));
  const ytUrl = `https://www.youtube.com/watch?v=${row.video_id}&t=${startSec}s`;

  return {
    id: `word_clip-${row.video_id}-${startSec}`,
    wordId: meta?.wordId ?? null,
    targetWord: row.word,
    mediaType: "youtube",
    youtubeVideoId: row.video_id,
    youtubeUrl: ytUrl,
    mediaUrl: ytUrl,
    videoTitle: meta?.videoTitle || "YouTube Video Example",
    channelName: meta?.channelName || "YouTube",
    source: "youtube_supadata",
    timestampSeconds: startSec,
    endSeconds: endSec,
    verifiedTranscript: row.sentence,
    contextSentence: row.sentence,
    targetWordPosition: masked.position,
    captionCues: meta?.captionCues ?? [{ start: startSec, end: endSec, text: row.sentence }],
    transcriptVerified: true,
    captionAvailable: true,
    videoAvailable: true,
    qualityScore: meta?.qualityScore ?? 85,
    discoveredAt: row.created_at || new Date().toISOString(),
  };
}

/**
 * Cache-first YouTube + Supadata discovery provider backed by `public.word_clips`.
 * 1. Queries `word_clips` first (0 external quota spent).
 * 2. On miss: searches YouTube Data API v3 (closedCaption, en, maxResults=5).
 * 3. Fetches Supadata official transcript, verifies English + <=12s word-boundary clip,
 *    saves to `word_clips` via service role, and returns up to 3 clips.
 */
export class YouTubeWordClipProvider implements IVideoDiscoveryProvider {
  readonly name = "youtube_word_clips";

  isConfigured(): boolean {
    const hasCache = Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
        (process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()),
    );
    const hasApis = Boolean(
      process.env.YOUTUBE_API_KEY?.trim() && process.env.SUPADATA_API_KEY?.trim(),
    );
    return hasCache || hasApis;
  }

  async discover(query: DiscoveryQuery): Promise<VerifiedVideoExample[]> {
    const normalizedWord = query.word.trim().toLowerCase();
    const langCode = (query.lang || "en").slice(0, 2).toLowerCase();
    if (!normalizedWord || langCode !== "en") return [];

    const maxResults = Math.min(query.maxResults ?? MAX_CLIPS_PER_WORD, MAX_CLIPS_PER_WORD);

    // Step 1: Check Supabase `word_clips` cache before using any external API quota
    const cachedClips = await this.readCachedClips(normalizedWord, query.wordId ?? null, maxResults);
    const minDesired = Math.min(4, maxResults);
    if (cachedClips.length >= minDesired) {
      return cachedClips;
    }

    // Step 2: External discovery requires both server-side API keys
    const ytKey = process.env.YOUTUBE_API_KEY?.trim();
    const supadataKey = process.env.SUPADATA_API_KEY?.trim();
    if (!ytKey || !supadataKey) {
      return cachedClips;
    }

    try {
      const candidates = await this.searchYouTubeCandidates(normalizedWord, langCode, ytKey);
      if (candidates.length === 0) return cachedClips;

      const durations = await this.fetchVideoDurations(
        candidates.map((c) => c.videoId),
        ytKey,
      );

      const triedVideoIds = new Set<string>(cachedClips.map((c) => c.youtubeVideoId));
      const discovered: VerifiedVideoExample[] = [];
      const rowsToCache: Array<{
        word: string;
        video_id: string;
        start_sec: number;
        end_sec: number;
        sentence: string;
        source: string;
      }> = [];

      const eligible = candidates.filter((candidate) => {
        if (triedVideoIds.has(candidate.videoId)) return false;
        triedVideoIds.add(candidate.videoId);
        if (
          isNonEnglishVideoTitle(candidate.title, candidate.channelName) ||
          isSpoilerDefinitionTitle(candidate.title)
        ) {
          return false;
        }
        const durationSec = durations.get(candidate.videoId);
        if (typeof durationSec === "number" && durationSec > MAX_VIDEO_DURATION_SEC) {
          return false;
        }
        return true;
      });

      const processCandidate = async (candidate: {
        videoId: string;
        title: string;
        channelName: string;
      }) => {
        const segments = await this.fetchSupadataSegments(candidate.videoId, langCode, supadataKey);
        if (!segments || segments.length === 0) return null;

        const match = this.findBestClipInSegments(segments, normalizedWord);
        if (!match) return null;

        const oembed = await verifyYouTubeOembed(candidate.videoId);
        if (!oembed) return null;
        if (isNonEnglishVideoTitle(oembed.title, oembed.authorName)) return null;

        const qualityScore = scoreContextCandidate({
          sentence: match.sentence,
          targetWord: normalizedWord,
          matchedForm: match.matchedForm,
          videoTitle: oembed.title || candidate.title,
        });

        const example = toVerifiedExample(
          {
            id: `word_clip-${candidate.videoId}-${match.startSec}`,
            word: normalizedWord,
            video_id: candidate.videoId,
            start_sec: match.startSec,
            end_sec: match.endSec,
            sentence: match.sentence,
            source: "youtube_supadata",
          },
          {
            wordId: query.wordId ?? null,
            videoTitle: oembed.title || candidate.title,
            channelName: oembed.authorName || candidate.channelName,
            qualityScore,
            captionCues: [
              {
                start: match.startSec,
                end: match.endSec,
                text: match.sentence,
              },
            ],
          },
        );

        if (!example) return null;

        return {
          example,
          row: {
            word: normalizedWord,
            video_id: candidate.videoId,
            start_sec: match.startSec,
            end_sec: match.endSec,
            sentence: match.sentence,
            source: "youtube_supadata",
          },
        };
      };

      const batchSize = 3;
      for (let i = 0; i < eligible.length; i += batchSize) {
        if (cachedClips.length + discovered.length >= maxResults) break;
        const batch = eligible.slice(i, i + batchSize);
        const settled = await Promise.all(batch.map((c) => processCandidate(c)));
        for (const item of settled) {
          if (!item) continue;
          discovered.push(item.example);
          rowsToCache.push(item.row);
          if (cachedClips.length + discovered.length >= maxResults) break;
        }
      }

      if (rowsToCache.length > 0) {
        await this.persistClips(rowsToCache);
      }

      const sortedFresh = discovered.sort((a, b) => (b.qualityScore ?? 0) - (a.qualityScore ?? 0));
      return [...cachedClips, ...sortedFresh].slice(0, maxResults);
    } catch {
      return cachedClips;
    }
  }

  private async readCachedClips(
    normalizedWord: string,
    wordId: string | null,
    limit: number,
  ): Promise<VerifiedVideoExample[]> {
    const supabase = createSupabaseReadClient();
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from("word_clips")
        .select("id, word, video_id, start_sec, end_sec, sentence, source, created_at")
        .ilike("word", normalizedWord)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error || !Array.isArray(data) || data.length === 0) return [];

      const clips: VerifiedVideoExample[] = [];
      for (const row of data as WordClipRow[]) {
        const example = toVerifiedExample(row, { wordId });
        if (example) clips.push(example);
      }
      return clips;
    } catch {
      return [];
    }
  }

  private async persistClips(
    rows: Array<{
      word: string;
      video_id: string;
      start_sec: number;
      end_sec: number;
      sentence: string;
      source: string;
    }>,
  ): Promise<void> {
    const supabase = createSupabaseWriteClient();
    if (!supabase || rows.length === 0) return;

    try {
      await supabase.from("word_clips").upsert(rows, {
        onConflict: "word,video_id,start_sec",
        ignoreDuplicates: true,
      });
    } catch {
      // Cache write failure must not break clip playback
    }
  }

  private async searchYouTubeCandidates(
    word: string,
    langCode: string,
    ytKey: string,
  ): Promise<Array<{ videoId: string; title: string; channelName: string }>> {
    try {
      const searchUrl =
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video` +
        `&videoCaption=closedCaption&videoEmbeddable=true&safeSearch=strict` +
        `&relevanceLanguage=${encodeURIComponent(langCode)}&maxResults=10` +
        `&q=${encodeURIComponent(word)}` +
        `&key=${encodeURIComponent(ytKey)}`;

      const res = await fetch(searchUrl, { signal: AbortSignal.timeout(7000) });
      if (res.status === 403 || !res.ok) {
        return [];
      }

      const data = (await res.json()) as YouTubeSearchResponse;
      const seen = new Set<string>();
      const results: Array<{ videoId: string; title: string; channelName: string }> = [];

      for (const item of data.items || []) {
        const videoId = item.id?.videoId?.trim() || "";
        if (!/^[A-Za-z0-9_-]{11}$/.test(videoId) || seen.has(videoId)) continue;
        seen.add(videoId);
        results.push({
          videoId,
          title: cleanCaptionText(item.snippet?.title || "YouTube Video"),
          channelName: cleanCaptionText(item.snippet?.channelTitle || "YouTube"),
        });
      }

      return results;
    } catch {
      return [];
    }
  }

  private async fetchVideoDurations(
    videoIds: string[],
    ytKey: string,
  ): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (videoIds.length === 0) return map;

    try {
      const url =
        `https://www.googleapis.com/youtube/v3/videos?part=contentDetails` +
        `&id=${encodeURIComponent(videoIds.join(","))}&key=${encodeURIComponent(ytKey)}`;

      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.status === 403 || !res.ok) return map;

      const data = (await res.json()) as YouTubeVideosListResponse;
      for (const item of data.items || []) {
        if (!item.id) continue;
        const sec = parseIsoDurationSeconds(item.contentDetails?.duration);
        if (sec !== null) map.set(item.id, sec);
      }
    } catch {
      // Duration check is a quota-saving optimization; ignore transient errors
    }

    return map;
  }

  private async fetchSupadataSegments(
    videoId: string,
    langCode: string,
    supadataKey: string,
  ): Promise<Array<{ start: number; end: number; text: string }> | null> {
    try {
      const url =
        `https://api.supadata.ai/v1/youtube/transcript` +
        `?videoId=${encodeURIComponent(videoId)}&lang=${encodeURIComponent(langCode)}`;

      const res = await fetch(url, {
        headers: { "x-api-key": supadataKey },
        signal: AbortSignal.timeout(7000),
      });
      if (!res.ok) return null;

      const data = (await res.json()) as SupadataTranscriptResponse;
      if (data.lang && !data.lang.toLowerCase().startsWith("en")) {
        return null;
      }
      if (!Array.isArray(data.content) || data.content.length === 0) {
        return null;
      }

      const sampleText = data.content
        .slice(0, 12)
        .map((c) => c.text || "")
        .join(" ");
      const detectedLang = detectSubtitleLanguage(sampleText);
      if (detectedLang && detectedLang !== "en") {
        return null;
      }

      return data.content
        .map((seg) => {
          const offsetMs = Number(seg.offset) || 0;
          const durationMs = Math.max(500, Number(seg.duration) || 3000);
          const start = Math.max(0, offsetMs / 1000);
          const end = start + durationMs / 1000;
          return {
            start,
            end,
            text: cleanCaptionText(seg.text || ""),
          };
        })
        .filter((s) => s.text.length > 0);
    } catch {
      return null;
    }
  }

  private findBestClipInSegments(
    segments: Array<{ start: number; end: number; text: string }>,
    normalizedWord: string,
  ): {
    startSec: number;
    endSec: number;
    sentence: string;
    matchedForm: string;
  } | null {
    const exactWordRe = new RegExp(`\\b${escapeRegExp(normalizedWord)}\\b`, "i");

    for (const seg of segments) {
      if (seg.text.length < 10 || seg.text.length > 220) continue;

      // Prefer exact word-boundary match, fallback to simple inflections via maskWordInSentence
      const exactHit = seg.text.match(exactWordRe);
      const masked = maskWordInSentence(seg.text, normalizedWord);
      if (!exactHit && !masked) continue;

      const startSec = Math.max(0, Math.floor(seg.start - CLIP_PADDING_SEC));
      const endSec = Math.ceil(seg.end + CLIP_PADDING_SEC);
      const clipDuration = endSec - startSec;

      if (clipDuration <= 0 || clipDuration > MAX_CLIP_DURATION_SEC) {
        continue;
      }

      return {
        startSec,
        endSec,
        sentence: seg.text,
        matchedForm: exactHit?.[0] || masked?.hiddenWord || normalizedWord,
      };
    }

    return null;
  }
}

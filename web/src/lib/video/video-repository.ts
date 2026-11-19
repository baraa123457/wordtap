import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isAllowedMediaUrl, isNonEnglishVideoTitle } from "./video-language-filter";
import type {
  CaptionCue,
  VerifiedVideoExample,
  VideoDiscoverySource,
  VideoMediaType,
} from "./types";

type MemoryCacheEntry = {
  clips: VerifiedVideoExample[];
  expiresAt: number;
};

const MEMORY_CACHE = new Map<string, MemoryCacheEntry>();
const MAX_MEMORY_ENTRIES = 500;
const MEMORY_TTL_MS = 30 * 60 * 1000; // 30 minutes

const VALID_VIDEO_KEY_RE = /^([A-Za-z0-9_-]{11}|wm_[a-f0-9]{16})$/;

type DbVideoRow = {
  id: string;
  word_id?: string | null;
  word_normalized: string;
  media_type?: string | null;
  youtube_video_id: string;
  youtube_url?: string | null;
  media_url?: string | null;
  video_title: string;
  channel_name: string;
  license?: string | null;
  source: string;
  timestamp_seconds: number;
  verified_transcript: string;
  context_sentence: string;
  target_word_position: number;
  caption_cues?: unknown;
  transcript_verified?: boolean | null;
  caption_available: boolean;
  video_available: boolean;
  discovered_at?: string | null;
  created_at?: string | null;
};

function parseCaptionCues(raw: unknown, fallbackStart: number, fallbackText: string): CaptionCue[] {
  if (Array.isArray(raw)) {
    const parsed = raw
      .filter((c): c is Record<string, unknown> => Boolean(c) && typeof c === "object")
      .map((c) => {
        const start = Math.max(0, Number(c.start) || 0);
        const end = Math.max(start + 0.5, Number(c.end) || start + 4);
        const text = typeof c.text === "string" ? c.text.trim() : "";
        return { start, end, text };
      })
      .filter((c) => c.text.length > 0);
    if (parsed.length > 0) return parsed;
  }
  return [{ start: fallbackStart, end: fallbackStart + 6, text: fallbackText }];
}

function mapRowToExample(row: DbVideoRow): VerifiedVideoExample {
  const ts = Math.max(0, Number(row.timestamp_seconds) || 0);
  const mediaType: VideoMediaType =
    row.media_type === "direct_video" || row.source === "wikimedia_commons"
      ? "direct_video"
      : "youtube";

  const canonicalUrl =
    row.youtube_url && row.youtube_url.trim().length > 0
      ? row.youtube_url
      : mediaType === "youtube"
      ? `https://www.youtube.com/watch?v=${row.youtube_video_id}&t=${ts}s`
      : row.media_url || "";

  const rawMediaUrl =
    row.media_url && row.media_url.trim().length > 0 ? row.media_url : canonicalUrl;
  const mediaUrl = isAllowedMediaUrl(rawMediaUrl) ? rawMediaUrl : canonicalUrl;

  const allowedSources: VideoDiscoverySource[] = [
    "youglish_rest",
    "youtube_filmot",
    "youtube_supadata",
    "youtube_transcriptapi",
    "wikimedia_commons",
    "user_subtitle",
    "user_contributed",
  ];
  const source = allowedSources.includes(row.source as VideoDiscoverySource)
    ? (row.source as VideoDiscoverySource)
    : "youtube_supadata";

  return {
    id: row.id,
    wordId: row.word_id ?? null,
    targetWord: row.word_normalized,
    mediaType,
    youtubeVideoId: row.youtube_video_id,
    youtubeUrl: canonicalUrl,
    mediaUrl,
    videoTitle: row.video_title || "Video Example",
    channelName: row.channel_name || "Video",
    license: row.license || undefined,
    source,
    timestampSeconds: ts,
    verifiedTranscript: row.verified_transcript,
    contextSentence: row.context_sentence,
    targetWordPosition: Math.max(0, Number(row.target_word_position) || 0),
    captionCues: parseCaptionCues(row.caption_cues, ts, row.context_sentence),
    transcriptVerified: row.transcript_verified ?? true,
    captionAvailable: row.caption_available ?? true,
    videoAvailable: row.video_available ?? true,
    discoveredAt: row.discovered_at || row.created_at || new Date().toISOString(),
  };
}

function createServerSupabase(req?: Request): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url) return null;

  if (serviceKey) {
    return createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  const authHeader = req?.headers.get("authorization");
  if (anonKey && authHeader && /^Bearer\s+.+/i.test(authHeader)) {
    return createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authHeader } },
    });
  }

  // Gracefully fallback to anon key for server-side cached reads/writes to public tables
  if (anonKey) {
    return createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return null;
}

export class VideoRepository {
  getFromMemory(wordNormalized: string): VerifiedVideoExample[] | null {
    const entry = MEMORY_CACHE.get(wordNormalized);
    if (!entry) return null;
    if (Date.now() >= entry.expiresAt) {
      MEMORY_CACHE.delete(wordNormalized);
      return null;
    }
    return entry.clips.filter((c) => c.videoAvailable);
  }

  setMemory(wordNormalized: string, clips: VerifiedVideoExample[]): void {
    const englishClips = clips.filter((c) => !isNonEnglishVideoTitle(c.videoTitle, c.channelName));
    if (englishClips.length === 0) return;
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
    MEMORY_CACHE.set(wordNormalized, { clips: englishClips, expiresAt: now + MEMORY_TTL_MS });
  }

  evictVideoFromMemory(videoKey: string): void {
    for (const [k, entry] of MEMORY_CACHE.entries()) {
      const remaining = entry.clips.filter((c) => c.youtubeVideoId !== videoKey);
      if (remaining.length === 0) {
        MEMORY_CACHE.delete(k);
      } else if (remaining.length !== entry.clips.length) {
        MEMORY_CACHE.set(k, { clips: remaining, expiresAt: entry.expiresAt });
      }
    }
  }

  async findByWord(
    wordNormalized: string,
    req?: Request,
    options?: { bypassMemory?: boolean },
  ): Promise<{ clips: VerifiedVideoExample[]; source: "memory_hit" | "db_hit" | "empty" }> {
    if (!options?.bypassMemory) {
      const mem = this.getFromMemory(wordNormalized);
      if (mem && mem.length > 0) {
        return { clips: mem, source: "memory_hit" };
      }
    }

    const supabase = createServerSupabase(req);
    if (!supabase) return { clips: [], source: "empty" };

    try {
      const fullCols =
        "id,word_id,word_normalized,media_type,youtube_video_id,youtube_url,media_url,video_title,channel_name,license,source,timestamp_seconds,verified_transcript,caption_cues,context_sentence,target_word_position,transcript_verified,caption_available,video_available,discovered_at,created_at";
      const legacyCols =
        "id,word_normalized,youtube_video_id,video_title,channel_name,source,timestamp_seconds,verified_transcript,context_sentence,target_word_position,caption_available,video_available,created_at";

      let { data, error } = await supabase
        .from("vocabulary_video_examples")
        .select(fullCols)
        .eq("word_normalized", wordNormalized)
        .eq("video_available", true)
        .eq("caption_available", true)
        .order("created_at", { ascending: false })
        .limit(12);

      if (error) {
        const retry = await supabase
          .from("vocabulary_video_examples")
          .select(legacyCols)
          .eq("word_normalized", wordNormalized)
          .eq("video_available", true)
          .eq("caption_available", true)
          .order("created_at", { ascending: false })
          .limit(12);
        data = retry.data as typeof data;
        error = retry.error;
      }

      if (error || !Array.isArray(data) || data.length === 0) {
        return { clips: [], source: "empty" };
      }

      const mapped = (data as DbVideoRow[])
        .map(mapRowToExample)
        .filter((c) => Boolean(c.mediaUrl) && !isNonEnglishVideoTitle(c.videoTitle, c.channelName));
      if (mapped.length === 0) return { clips: [], source: "empty" };

      this.setMemory(wordNormalized, mapped);
      return { clips: mapped, source: "db_hit" };
    } catch {
      return { clips: [], source: "empty" };
    }
  }

  async saveMany(
    wordNormalized: string,
    wordId: string | null,
    clips: VerifiedVideoExample[],
    req?: Request,
  ): Promise<void> {
    const validClips = clips.filter((c) => !isNonEnglishVideoTitle(c.videoTitle, c.channelName));
    if (validClips.length === 0) return;

    const existing = this.getFromMemory(wordNormalized) || [];
    const deduped: VerifiedVideoExample[] = [];
    const seen = new Set<string>();
    for (const c of [...validClips, ...existing]) {
      const key = `${c.youtubeVideoId}:${c.timestampSeconds}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(c);
    }
    this.setMemory(wordNormalized, deduped);

    const supabase = createServerSupabase(req);
    if (!supabase) return;

    const safeWordId = wordId && /^[0-9a-f-]{36}$/i.test(wordId) ? wordId : null;
    const hasServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());

    for (const clip of clips) {
      try {
        if (hasServiceRole) {
          const { error } = await supabase.from("vocabulary_video_examples").upsert(
            {
              word_id: safeWordId,
              word_normalized: wordNormalized,
              media_type: clip.mediaType,
              youtube_video_id: clip.youtubeVideoId,
              youtube_url: clip.youtubeUrl,
              media_url: clip.mediaUrl,
              video_title: clip.videoTitle,
              channel_name: clip.channelName,
              license: clip.license || "",
              source: clip.source,
              timestamp_seconds: clip.timestampSeconds,
              verified_transcript: clip.verifiedTranscript,
              caption_cues: clip.captionCues,
              context_sentence: clip.contextSentence,
              target_word_position: clip.targetWordPosition,
              transcript_verified: clip.transcriptVerified,
              caption_available: clip.captionAvailable,
              video_available: true,
              discovered_at: clip.discoveredAt,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "word_normalized,youtube_video_id,timestamp_seconds" },
          );
          if (!error) continue;
        }

        await supabase.rpc("save_verified_video_example", {
          p_word_id: safeWordId,
          p_word_normalized: wordNormalized,
          p_media_type: clip.mediaType,
          p_youtube_video_id: clip.youtubeVideoId,
          p_media_url: clip.mediaUrl,
          p_youtube_url: clip.youtubeUrl,
          p_video_title: clip.videoTitle,
          p_channel_name: clip.channelName,
          p_license: clip.license || "",
          p_source: clip.source,
          p_timestamp_seconds: clip.timestampSeconds,
          p_verified_transcript: clip.verifiedTranscript,
          p_context_sentence: clip.contextSentence,
          p_target_word_position: clip.targetWordPosition,
          p_caption_cues: clip.captionCues,
          p_transcript_verified: clip.transcriptVerified,
        });
      } catch {
        // Ignore if migration 010/012 hasn't been executed yet — memory cache still holds it
      }
    }
  }

  async markUnavailable(videoKey: string, req?: Request): Promise<void> {
    if (!VALID_VIDEO_KEY_RE.test(videoKey)) return;
    this.evictVideoFromMemory(videoKey);

    const supabase = createServerSupabase(req);
    if (!supabase) return;

    try {
      if (process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
        await supabase
          .from("vocabulary_video_examples")
          .update({ video_available: false, updated_at: new Date().toISOString() })
          .eq("youtube_video_id", videoKey);
      } else {
        await supabase.rpc("mark_video_unavailable", {
          p_youtube_video_id: videoKey,
        });
      }
    } catch {
      // Ignore if migration 012 isn't applied yet
    }
  }
}

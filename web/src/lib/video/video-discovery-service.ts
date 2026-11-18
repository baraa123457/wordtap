import { maskWordInSentence } from "../placeholder";
import {
  cleanCaptionText,
  CompositeTranscriptProvider,
  extractTimestampSeconds,
  extractYouTubeVideoId,
  mapLangToYouGlish,
  verifyYouTubeOembed,
} from "./transcript-provider";
import type {
  CaptionCue,
  DiscoveryQuery,
  FallbackContextExample,
  IVideoDiscoveryProvider,
  VerifiedVideoExample,
} from "./types";

/**
 * 1. Official YouGlish REST API v1 Provider (https://youglish.com/api/doc/rest)
 * Commercial REST API key required (YOUGLISH_API_KEY).
 * Returns YouTube video IDs, timestamps, captions, and surrounding timestamped cues.
 */
export class YouGlishRestDiscoveryProvider implements IVideoDiscoveryProvider {
  readonly name = "youglish_rest";

  isConfigured(): boolean {
    return Boolean(process.env.YOUGLISH_API_KEY?.trim());
  }

  async discover(query: DiscoveryQuery): Promise<VerifiedVideoExample[]> {
    const apiKey = process.env.YOUGLISH_API_KEY?.trim();
    if (!apiKey) return [];

    const maxResults = Math.min(query.maxResults ?? 6, 10);
    const lg = mapLangToYouGlish(query.lang);

    try {
      const searchUrl = `https://youglish.com/api/v1/videos/search?key=${encodeURIComponent(
        apiKey,
      )}&query=${encodeURIComponent(query.word)}&lg=${encodeURIComponent(lg)}&restricted=yes&page=1`;

      const res = await fetch(searchUrl, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return [];

      const data = (await res.json()) as {
        results?: Array<{
          display?: string;
          vid?: string;
          start?: string | number;
          id?: string | number;
          zone?: string;
        }>;
      };

      const rows = Array.isArray(data.results) ? data.results : [];
      const seenVideos = new Set<string>();
      const verified: VerifiedVideoExample[] = [];
      const nowIso = new Date().toISOString();

      for (const row of rows) {
        if (verified.length >= maxResults) break;
        const vid = String(row.vid || "").trim();
        if (!/^[A-Za-z0-9_-]{11}$/.test(vid) || seenVideos.has(vid)) continue;

        const sentence = cleanCaptionText(String(row.display || ""));
        const masked = maskWordInSentence(sentence, query.word);
        if (!masked) continue;

        const oembed = await verifyYouTubeOembed(vid);
        if (!oembed) continue;

        seenVideos.add(vid);
        const startSec = Math.max(0, Math.floor(Number(row.start) || 0));
        const clipStart = Math.max(0, startSec - 2);

        // Fetch surrounding timestamped captions via official YouGlish Captions API
        const cues = await this.fetchSurroundingCues(apiKey, vid, lg, clipStart, sentence);

        verified.push({
          id: `youglish_rest-${vid}-${clipStart}`,
          wordId: query.wordId ?? null,
          targetWord: query.word,
          youtubeVideoId: vid,
          youtubeUrl: `https://www.youtube.com/watch?v=${vid}&t=${clipStart}s`,
          videoTitle: oembed.title,
          channelName: oembed.authorName,
          source: "youglish_rest",
          timestampSeconds: clipStart,
          verifiedTranscript: sentence,
          contextSentence: sentence,
          targetWordPosition: masked.position,
          captionCues: cues,
          transcriptVerified: true,
          captionAvailable: true,
          videoAvailable: true,
          discoveredAt: nowIso,
        });
      }

      return verified;
    } catch {
      return [];
    }
  }

  private async fetchSurroundingCues(
    apiKey: string,
    videoId: string,
    lg: string,
    startSec: number,
    fallbackSentence: string,
  ): Promise<CaptionCue[]> {
    try {
      const url = `https://youglish.com/api/v1/captions/fetch/by_time?key=${encodeURIComponent(
        apiKey,
      )}&video=${encodeURIComponent(videoId)}&lg=${encodeURIComponent(lg)}&start=${startSec}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(4500) });
      if (res.ok) {
        const data = (await res.json()) as {
          results?: Array<{ display?: string; start?: string | number; end?: string | number }>;
        };
        if (Array.isArray(data.results) && data.results.length > 0) {
          const parsed = data.results
            .map((c) => {
              const s = Math.max(0, Number(c.start) || 0);
              const e = Math.max(s + 1, Number(c.end) || s + 3);
              return { start: s, end: e, text: cleanCaptionText(String(c.display || "")) };
            })
            .filter((c) => c.text.length > 0);
          if (parsed.length > 0) return parsed;
        }
      }
    } catch {
      // Fall back to single cue from verified search result
    }
    return [{ start: startSec, end: startSec + 6, text: fallbackSentence }];
  }
}

/**
 * 2. Official RapidAPI Filmot Subtitle Search Provider (RAPIDAPI_FILMOT_KEY)
 * Searches indexed YouTube captions directly by spoken word with exact timestamps.
 */
export class FilmotDiscoveryProvider implements IVideoDiscoveryProvider {
  readonly name = "youtube_filmot";

  isConfigured(): boolean {
    return Boolean(process.env.RAPIDAPI_FILMOT_KEY?.trim());
  }

  async discover(query: DiscoveryQuery): Promise<VerifiedVideoExample[]> {
    const apiKey = process.env.RAPIDAPI_FILMOT_KEY?.trim();
    if (!apiKey) return [];

    const maxResults = Math.min(query.maxResults ?? 6, 10);
    const langCode = (query.lang || "en").slice(0, 2).toLowerCase();

    try {
      const url = `https://filmot-subtitle-search.p.rapidapi.com/getsubtitlesearch?query=${encodeURIComponent(
        `"${query.word}"`,
      )}&lang=${encodeURIComponent(langCode)}&category=Education,People%20%26%20Blogs,News%20%26%20Politics`;

      const res = await fetch(url, {
        headers: {
          "x-rapidapi-key": apiKey,
          "x-rapidapi-host": "filmot-subtitle-search.p.rapidapi.com",
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return [];

      const data = (await res.json()) as {
        result?: Array<{
          id?: string;
          title?: string;
          channelname?: string;
          hits?: Array<{ start?: number; ctx_before?: string; token?: string; ctx_after?: string }>;
        }>;
      };

      const rows = Array.isArray(data.result) ? data.result : [];
      const seen = new Set<string>();
      const verified: VerifiedVideoExample[] = [];
      const nowIso = new Date().toISOString();

      for (const item of rows) {
        if (verified.length >= maxResults) break;
        const vid = String(item.id || "").trim();
        if (!/^[A-Za-z0-9_-]{11}$/.test(vid) || seen.has(vid)) continue;
        const hit = item.hits?.[0];
        if (!hit) continue;

        const sentence = cleanCaptionText(
          `${hit.ctx_before || ""} ${hit.token || ""} ${hit.ctx_after || ""}`,
        );
        const masked = maskWordInSentence(sentence, query.word);
        if (!masked) continue;

        const oembed = await verifyYouTubeOembed(vid);
        if (!oembed) continue;

        seen.add(vid);
        const startSec = Math.max(0, Math.floor(Number(hit.start) || 0) - 2);
        verified.push({
          id: `youtube_filmot-${vid}-${startSec}`,
          wordId: query.wordId ?? null,
          targetWord: query.word,
          youtubeVideoId: vid,
          youtubeUrl: `https://www.youtube.com/watch?v=${vid}&t=${startSec}s`,
          videoTitle: oembed.title || item.title || "YouTube Video",
          channelName: oembed.authorName || item.channelname || "YouTube",
          source: "youtube_filmot",
          timestampSeconds: startSec,
          verifiedTranscript: sentence,
          contextSentence: sentence,
          targetWordPosition: masked.position,
          captionCues: [{ start: startSec, end: startSec + 6, text: sentence }],
          transcriptVerified: true,
          captionAvailable: true,
          videoAvailable: true,
          discoveredAt: nowIso,
        });
      }

      return verified;
    } catch {
      return [];
    }
  }
}

/**
 * 3. Official YouTube Data API v3 + TranscriptProvider Discovery
 * Searches embeddable captioned YouTube videos (interviews, talks, podcasts, educational content)
 * and verifies that the target word is ACTUALLY spoken in the transcript (rejects title-only matches!).
 */
export class YouTubeDataDiscoveryProvider implements IVideoDiscoveryProvider {
  readonly name = "youtube_data_transcript";
  private readonly transcriptProvider: CompositeTranscriptProvider;

  constructor(transcriptProvider?: CompositeTranscriptProvider) {
    this.transcriptProvider = transcriptProvider ?? new CompositeTranscriptProvider();
  }

  isConfigured(): boolean {
    return Boolean(process.env.YOUTUBE_API_KEY?.trim()) && this.transcriptProvider.hasConfiguredProvider();
  }

  async discover(query: DiscoveryQuery): Promise<VerifiedVideoExample[]> {
    const ytKey = process.env.YOUTUBE_API_KEY?.trim();
    if (!ytKey || !this.transcriptProvider.hasConfiguredProvider()) return [];

    const maxResults = Math.min(query.maxResults ?? 5, 8);
    const langCode = (query.lang || "en").slice(0, 2).toLowerCase();
    const searchQuery = `${query.word} interview OR podcast OR TED OR talk`;

    try {
      const searchUrl =
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video` +
        `&videoEmbeddable=true&videoCaption=closedCaption&safeSearch=strict` +
        `&relevanceLanguage=${encodeURIComponent(langCode)}&maxResults=10` +
        `&q=${encodeURIComponent(searchQuery)}&key=${encodeURIComponent(ytKey)}`;

      const res = await fetch(searchUrl, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return [];

      const data = (await res.json()) as {
        items?: Array<{
          id?: { videoId?: string };
          snippet?: { title?: string; channelTitle?: string };
        }>;
      };

      const candidates = (data.items || [])
        .map((it) => ({
          videoId: it.id?.videoId || "",
          title: cleanCaptionText(it.snippet?.title || "YouTube Video"),
          channelName: cleanCaptionText(it.snippet?.channelTitle || "YouTube"),
        }))
        .filter((c) => /^[A-Za-z0-9_-]{11}$/.test(c.videoId));

      const verified: VerifiedVideoExample[] = [];
      const seen = new Set<string>();
      const nowIso = new Date().toISOString();

      // Verify transcripts in parallel batches (never accept title-only matches)
      for (const candidate of candidates) {
        if (verified.length >= maxResults) break;
        if (seen.has(candidate.videoId)) continue;

        const match = await this.transcriptProvider.verifyWordInVideo(
          candidate.videoId,
          query.word,
          langCode,
        );
        if (!match) continue;

        const oembed = await verifyYouTubeOembed(candidate.videoId);
        if (!oembed) continue;

        seen.add(candidate.videoId);
        verified.push({
          id: `${match.providerSource}-${candidate.videoId}-${match.timestampSeconds}`,
          wordId: query.wordId ?? null,
          targetWord: query.word,
          youtubeVideoId: candidate.videoId,
          youtubeUrl: `https://www.youtube.com/watch?v=${candidate.videoId}&t=${match.timestampSeconds}s`,
          videoTitle: oembed.title || candidate.title,
          channelName: oembed.authorName || candidate.channelName,
          source: match.providerSource,
          timestampSeconds: match.timestampSeconds,
          verifiedTranscript: match.verifiedTranscript,
          contextSentence: match.contextSentence,
          targetWordPosition: match.targetWordPosition,
          captionCues: match.captionCues,
          transcriptVerified: true,
          captionAvailable: true,
          videoAvailable: true,
          discoveredAt: nowIso,
        });
      }

      return verified;
    } catch {
      return [];
    }
  }
}

/**
 * 4. User-Saved YouTube Subtitle Provider
 * When the learner saved this word directly from a real YouTube video via the WordTap extension,
 * verifies embeddability via official YouTube oEmbed and surfaces the real clip immediately.
 */
export class UserSavedSubtitleProvider implements IVideoDiscoveryProvider {
  readonly name = "user_subtitle";

  isConfigured(): boolean {
    return true;
  }

  async discover(query: DiscoveryQuery): Promise<VerifiedVideoExample[]> {
    if (!query.sourceUrl || !query.savedSentence) return [];
    const videoId = extractYouTubeVideoId(query.sourceUrl);
    if (!videoId) return [];

    const sentence = cleanCaptionText(query.savedSentence);
    const masked = maskWordInSentence(sentence, query.word);
    if (!masked) return [];

    const oembed = await verifyYouTubeOembed(videoId);
    if (!oembed) return [];

    const ts = Math.max(0, extractTimestampSeconds(query.sourceUrl) - 2);
    return [
      {
        id: `user_subtitle-${videoId}-${ts}`,
        wordId: query.wordId ?? null,
        targetWord: query.word,
        youtubeVideoId: videoId,
        youtubeUrl: `https://www.youtube.com/watch?v=${videoId}&t=${ts}s`,
        videoTitle: oembed.title || query.sourceTitle || "Saved YouTube Clip",
        channelName: oembed.authorName || "YouTube",
        source: "user_subtitle",
        timestampSeconds: ts,
        verifiedTranscript: sentence,
        contextSentence: sentence,
        targetWordPosition: masked.position,
        captionCues: [{ start: ts, end: ts + 6, text: sentence }],
        transcriptVerified: true,
        captionAvailable: true,
        videoAvailable: true,
        discoveredAt: new Date().toISOString(),
      },
    ];
  }
}

/**
 * Fetches clearly labeled authentic text/dictionary fallback sentences ONLY when 0 verified videos exist.
 * Never presented as a video transcript.
 */
export async function fetchAuthenticFallbackContexts(
  word: string,
  savedSentence?: string,
): Promise<FallbackContextExample[]> {
  const results: FallbackContextExample[] = [];
  const seen = new Set<string>();

  const pushIfValid = (raw: string, sourceLabel: string, pronunciation?: string) => {
    const clean = cleanCaptionText(raw);
    if (clean.length < 15 || clean.length > 260) return;
    if (!maskWordInSentence(clean, word)) return;
    const key = clean.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    results.push({ sentence: clean, sourceLabel, pronunciation });
  };

  if (savedSentence) {
    pushIfValid(savedSentence, "Your saved context sentence");
  }

  const tasks = [
    // Free Dictionary API
    (async () => {
      try {
        const res = await fetch(
          `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.toLowerCase())}`,
          { signal: AbortSignal.timeout(4000) },
        );
        if (!res.ok) return;
        const json = (await res.json()) as Array<{
          phonetic?: string;
          meanings?: Array<{ definitions?: Array<{ example?: string }> }>;
        }>;
        const phon = json[0]?.phonetic;
        for (const entry of json.slice(0, 2)) {
          for (const m of entry.meanings || []) {
            for (const d of m.definitions || []) {
              if (d.example) pushIfValid(d.example, "Dictionary text example", phon);
            }
          }
        }
      } catch {
        // ignore timeout
      }
    })(),
    // Youdao bilingual / authentic example sentences
    (async () => {
      try {
        const res = await fetch(
          `https://dict.youdao.com/jsonapi?q=${encodeURIComponent(word)}`,
          { signal: AbortSignal.timeout(4500) },
        );
        if (!res.ok) return;
        const json = (await res.json()) as {
          auth_sents_part?: { sent?: Array<{ foreign?: string; source?: string }> };
          blng_sents_part?: { "sentence-pair"?: Array<{ sentence?: string }> };
        };
        for (const s of json.auth_sents_part?.sent || []) {
          if (s.foreign) {
            pushIfValid(
              s.foreign,
              s.source ? `Published text example (${cleanCaptionText(s.source)})` : "Published text example",
            );
          }
        }
        for (const s of json.blng_sents_part?.["sentence-pair"] || []) {
          if (s.sentence) pushIfValid(s.sentence, "Dictionary text example");
        }
      } catch {
        // ignore timeout
      }
    })(),
  ];

  await Promise.allSettled(tasks);
  return results.slice(0, 4);
}

/**
 * Orchestrates all pluggable video discovery providers cleanly.
 */
export class VideoDiscoveryService {
  private readonly providers: IVideoDiscoveryProvider[];
  private readonly transcriptProvider: CompositeTranscriptProvider;

  constructor(providers?: IVideoDiscoveryProvider[], transcriptProvider?: CompositeTranscriptProvider) {
    this.transcriptProvider = transcriptProvider ?? new CompositeTranscriptProvider();
    this.providers = providers ?? [
      new YouGlishRestDiscoveryProvider(),
      new FilmotDiscoveryProvider(),
      new YouTubeDataDiscoveryProvider(this.transcriptProvider),
      new UserSavedSubtitleProvider(),
    ];
  }

  getProviderCapabilities() {
    return {
      youglishRest: Boolean(process.env.YOUGLISH_API_KEY?.trim()),
      filmot: Boolean(process.env.RAPIDAPI_FILMOT_KEY?.trim()),
      youtubeData: Boolean(process.env.YOUTUBE_API_KEY?.trim()),
      supadata: Boolean(process.env.SUPADATA_API_KEY?.trim()),
      transcriptApi: Boolean(process.env.TRANSCRIPT_API_KEY?.trim()),
    };
  }

  getMissingEnvVars(): string[] {
    const caps = this.getProviderCapabilities();
    if (caps.youglishRest || caps.filmot) return [];
    if (caps.youtubeData && (caps.supadata || caps.transcriptApi)) return [];
    if (caps.youtubeData) return ["SUPADATA_API_KEY or TRANSCRIPT_API_KEY"];
    return ["YOUGLISH_API_KEY (or RAPIDAPI_FILMOT_KEY, or YOUTUBE_API_KEY + SUPADATA_API_KEY)"];
  }

  async discover(query: DiscoveryQuery): Promise<{
    videos: VerifiedVideoExample[];
    providersAttempted: string[];
  }> {
    const maxResults = Math.min(query.maxResults ?? 6, 10);
    const providersAttempted: string[] = [];
    const collected: VerifiedVideoExample[] = [];
    const seenVideoIds = new Set<string>();

    for (const provider of this.providers) {
      if (!provider.isConfigured()) continue;
      if (collected.length >= maxResults) break;

      providersAttempted.push(provider.name);
      const found = await provider.discover({
        ...query,
        maxResults: maxResults - collected.length,
      });

      for (const clip of found) {
        if (seenVideoIds.has(clip.youtubeVideoId)) continue;
        seenVideoIds.add(clip.youtubeVideoId);
        collected.push(clip);
        if (collected.length >= maxResults) break;
      }
    }

    return { videos: collected, providersAttempted };
  }
}

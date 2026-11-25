import { createHash } from "node:crypto";
import { maskWordInSentence } from "../placeholder";
import { getVerbConjugation } from "../verbs";
import {
  isAllowedMediaUrl,
  isNonEnglishVideoMetadata,
  isNonEnglishVideoTitle,
  isVerifiedEnglishCollection,
  MAX_VIDEO_FILE_SIZE_BYTES,
} from "./video-language-filter";
import { detectSubtitleLanguage } from "./subtitle-language-checker";
import {
  cleanCaptionText,
  CompositeTranscriptProvider,
  extractTimestampSeconds,
  extractYouTubeVideoId,
  findVerifiedWordInCues,
  mapLangToYouGlish,
  parseSrtOrVttToCues,
  scoreContextCandidate,
  verifyYouTubeOembed,
} from "./transcript-provider";
import { YouTubeWordClipProvider } from "./youtube-clip-discovery-provider";
import type {
  CaptionCue,
  DiscoveryQuery,
  FallbackContextExample,
  IVideoDiscoveryProvider,
  VerifiedVideoExample,
} from "./types";

const WIKIMEDIA_USER_AGENT = "WordTapLearningApp/1.0 (https://wordtap.app; educational-video-context)";

function makeWikimediaVideoKey(fileTitle: string): string {
  const hash = createHash("sha256").update(fileTitle.toLowerCase()).digest("hex").slice(0, 16);
  return `wm_${hash}`;
}

function cleanWikimediaTitle(fileTitle: string): string {
  return fileTitle
    .replace(/^File:/i, "")
    .replace(/\.(webm|mp4|ogv)$/i, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
}

/**
 * Robust fetch wrapper that gracefully retries on rate limits (429) or transient gateway errors (503/504)
 * with exponential backoff before throwing.
 */
async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  retries = 2,
  baseBackoffMs = 400,
): Promise<Response> {
  let attempt = 0;
  while (true) {
    try {
      const res = await fetch(url, init);
      if ((res.status === 429 || res.status === 503 || res.status === 504) && attempt < retries) {
        attempt++;
        await new Promise((resolve) => setTimeout(resolve, baseBackoffMs * Math.pow(2, attempt - 1)));
        continue;
      }
      return res;
    } catch (err) {
      if (attempt < retries) {
        attempt++;
        await new Promise((resolve) => setTimeout(resolve, baseBackoffMs * Math.pow(2, attempt - 1)));
        continue;
      }
      throw err;
    }
  }
}

/**
 * 1. Official YouGlish REST API v1 Provider (https://youglish.com/api/doc/rest)
 * Commercial REST API key required (YOUGLISH_API_KEY).
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

      const res = await fetchWithRetry(searchUrl, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return [];

      const data = (await res.json()) as {
        results?: Array<{
          display?: string;
          vid?: string;
          start?: string | number;
        }>;
      };

      const rows = Array.isArray(data.results) ? data.results.slice(0, 14) : [];
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
        const cues = await this.fetchSurroundingCues(apiKey, vid, lg, clipStart, sentence);
      // Detect subtitle language and reject non‑English subtitles
      const subtitleText = cues.map((c) => c.text).join(' ');
      const subLang = detectSubtitleLanguage(subtitleText);
      if (subLang && subLang !== 'en') {
        // Skip this video – subtitles are not English
        continue;
      }
        const qualityScore = scoreContextCandidate({
          sentence,
          targetWord: query.word,
          matchedForm: masked.hiddenWord,
          videoTitle: oembed.title,
        });
        const ytUrl = `https://www.youtube.com/watch?v=${vid}&t=${clipStart}s`;

        verified.push({
          id: `youglish_rest-${vid}-${clipStart}`,
          wordId: query.wordId ?? null,
          targetWord: query.word,
          mediaType: "youtube",
          youtubeVideoId: vid,
          youtubeUrl: ytUrl,
          mediaUrl: ytUrl,
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
          qualityScore,
          discoveredAt: nowIso,
        });
      }

      return verified.sort((a, b) => (b.qualityScore ?? 0) - (a.qualityScore ?? 0));
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
      // Fall back to verified search sentence cue
    }
    return [{ start: startSec, end: startSec + 6, text: fallbackSentence }];
  }
}

/**
 * 2. Official RapidAPI Filmot Subtitle Search Provider (RAPIDAPI_FILMOT_KEY)
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

      const rows = Array.isArray(data.result) ? data.result.slice(0, 14) : [];
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
        const ytUrl = `https://www.youtube.com/watch?v=${vid}&t=${startSec}s`;
        const title = oembed.title || item.title || "YouTube Video";
        const channelName = oembed.authorName || item.channelname || "YouTube";

        // Strictly reject foreign video titles/channels even if English translated subtitles exist
        if (isNonEnglishVideoTitle(title, channelName)) continue;

        const qualityScore = scoreContextCandidate({
          sentence,
          targetWord: query.word,
          matchedForm: masked.hiddenWord,
          videoTitle: title,
        });

        verified.push({
          id: `youtube_filmot-${vid}-${startSec}`,
          wordId: query.wordId ?? null,
          targetWord: query.word,
          mediaType: "youtube",
          youtubeVideoId: vid,
          youtubeUrl: ytUrl,
          mediaUrl: ytUrl,
          videoTitle: title,
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
          qualityScore,
          discoveredAt: nowIso,
        });
      }

      return verified.sort((a, b) => (b.qualityScore ?? 0) - (a.qualityScore ?? 0));
    } catch {
      return [];
    }
  }
}

/**
 * 3. Official YouTube Data API v3 + CompositeTranscriptProvider
 * Searches multiple candidate videos (educational/interviews/podcasts), evaluates transcripts in parallel,
 * and ranks the best verified matches.
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

    const maxResults = Math.min(query.maxResults ?? 6, 8);
    const langCode = (query.lang || "en").slice(0, 2).toLowerCase();
    const queries = [
      `${query.word} interview OR TED OR lecture`,
      `${query.word} podcast OR explained OR conversation`,
    ];

    try {
      const candidateMap = new Map<string, { videoId: string; title: string; channelName: string }>();

      await Promise.allSettled(
        queries.map(async (q) => {
          const searchUrl =
            `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video` +
            `&videoEmbeddable=true&videoCaption=closedCaption&safeSearch=strict` +
            `&relevanceLanguage=${encodeURIComponent(langCode)}&maxResults=8` +
            `&q=${encodeURIComponent(q)}&key=${encodeURIComponent(ytKey)}`;
          const res = await fetch(searchUrl, { signal: AbortSignal.timeout(7500) });
          if (!res.ok) return;
          const data = (await res.json()) as {
            items?: Array<{
              id?: { videoId?: string };
              snippet?: { title?: string; channelTitle?: string };
            }>;
          };
          for (const it of data.items || []) {
            const vid = it.id?.videoId || "";
            if (!/^[A-Za-z0-9_-]{11}$/.test(vid) || candidateMap.has(vid)) continue;
            candidateMap.set(vid, {
              videoId: vid,
              title: cleanCaptionText(it.snippet?.title || "YouTube Video"),
              channelName: cleanCaptionText(it.snippet?.channelTitle || "YouTube"),
            });
          }
        }),
      );

      const candidates = Array.from(candidateMap.values()).slice(0, 12);
      const nowIso = new Date().toISOString();

      // Evaluate multiple candidates in parallel (don't stop on first failed candidate!)
      const evaluated = await Promise.allSettled(
        candidates.map(async (candidate): Promise<VerifiedVideoExample | null> => {
          const match = await this.transcriptProvider.verifyWordInVideo(
            candidate.videoId,
            query.word,
            langCode,
            { videoTitle: candidate.title },
          );
          if (!match) return null;

          const oembed = await verifyYouTubeOembed(candidate.videoId);
          if (!oembed) return null;

          const ytUrl = `https://www.youtube.com/watch?v=${candidate.videoId}&t=${match.timestampSeconds}s`;
          return {
            id: `${match.providerSource}-${candidate.videoId}-${match.timestampSeconds}`,
            wordId: query.wordId ?? null,
            targetWord: query.word,
            mediaType: "youtube",
            youtubeVideoId: candidate.videoId,
            youtubeUrl: ytUrl,
            mediaUrl: ytUrl,
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
            qualityScore: match.qualityScore,
            discoveredAt: nowIso,
          };
        }),
      );

      return evaluated
        .filter(
          (r): r is PromiseFulfilledResult<VerifiedVideoExample | null> => r.status === "fulfilled",
        )
        .map((r) => r.value)
        .filter((v): v is VerifiedVideoExample => v !== null)
        .sort((a, b) => (b.qualityScore ?? 0) - (a.qualityScore ?? 0))
        .slice(0, maxResults);
    } catch {
      return [];
    }
  }
}

/**
 * 4. User-Saved YouTube Subtitle Provider
 * Reuses a verified clip when the user saved the word directly from a YouTube video via WordTap extension.
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
    const ytUrl = `https://www.youtube.com/watch?v=${videoId}&t=${ts}s`;
    const title = oembed.title || query.sourceTitle || "Saved YouTube Clip";

    return [
      {
        id: `user_subtitle-${videoId}-${ts}`,
        wordId: query.wordId ?? null,
        targetWord: query.word,
        mediaType: "youtube",
        youtubeVideoId: videoId,
        youtubeUrl: ytUrl,
        mediaUrl: ytUrl,
        videoTitle: title,
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
        qualityScore: 95,
        discoveredAt: new Date().toISOString(),
      },
    ];
  }
}

/**
 * 5. Official Wikimedia Commons TimedText + Creative Commons Video Provider
 * Uses the official public MediaWiki API (https://commons.wikimedia.org/w/api.php) — zero API key,
 * zero scraping, 100% open-licensed (CC BY / CC BY-SA / CC0 / Public Domain) videos with verified
 * millisecond-accurate SRT/VTT English subtitles.
 */
export class WikimediaCommonsVideoProvider implements IVideoDiscoveryProvider {
  readonly name = "wikimedia_commons";

  isConfigured(): boolean {
    return true;
  }

  async discover(query: DiscoveryQuery): Promise<VerifiedVideoExample[]> {
    const langCode = (query.lang || "en").trim().toLowerCase().slice(0, 2);
    if (langCode !== "en") return [];

    const maxResults = Math.min(query.maxResults ?? 6, 8);
    const searchTerms = this.buildSearchQueries(query.word);

    try {
      // Step 1: Search multiple candidate TimedText subtitle pages (namespace 102)
      const timedTextTitles = new Set<string>();
      for (const term of searchTerms) {
        if (timedTextTitles.size >= 12) break;
        const searchUrl =
          `https://commons.wikimedia.org/w/api.php?action=query&list=search&srnamespace=102` +
          `&srsearch=${encodeURIComponent(term)}&srlimit=12&format=json`;
        const res = await fetchWithRetry(searchUrl, {
          headers: { "User-Agent": WIKIMEDIA_USER_AGENT },
          signal: AbortSignal.timeout(6500),
        });
        if (!res.ok) continue;
        const data = (await res.json()) as {
          query?: { search?: Array<{ title?: string }> };
        };
        for (const hit of data.query?.search || []) {
          const t = hit.title || "";
          // Strictly accept playable HTML5 video formats (.webm / .mp4) with English captions
          if (!/^TimedText:.+\.(webm|mp4)\.en([-.][a-z0-9]+)?\.(srt|vtt)$/i.test(t)) continue;
          timedTextTitles.add(t);
          if (timedTextTitles.size >= 12) break;
        }
      }

      if (timedTextTitles.size === 0) return [];

      // Map each TimedText page to its parent File: video page (deduplicating multiple subtitle tracks per video)
      const pairs: Array<{ timedTextTitle: string; fileTitle: string }> = [];
      const seenFiles = new Set<string>();
      for (const tt of timedTextTitles) {
        const fileName = tt
          .replace(/^TimedText:/i, "")
          .replace(/\.en([-.][a-z0-9]+)?\.(srt|vtt)$/i, "");

        // Filter out obvious foreign-language video titles immediately
        if (isNonEnglishVideoTitle(fileName)) continue;

        const fileTitle = `File:${fileName}`;
        const key = fileTitle.toLowerCase();
        if (seenFiles.has(key)) continue;
        seenFiles.add(key);
        pairs.push({ timedTextTitle: tt, fileTitle });
        if (pairs.length >= 10) break;
      }

      // Step 2: Fetch ALL SRT contents + ALL video file URLs/metadata in 2 parallel batched official API calls
      const ttParam = pairs.map((p) => p.timedTextTitle).join("|");
      const fileParam = pairs.map((p) => p.fileTitle).join("|");

      const [srtRes, fileRes] = await Promise.all([
        fetchWithRetry(
          `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(
            ttParam,
          )}&prop=revisions&rvprop=content&rvslots=main&format=json&formatversion=2`,
          {
            headers: { "User-Agent": WIKIMEDIA_USER_AGENT },
            signal: AbortSignal.timeout(8000),
          },
        ),
        fetchWithRetry(
          `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(
            fileParam,
          )}&prop=imageinfo&iiprop=url|mime|duration|size|dimensions|extmetadata|metadata&format=json&formatversion=2`,
          {
            headers: { "User-Agent": WIKIMEDIA_USER_AGENT },
            signal: AbortSignal.timeout(8000),
          },
        ),
      ]);

      if (!srtRes.ok || !fileRes.ok) return [];

      const srtJson = (await srtRes.json()) as {
        query?: {
          pages?: Array<{
            title?: string;
            missing?: boolean;
            revisions?: Array<{ slots?: { main?: { content?: string } } }>;
          }>;
        };
      };
      const fileJson = (await fileRes.json()) as {
        query?: {
          pages?: Array<{
            title?: string;
            missing?: boolean;
            imageinfo?: Array<{
              url?: string;
              descriptionurl?: string;
              mime?: string;
              duration?: number;
              size?: number;
              width?: number;
              height?: number;
              metadata?: Array<{ name: string; value: unknown }>;
              extmetadata?: {
                LicenseShortName?: { value?: string };
                Artist?: { value?: string };
                Categories?: { value?: string };
                ImageDescription?: { value?: string };
              };
            }>;
          }>;
        };
      };

      const srtByTitle = new Map<string, string>();
      for (const page of srtJson.query?.pages || []) {
        const content = page.revisions?.[0]?.slots?.main?.content;
        if (page.title && !page.missing && content) {
          srtByTitle.set(page.title.toLowerCase(), content);
        }
      }

      const fileInfoByTitle = new Map<
        string,
        {
          url: string;
          descriptionUrl: string;
          mime: string;
          duration: number;
          size: number;
          width: number;
          height: number;
          license: string;
          artist: string;
          categories: string;
        }
      >();
      for (const page of fileJson.query?.pages || []) {
        const info = page.imageinfo?.[0];
        if (!page.title || page.missing || !info?.url) continue;
        const mime = (info.mime || "").toLowerCase();
        if (mime !== "video/webm" && mime !== "video/mp4") continue;
        if (!info.url.startsWith("https://upload.wikimedia.org/") || !isAllowedMediaUrl(info.url)) continue;
        // Enforce hard size limit (max 150MB) so mobile and web playback stays fast and doesn't exhaust bandwidth
        if (typeof info.size === "number" && info.size > MAX_VIDEO_FILE_SIZE_BYTES) continue;

        // Verify the video actually has an audio stream (reject silent timelapses, silent animations, etc.)
        const metadata = info.metadata;
        const hasAudioStream =
          Array.isArray(metadata) &&
          metadata.some((m) => {
            if (m.name !== "audio") return false;
            if (Array.isArray(m.value)) {
              const channels = m.value.find(
                (v: unknown): v is { name?: string; value?: unknown } =>
                  Boolean(v) && typeof v === "object" && (v as { name?: string }).name === "channels",
              );
              if (channels && Number(channels.value) === 0) return false;
            }
            return true;
          });

        if (!hasAudioStream) {
          // Reject silent video with no audio track
          continue;
        }

        // Verify that video audio is natively in English (reject German, French, Spanish, etc.)
        const rawCategories = info.extmetadata?.Categories?.value || "";
        const rawDescription = info.extmetadata?.ImageDescription?.value || "";
        if (
          isNonEnglishVideoMetadata({
            title: page.title,
            categories: rawCategories,
            description: rawDescription,
          })
        ) {
          continue;
        }

        const cleanUrl = info.url.split("?")[0] || info.url;
        const rawArtist = info.extmetadata?.Artist?.value || "";
        const artist = cleanCaptionText(rawArtist).slice(0, 80);
        const license = cleanCaptionText(info.extmetadata?.LicenseShortName?.value || "CC Open License").slice(
          0,
          40,
        );

        fileInfoByTitle.set(page.title.toLowerCase(), {
          url: cleanUrl,
          descriptionUrl: info.descriptionurl || cleanUrl,
          mime,
          duration: Number(info.duration) || 0,
          size: Number(info.size) || 0,
          width: Number(info.width) || 0,
          height: Number(info.height) || 0,
          license,
          artist,
          categories: rawCategories,
        });
      }

      // Step 3: Verify transcripts, extract best ranked sentence per video, and rank all videos
      const verified: VerifiedVideoExample[] = [];
      const nowIso = new Date().toISOString();

      for (const pair of pairs) {
        const srt = srtByTitle.get(pair.timedTextTitle.toLowerCase());
        const fileInfo = fileInfoByTitle.get(pair.fileTitle.toLowerCase());
        if (!srt || !fileInfo) continue;

        const cues = parseSrtOrVttToCues(srt);
        // Eliminate non-speech media (silent showcase reels, 1-line promos, b-rolls with only 1-2 title cards)
        if (cues.length < 3) continue;

        const totalTranscriptWords = cues.reduce(
          (sum, c) => sum + c.text.split(/\s+/).filter(Boolean).length,
          0,
        );
        if (totalTranscriptWords < 15) continue;

        // Verify subtitle language is English (reject German, French, Spanish, Chinese subtitles)
        const combinedSubtitleText = cues.map((c) => c.text).join(" ");
        const subLang = detectSubtitleLanguage(combinedSubtitleText);
        if (subLang && subLang !== "en") continue;

        const videoTitle = cleanWikimediaTitle(pair.fileTitle);
        if (isNonEnglishVideoTitle(videoTitle)) continue;

        const match = findVerifiedWordInCues(cues, query.word, "wikimedia_commons", {
          videoTitle,
          durationSec: fileInfo.duration,
        });
        if (!match) continue;

        // Prefer modern 16:9 widescreen clips & concise file sizes
        const sizeBonus = fileInfo.size > 0 && fileInfo.size < 150_000_000 ? 6 : 0;
        const widescreenBonus =
          fileInfo.width >= 640 && fileInfo.height > 0 && fileInfo.width / fileInfo.height >= 1.5
            ? 8
            : 0;
        // Boost verified native spoken English public institutions (DVIDS, PBS, NASA, VOA, C-SPAN)
        const englishSourceBonus = isVerifiedEnglishCollection(fileInfo.categories, videoTitle)
          ? 40
          : 0;
        const videoKey = makeWikimediaVideoKey(pair.fileTitle);
        const channelLabel = fileInfo.artist
          ? `${fileInfo.artist} · Wikimedia Commons (${fileInfo.license})`
          : `Wikimedia Commons (${fileInfo.license})`;

        verified.push({
          id: `wikimedia_commons-${videoKey}-${match.timestampSeconds}`,
          wordId: query.wordId ?? null,
          targetWord: query.word,
          mediaType: "direct_video",
          youtubeVideoId: videoKey,
          youtubeUrl: fileInfo.descriptionUrl,
          mediaUrl: fileInfo.url,
          videoTitle,
          channelName: channelLabel,
          license: fileInfo.license,
          source: "wikimedia_commons",
          timestampSeconds: match.timestampSeconds,
          verifiedTranscript: match.verifiedTranscript,
          contextSentence: match.contextSentence,
          targetWordPosition: match.targetWordPosition,
          captionCues: match.captionCues,
          transcriptVerified: true,
          captionAvailable: true,
          videoAvailable: true,
          qualityScore: match.qualityScore + sizeBonus + widescreenBonus + englishSourceBonus,
          discoveredAt: nowIso,
        });
      }

      return verified
        .sort((a, b) => (b.qualityScore ?? 0) - (a.qualityScore ?? 0))
        .slice(0, maxResults);
    } catch {
      return [];
    }
  }

  private buildSearchQueries(rawWord: string): string[] {
    const clean = rawWord.trim();
    const queries = [`"${clean}" intitle:.webm intitle:.en`];
    const conj = getVerbConjugation(clean);
    if (conj && conj.base.toLowerCase() !== clean.toLowerCase()) {
      queries.push(`"${conj.base}" intitle:.webm intitle:.en`);
    }
    queries.push(`"${clean}" intitle:.mp4 intitle:.en`);
    return queries;
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
              if (d.example) pushIfValid(d.example, "Dictionary text & audio example", phon);
            }
          }
        }
      } catch {
        // ignore timeout
      }
    })(),
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
              s.source
                ? `Published text & audio example (${cleanCaptionText(s.source)})`
                : "Published text & audio example",
            );
          }
        }
        for (const s of json.blng_sents_part?.["sentence-pair"] || []) {
          if (s.sentence) pushIfValid(s.sentence, "Dictionary text & audio example");
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
 * Orchestrates all pluggable video discovery providers cleanly, deduplicates across sources,
 * and ranks candidates by educational quality, sentence clarity, and accessibility.
 */
export class VideoDiscoveryService {
  private readonly providers: IVideoDiscoveryProvider[];
  private readonly transcriptProvider: CompositeTranscriptProvider;
  private readonly inFlightSearches = new Map<
    string,
    Promise<{ videos: VerifiedVideoExample[]; providersAttempted: string[] }>
  >();

  constructor(providers?: IVideoDiscoveryProvider[], transcriptProvider?: CompositeTranscriptProvider) {
    this.transcriptProvider = transcriptProvider ?? new CompositeTranscriptProvider();
    this.providers = providers ?? [
      new UserSavedSubtitleProvider(),
      new YouTubeWordClipProvider(),
      new YouGlishRestDiscoveryProvider(),
      new FilmotDiscoveryProvider(),
      new WikimediaCommonsVideoProvider(),
    ];
  }

  getProviderCapabilities() {
    return {
      youglishRest: Boolean(process.env.YOUGLISH_API_KEY?.trim()),
      filmot: Boolean(process.env.RAPIDAPI_FILMOT_KEY?.trim()),
      youtubeData: Boolean(process.env.YOUTUBE_API_KEY?.trim()),
      supadata: Boolean(process.env.SUPADATA_API_KEY?.trim()),
      transcriptApi: Boolean(process.env.TRANSCRIPT_API_KEY?.trim()),
      wikimediaCommons: true,
    };
  }

  getMissingEnvVars(): string[] {
    const caps = this.getProviderCapabilities();
    if (caps.youglishRest || caps.filmot) return [];
    if (caps.youtubeData && (caps.supadata || caps.transcriptApi)) return [];
    // Wikimedia Commons works out-of-the-box; YouTube/YouGlish keys are optional upgrades
    return [];
  }

  async discover(query: DiscoveryQuery): Promise<{
    videos: VerifiedVideoExample[];
    providersAttempted: string[];
  }> {
    const key = `${query.word.trim().toLowerCase()}_${(query.lang || "en").toLowerCase()}_${query.maxResults ?? 6}_${query.sourceUrl || ""}`;
    const inFlight = this.inFlightSearches.get(key);
    if (inFlight) {
      return inFlight;
    }

    const task = this.executeDiscovery(query).finally(() => {
      this.inFlightSearches.delete(key);
    });

    this.inFlightSearches.set(key, task);
    return task;
  }

  private async executeDiscovery(query: DiscoveryQuery): Promise<{
    videos: VerifiedVideoExample[];
    providersAttempted: string[];
  }> {
    const maxResults = Math.min(query.maxResults ?? 8, 10);
    const providersAttempted: string[] = [];
    const collected: VerifiedVideoExample[] = [];
    const seenVideoIds = new Set<string>();

    for (const provider of this.providers) {
      if (!provider.isConfigured()) continue;
      const isWikimedia = provider.name === "wikimedia_commons";
      if (maxResults === 1 && collected.length >= 1) break;
      if (!isWikimedia && collected.length >= maxResults) continue;

      const remaining = Math.max(0, maxResults - collected.length);
      const providerLimit =
        maxResults === 1
          ? 1
          : isWikimedia
          ? Math.max(2, Math.min(3, remaining || 2))
          : remaining;

      providersAttempted.push(provider.name);
      const found = await provider.discover({
        ...query,
        maxResults: providerLimit,
      });

      let addedForProvider = 0;
      for (const clip of found) {
        if (seenVideoIds.has(clip.youtubeVideoId)) continue;
        seenVideoIds.add(clip.youtubeVideoId);
        collected.push(clip);
        addedForProvider++;
        if (addedForProvider >= providerLimit) break;
      }
    }

    collected.sort((a, b) => (b.qualityScore ?? 0) - (a.qualityScore ?? 0));
    return { videos: collected.slice(0, maxResults), providersAttempted };
  }
}

import { maskWordInSentence } from "../placeholder";
import type { CaptionCue, ITranscriptProvider, TranscriptMatchResult } from "./types";

export function cleanCaptionText(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\[\[\[|\]\]\]/g, "")
    .replace(/\[[^\]]+\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractYouTubeVideoId(input: string): string | null {
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

export function extractTimestampSeconds(input: string): number {
  try {
    const url = new URL(input);
    const raw = url.searchParams.get("t") || url.searchParams.get("start") || "";
    if (!raw) return 0;
    if (/^\d+$/.test(raw)) return Math.max(0, Number(raw));
    const h = /(\d+)h/i.exec(raw)?.[1];
    const m = /(\d+)m/i.exec(raw)?.[1];
    const s = /(\d+)s/i.exec(raw)?.[1];
    const total = (Number(h) || 0) * 3600 + (Number(m) || 0) * 60 + (Number(s) || 0);
    return Math.max(0, total);
  } catch {
    return 0;
  }
}

export function mapLangToYouGlish(langCode?: string | null): string {
  const code = (langCode || "en").trim().toLowerCase().slice(0, 2);
  const map: Record<string, string> = {
    en: "english",
    de: "german",
    fr: "french",
    es: "spanish",
    it: "italian",
    pt: "portuguese",
    nl: "dutch",
    ru: "russian",
    tr: "turkish",
    ar: "arabic",
    ja: "japanese",
    ko: "korean",
    zh: "chinese",
    pl: "polish",
    sv: "swedish",
  };
  return map[code] || "english";
}

/**
 * Verifies a YouTube video exists and permits official embedding via YouTube's public oEmbed API.
 */
export async function verifyYouTubeOembed(
  videoId: string,
): Promise<{ title: string; authorName: string } | null> {
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null;
  try {
    const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(
      `https://www.youtube.com/watch?v=${videoId}`,
    )}&format=json`;
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(4500) });
    if (!res.ok) return null;
    const data = (await res.json()) as { title?: string; author_name?: string };
    return {
      title: (data.title || "YouTube Video").slice(0, 300),
      authorName: (data.author_name || "YouTube").slice(0, 160),
    };
  } catch {
    return null;
  }
}

/**
 * Searches verified timestamped caption cues for an actual occurrence of the target vocabulary word,
 * extracts the complete surrounding context sentence, and slices a ±20s synchronized cue window.
 * Never fabricates captions or timestamps.
 */
export function findVerifiedWordInCues(
  cues: CaptionCue[],
  targetWord: string,
  providerSource: "youtube_supadata" | "youtube_transcriptapi",
): TranscriptMatchResult | null {
  for (let i = 0; i < cues.length; i += 1) {
    const cur = cues[i]!;
    const text = cleanCaptionText(cur.text);
    if (!text) continue;

    if (!maskWordInSentence(text, targetWord)) continue;

    // Build complete natural context sentence using adjacent cues if the current cue is short
    const prev = i > 0 ? cleanCaptionText(cues[i - 1]!.text) : "";
    const next = i + 1 < cues.length ? cleanCaptionText(cues[i + 1]!.text) : "";
    let combined = text;
    if (text.length < 48 && prev && !/[.!?]$/.test(prev)) {
      combined = `${prev} ${combined}`;
    }
    if (combined.length < 72 && next && !/[.!?]$/.test(combined)) {
      combined = `${combined} ${next}`;
    }
    combined = combined.replace(/\s+/g, " ").trim().slice(0, 320);

    const masked = maskWordInSentence(combined, targetWord);
    if (!masked) continue;

    // Start 2 seconds before cue for natural lead-in listening context
    const cueStart = Math.max(0, Math.floor(cur.start));
    const clipStart = Math.max(0, cueStart - 2);

    // Slice ±20s of synchronized timestamped cues around the target word
    const windowCues = cues
      .filter((c) => c.end >= Math.max(0, cueStart - 15) && c.start <= cueStart + 25)
      .slice(0, 24)
      .map((c) => ({
        start: Number(c.start.toFixed(2)),
        end: Number(c.end.toFixed(2)),
        text: cleanCaptionText(c.text),
      }))
      .filter((c) => c.text.length > 0);

    return {
      timestampSeconds: clipStart,
      contextSentence: combined,
      verifiedTranscript: combined,
      targetWordPosition: masked.position,
      captionCues: windowCues,
      providerSource,
    };
  }
  return null;
}

/**
 * Official Supadata Transcript Provider (https://supadata.ai)
 */
export class SupadataTranscriptProvider implements ITranscriptProvider {
  readonly name = "supadata";
  readonly source = "youtube_supadata" as const;

  isConfigured(): boolean {
    return Boolean(process.env.SUPADATA_API_KEY?.trim());
  }

  async fetchTranscriptCues(videoId: string, lang: string): Promise<CaptionCue[] | null> {
    const apiKey = process.env.SUPADATA_API_KEY?.trim();
    if (!apiKey) return null;

    try {
      const url = `https://api.supadata.ai/v1/youtube/transcript?videoId=${encodeURIComponent(
        videoId,
      )}&lang=${encodeURIComponent(lang.slice(0, 2) || "en")}`;
      const res = await fetch(url, {
        headers: { "x-api-key": apiKey },
        signal: AbortSignal.timeout(7000),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as {
        content?: Array<{ text?: string; offset?: number; duration?: number }>;
      };
      if (!Array.isArray(data.content) || data.content.length === 0) return null;

      return data.content
        .map((seg) => {
          const offsetRaw = Number(seg.offset) || 0;
          const durRaw = Number(seg.duration) || 3000;
          // Supadata returns offset/duration in milliseconds
          const start = offsetRaw > 1000 ? offsetRaw / 1000 : offsetRaw;
          const dur = durRaw > 100 ? durRaw / 1000 : durRaw;
          return {
            start: Math.max(0, start),
            end: Math.max(start + 0.5, start + Math.max(1, dur)),
            text: cleanCaptionText(seg.text || ""),
          };
        })
        .filter((c) => c.text.length > 0);
    } catch {
      return null;
    }
  }
}

/**
 * Official TranscriptAPI.com Provider (https://transcriptapi.com)
 */
export class TranscriptApiProvider implements ITranscriptProvider {
  readonly name = "transcriptapi";
  readonly source = "youtube_transcriptapi" as const;

  isConfigured(): boolean {
    return Boolean(process.env.TRANSCRIPT_API_KEY?.trim());
  }

  async fetchTranscriptCues(videoId: string, lang: string): Promise<CaptionCue[] | null> {
    const apiKey = process.env.TRANSCRIPT_API_KEY?.trim();
    if (!apiKey) return null;

    try {
      const url = `https://transcriptapi.com/api/v2/youtube/transcript?video_url=${encodeURIComponent(
        `https://www.youtube.com/watch?v=${videoId}`,
      )}&lang=${encodeURIComponent(lang.slice(0, 2) || "en")}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(7000),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as {
        transcript?: Array<{ text?: string; start?: number; duration?: number }>;
      };
      if (!Array.isArray(data.transcript) || data.transcript.length === 0) return null;

      return data.transcript
        .map((seg) => {
          const start = Math.max(0, Number(seg.start) || 0);
          const dur = Math.max(1, Number(seg.duration) || 3);
          return {
            start,
            end: start + dur,
            text: cleanCaptionText(seg.text || ""),
          };
        })
        .filter((c) => c.text.length > 0);
    } catch {
      return null;
    }
  }
}

/**
 * Composite transcript provider that queries configured official providers in priority order.
 */
export class CompositeTranscriptProvider {
  private readonly providers: ITranscriptProvider[];

  constructor(providers?: ITranscriptProvider[]) {
    this.providers = providers ?? [
      new SupadataTranscriptProvider(),
      new TranscriptApiProvider(),
    ];
  }

  hasConfiguredProvider(): boolean {
    return this.providers.some((p) => p.isConfigured());
  }

  getConfiguredNames(): string[] {
    return this.providers.filter((p) => p.isConfigured()).map((p) => p.name);
  }

  async verifyWordInVideo(
    videoId: string,
    targetWord: string,
    lang: string,
  ): Promise<TranscriptMatchResult | null> {
    for (const provider of this.providers) {
      if (!provider.isConfigured()) continue;
      const cues = await provider.fetchTranscriptCues(videoId, lang);
      if (!cues || cues.length === 0) continue;
      const match = findVerifiedWordInCues(cues, targetWord, provider.source);
      if (match) return match;
    }
    return null;
  }
}

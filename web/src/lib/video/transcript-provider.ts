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
    .replace(/^[>\-–—\s]+/, "")
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

function parseSrtTimestamp(raw: string): number | null {
  const m = /(?:(\d{1,2}):)?(\d{2}):(\d{2})[,.](\d{1,3})/.exec(raw.trim());
  if (!m) return null;
  const h = Number(m[1] || 0);
  const min = Number(m[2] || 0);
  const sec = Number(m[3] || 0);
  const ms = Number((m[4] || "0").padEnd(3, "0"));
  return h * 3600 + min * 60 + sec + ms / 1000;
}

/**
 * Parses standard SRT or WebVTT caption files (e.g. Wikimedia Commons TimedText)
 * into clean timestamped CaptionCue arrays.
 */
export function parseSrtOrVttToCues(rawText: string): CaptionCue[] {
  if (!rawText) return [];
  const normalized = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const blocks = normalized.split(/\n{2,}/);
  const cues: CaptionCue[] = [];

  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) continue;

    const timingIdx = lines.findIndex((l) => l.includes("-->"));
    if (timingIdx === -1) continue;

    const timingLine = lines[timingIdx]!;
    const [rawStart, rawEnd] = timingLine.split("-->");
    if (!rawStart || !rawEnd) continue;

    const start = parseSrtTimestamp(rawStart);
    const end = parseSrtTimestamp(rawEnd.split(/\s+/)[0] || rawEnd);
    if (start === null || end === null) continue;

    const text = cleanCaptionText(lines.slice(timingIdx + 1).join(" "));
    if (!text || text.length < 2) continue;

    cues.push({
      start: Math.max(0, Number(start.toFixed(2))),
      end: Math.max(start + 0.5, Number(end.toFixed(2))),
      text,
    });
  }

  return cues;
}

/**
 * Scores a verified context sentence candidate for educational value, natural usage,
 * sentence completeness, clarity, and relevance to the target vocabulary word.
 */
export function scoreContextCandidate(params: {
  sentence: string;
  targetWord: string;
  matchedForm: string;
  videoTitle?: string;
  durationSec?: number;
}): number {
  const { sentence, targetWord, matchedForm, videoTitle = "", durationSec } = params;
  let score = 50;

  const words = sentence.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const charLen = sentence.length;

  // Ideal natural spoken sentence length: 7–24 words
  if (wordCount >= 7 && wordCount <= 24) score += 22;
  else if (wordCount >= 5 && wordCount <= 32) score += 12;
  else if (wordCount < 4) score -= 28;
  else score -= 8;

  if (charLen >= 35 && charLen <= 190) score += 10;
  else if (charLen < 20) score -= 20;

  // Exact form bonus (while still welcoming valid grammatical inflections)
  if (matchedForm.toLowerCase() === targetWord.trim().toLowerCase()) {
    score += 10;
  } else {
    score += 4;
  }

  // Clean sentence boundaries & punctuation
  if (/^[A-Z"“]/.test(sentence)) score += 6;
  if (/[.!?]["”]?$/.test(sentence)) score += 8;

  // Penalize noisy lyrics, all-caps shouting, or heavy non-English/symbol clutter
  if (/[♪♫]/.test(sentence)) score -= 40;
  const upperRatio =
    (sentence.match(/[A-Z]/g)?.length || 0) / Math.max(1, sentence.match(/[A-Za-z]/g)?.length || 1);
  if (upperRatio > 0.65 && charLen > 12) score -= 18;

  // Educational & clear spoken-English content boost
  const titleLower = videoTitle.toLowerCase();
  if (
    /\b(ted|lecture|interview|podcast|talk|documentary|science|history|voa|news|university|wikimedia|explain|education|speech|english)\b/.test(
      titleLower,
    )
  ) {
    score += 12;
  }

  // Prefer accessible clip durations (15s to 30m) for snappy range-request loading
  if (typeof durationSec === "number" && durationSec > 0) {
    if (durationSec >= 15 && durationSec <= 1800) score += 8;
    else if (durationSec > 3600) score -= 8;
  }

  return score;
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
 * Evaluates ALL verified occurrences of the target vocabulary word in timestamped caption cues,
 * builds complete surrounding context sentences, ranks every candidate, and returns the BEST
 * educational example with a ±20s synchronized cue window.
 * Never fabricates captions or timestamps.
 */
export function findVerifiedWordInCues(
  cues: CaptionCue[],
  targetWord: string,
  providerSource: "youtube_supadata" | "youtube_transcriptapi" | "wikimedia_commons",
  meta?: { videoTitle?: string; durationSec?: number },
): TranscriptMatchResult | null {
  let best: TranscriptMatchResult | null = null;

  for (let i = 0; i < cues.length; i += 1) {
    const cur = cues[i]!;
    const text = cleanCaptionText(cur.text);
    if (!text) continue;

    if (!maskWordInSentence(text, targetWord)) continue;

    // Expand cleanly across temporally contiguous adjacent cues (<= 3s gap) when a subtitle splits mid-sentence
    const prevCue = i > 0 ? cues[i - 1]! : null;
    const nextCue = i + 1 < cues.length ? cues[i + 1]! : null;
    const prev = prevCue && cur.start - prevCue.end <= 3 ? cleanCaptionText(prevCue.text) : "";
    const next = nextCue && nextCue.start - cur.end <= 3 ? cleanCaptionText(nextCue.text) : "";
    let combined = text;
    let leadCueStart = cur.start;

    if (prev && (text.length < 52 || !/^[A-Z"“]/.test(text)) && !/[.!?]$/.test(prev)) {
      combined = `${prev} ${combined}`;
      if (prevCue && cur.start - prevCue.start <= 6) {
        leadCueStart = prevCue.start;
      }
    }
    if (next && !/[.!?]$/.test(combined) && combined.length < 120) {
      combined = `${combined} ${next}`;
    }

    combined = combined.replace(/\s+/g, " ").trim().slice(0, 320);

    // If multiple sentences were joined, isolate the clean single sentence containing the target word
    const sentenceParts = combined.split(/(?<=[.!?])\s+/).filter(Boolean);
    const matchingPart = sentenceParts.find((part) => maskWordInSentence(part, targetWord));
    if (matchingPart && matchingPart.length >= 24) {
      combined = matchingPart.trim();
    }

    const masked = maskWordInSentence(combined, targetWord);
    if (!masked) continue;

    const score = scoreContextCandidate({
      sentence: combined,
      targetWord,
      matchedForm: masked.hiddenWord,
      videoTitle: meta?.videoTitle,
      durationSec: meta?.durationSec,
    });

    if (best && score <= best.qualityScore) continue;

    const cueStart = Math.max(0, Math.floor(leadCueStart));
    const clipStart = Math.max(0, cueStart - 1);

    const windowCues = cues
      .filter((c) => c.end >= Math.max(0, cueStart - 15) && c.start <= cueStart + 25)
      .slice(0, 24)
      .map((c) => ({
        start: Number(c.start.toFixed(2)),
        end: Number(c.end.toFixed(2)),
        text: cleanCaptionText(c.text),
      }))
      .filter((c) => c.text.length > 0);

    best = {
      timestampSeconds: clipStart,
      contextSentence: combined,
      verifiedTranscript: combined,
      targetWordPosition: masked.position,
      captionCues: windowCues,
      qualityScore: score,
      providerSource,
    };
  }

  return best;
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
    meta?: { videoTitle?: string },
  ): Promise<TranscriptMatchResult | null> {
    for (const provider of this.providers) {
      if (!provider.isConfigured()) continue;
      const cues = await provider.fetchTranscriptCues(videoId, lang);
      if (!cues || cues.length === 0) continue;
      const match = findVerifiedWordInCues(cues, targetWord, provider.source, meta);
      if (match) return match;
    }
    return null;
  }
}

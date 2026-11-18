import { maskWordInSentence, type MaskedSentence } from "./placeholder";
import type { CaptionCue } from "./video/types";

export type TimedCaptionToken = {
  id: string;
  text: string;
  isSpace: boolean;
  isTarget: boolean;
  start: number;
  end: number;
};

export type TimedCaptionLayout = {
  tokens: TimedCaptionToken[];
  sentenceStart: number;
  sentenceEnd: number;
};

export type WordSpeechState = "idle" | "upcoming" | "speaking" | "spoken";

function normalizeWord(w: string): string {
  return w.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function wordSpeechWeight(text: string): number {
  const letters = text.replace(/[^A-Za-z0-9]/g, "").length;
  return Math.max(2, letters) + 1.5;
}

function splitKeepingSpaces(text: string): Array<{ text: string; isSpace: boolean }> {
  if (!text) return [];
  return text
    .split(/(\s+)/)
    .filter((part) => part.length > 0)
    .map((part) => ({
      text: part,
      isSpace: /^\s+$/.test(part),
    }));
}

/**
 * Aligns every word in the displayed masked sentence (including the missing-word slot)
 * to the real timestamped SRT / transcript cues so each word highlights the instant
 * the speaker says it.
 */
export function buildTimedCaptionLayout(
  masked: MaskedSentence,
  captionCues?: CaptionCue[],
): TimedCaptionLayout | null {
  if (!captionCues || captionCues.length === 0) return null;

  // Build ordered display tokens (preserving spaces & exact hidden-word slot)
  const rawTokens: Array<{ text: string; isSpace: boolean; isTarget: boolean }> = [
    ...splitKeepingSpaces(masked.before).map((p) => ({ ...p, isTarget: false })),
    { text: masked.hiddenWord, isSpace: false, isTarget: true },
    ...splitKeepingSpaces(masked.after).map((p) => ({ ...p, isTarget: false })),
  ];

  const wordIndices: number[] = [];
  rawTokens.forEach((tok, idx) => {
    if (!tok.isSpace) wordIndices.push(idx);
  });
  if (wordIndices.length === 0) return null;

  // Locate the cue containing the target word
  const targetCueIdx = captionCues.findIndex((c) =>
    Boolean(maskWordInSentence(c.text, masked.hiddenWord)),
  );
  const anchorIdx = targetCueIdx >= 0 ? targetCueIdx : 0;

  // Check if adjacent cues (prev / next) also contribute words to the displayed sentence
  const sentenceWords = wordIndices
    .map((i) => normalizeWord(rawTokens[i]!.text))
    .filter(Boolean);

  const matchedCues: CaptionCue[] = [captionCues[anchorIdx]!];

  if (anchorIdx > 0) {
    const prevCue = captionCues[anchorIdx - 1]!;
    const prevWords = prevCue.text.split(/\s+/).map(normalizeWord).filter(Boolean);
    const tail = prevWords.slice(-2);
    if (
      tail.length > 0 &&
      captionCues[anchorIdx]!.start - prevCue.end <= 3.5 &&
      sentenceWords.slice(0, Math.min(sentenceWords.length, prevWords.length + 2)).includes(tail[tail.length - 1]!)
    ) {
      matchedCues.unshift(prevCue);
    }
  }

  if (anchorIdx + 1 < captionCues.length) {
    const nextCue = captionCues[anchorIdx + 1]!;
    const nextWords = nextCue.text.split(/\s+/).map(normalizeWord).filter(Boolean);
    const head = nextWords[0];
    if (
      head &&
      nextCue.start - captionCues[anchorIdx]!.end <= 3.5 &&
      sentenceWords.slice(-Math.min(sentenceWords.length, nextWords.length + 2)).includes(head)
    ) {
      matchedCues.push(nextCue);
    }
  }

  // Partition sentence word tokens across matchedCues proportionally to each cue's word count
  const cueBuckets: Array<{ cue: CaptionCue; indices: number[] }> = matchedCues.map((cue) => ({
    cue,
    indices: [],
  }));

  if (cueBuckets.length === 1) {
    cueBuckets[0]!.indices = [...wordIndices];
  } else {
    const cueWordCounts = matchedCues.map((c) =>
      Math.max(1, c.text.split(/\s+/).map(normalizeWord).filter(Boolean).length),
    );
    const totalCueWords = cueWordCounts.reduce((a, b) => a + b, 0);
    let cursor = 0;
    for (let b = 0; b < cueBuckets.length; b += 1) {
      const isLast = b === cueBuckets.length - 1;
      const share = isLast
        ? wordIndices.length - cursor
        : Math.max(1, Math.round((cueWordCounts[b]! / totalCueWords) * wordIndices.length));
      const endCursor = isLast ? wordIndices.length : Math.min(wordIndices.length, cursor + share);
      cueBuckets[b]!.indices = wordIndices.slice(cursor, endCursor);
      cursor = endCursor;
    }
  }

  // Assign character-length-weighted [start, end] timings inside each cue
  const timingByIndex = new Map<number, { start: number; end: number }>();

  for (const bucket of cueBuckets) {
    if (bucket.indices.length === 0) continue;
    const cueStart = Math.max(0, bucket.cue.start);
    const cueEnd = Math.max(cueStart + 0.4, bucket.cue.end);
    const cueDur = cueEnd - cueStart;

    const weights = bucket.indices.map((idx) => wordSpeechWeight(rawTokens[idx]!.text));
    const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;

    let t = cueStart;
    bucket.indices.forEach((tokIdx, pos) => {
      const sliceDur = (weights[pos]! / totalWeight) * cueDur;
      const nextT = pos === bucket.indices.length - 1 ? cueEnd : t + sliceDur;
      timingByIndex.set(tokIdx, { start: t, end: nextT });
      t = nextT;
    });
  }

  const sentenceStart = matchedCues[0]!.start;
  const sentenceEnd = matchedCues[matchedCues.length - 1]!.end;

  const tokens: TimedCaptionToken[] = rawTokens.map((tok, idx) => {
    const timing = timingByIndex.get(idx);
    return {
      id: `tok-${idx}`,
      text: tok.text,
      isSpace: tok.isSpace,
      isTarget: tok.isTarget,
      start: timing?.start ?? sentenceStart,
      end: timing?.end ?? sentenceEnd,
    };
  });

  return { tokens, sentenceStart, sentenceEnd };
}

/**
 * Determines the real-time highlight state of a single word token at `currentTimeSec`.
 */
export function getTokenSpeechState(
  token: TimedCaptionToken,
  currentTimeSec: number | undefined,
  sentenceStart: number,
): WordSpeechState {
  if (typeof currentTimeSec !== "number" || !Number.isFinite(currentTimeSec)) {
    return "idle";
  }
  // Before the speaker reaches this sentence, keep all words crisp and un-dimmed
  if (currentTimeSec < sentenceStart - 0.1) {
    return "idle";
  }
  if (currentTimeSec >= token.start && currentTimeSec < token.end) {
    return "speaking";
  }
  if (currentTimeSec >= token.end) {
    return "spoken";
  }
  return "upcoming";
}

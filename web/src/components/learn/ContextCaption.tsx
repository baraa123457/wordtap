"use client";

import { useMemo } from "react";
import { maskWordInSentence, type MaskedSentence } from "@/lib/placeholder";
import {
  buildTimedCaptionLayout,
  getTokenSpeechState,
  type WordSpeechState,
} from "@/lib/caption-sync";
import type { CaptionCue } from "@/lib/video/types";

function wordClassForState(state: WordSpeechState): string {
  switch (state) {
    case "speaking":
      return "rounded-md bg-subtitle/45 px-0.5 text-amber-700 dark:text-amber-300 font-bold transition-colors duration-75";
    case "spoken":
      return "text-amber-600 dark:text-amber-400 transition-colors duration-100";
    case "upcoming":
      return "text-ink/55 dark:text-ink/50 transition-colors duration-100";
    default:
      return "text-ink transition-colors duration-100";
  }
}

function targetBlankClassForState(state: WordSpeechState): string {
  switch (state) {
    case "speaking":
      return "inline-block rounded-lg border-b-2 border-amber-600 bg-subtitle px-2 py-0.5 font-mono font-extrabold tracking-[0.2em] text-ink ring-2 ring-amber-400/70 shadow-sm transition-all duration-75";
    case "spoken":
      return "inline-block rounded-lg border-b-2 border-amber-500 bg-amber-500/20 px-2 py-0.5 font-mono font-bold tracking-[0.2em] text-amber-800 dark:text-amber-200 transition-all duration-100";
    default:
      return "inline-block rounded-lg border-b-2 border-subtitle bg-subtitle/10 px-2 py-0.5 font-mono font-bold tracking-[0.2em] text-ink transition-all duration-100";
  }
}

function revealedTargetClassForState(state: WordSpeechState): string {
  if (state === "speaking") {
    return "rounded-lg bg-subtitle px-2 py-0.5 font-extrabold text-ink ring-2 ring-amber-500/70 shadow-sm transition-all duration-75";
  }
  return "rounded-lg bg-subtitle/40 px-2 py-0.5 font-extrabold text-ink transition-all duration-100";
}

export function ContextCaption({
  masked,
  targetWord,
  revealed,
  hint,
  captionCues,
  currentTimeSec,
  label,
}: {
  masked: MaskedSentence;
  targetWord: string;
  revealed: boolean;
  hint: string | null;
  captionCues?: CaptionCue[];
  currentTimeSec?: number;
  label: string;
}) {
  // Word-by-word karaoke timing layout synced to real SRT / transcript cues
  const timedLayout = useMemo(
    () => buildTimedCaptionLayout(masked, captionCues),
    [masked, captionCues],
  );

  // Synchronized surrounding cue indicator when playback moves outside the target sentence
  const syncedLiveCue = useMemo(() => {
    if (!captionCues || captionCues.length <= 1 || typeof currentTimeSec !== "number") {
      return null;
    }
    if (
      timedLayout &&
      currentTimeSec >= timedLayout.sentenceStart - 0.1 &&
      currentTimeSec <= timedLayout.sentenceEnd + 0.2
    ) {
      // Main sentence is actively highlighting word-by-word — no redundant bar needed
      return null;
    }
    const active = captionCues.find(
      (c) => currentTimeSec >= c.start - 0.2 && currentTimeSec <= c.end + 0.3,
    );
    if (!active) return null;
    if (revealed) return active.text;

    const maskedCue = maskWordInSentence(active.text, targetWord);
    if (!maskedCue) return active.text;
    return `${maskedCue.before}${maskedCue.placeholder}${maskedCue.after}`;
  }, [captionCues, currentTimeSec, revealed, targetWord, timedLayout]);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-muted">{label}</span>
        <span
          data-testid="stage2-letter-count"
          className="rounded-full bg-black/5 dark:bg-white/10 px-2.5 py-0.5 text-[11px] font-bold text-muted tabular-nums"
        >
          {masked.letterCount} {masked.letterCount === 1 ? "letter" : "letters"}
        </span>
      </div>

      {/* Custom WordTap Caption Display with real-time word-by-word speaker highlighting */}
      <blockquote
        data-testid="stage2-caption-quote"
        className="text-base sm:text-xl font-medium leading-relaxed text-ink"
      >
        &ldquo;
        {timedLayout ? (
          timedLayout.tokens.map((tok) => {
            if (tok.isSpace) return <span key={tok.id}>{tok.text}</span>;

            const speechState = getTokenSpeechState(
              tok,
              currentTimeSec,
              timedLayout.sentenceStart,
            );

            if (tok.isTarget) {
              return revealed ? (
                <mark
                  key={tok.id}
                  data-speech-state={speechState}
                  className={revealedTargetClassForState(speechState)}
                >
                  {masked.hiddenWord}
                </mark>
              ) : (
                <span
                  key={tok.id}
                  data-testid="stage2-missing-placeholder"
                  data-speech-state={speechState}
                  aria-label={`${masked.letterCount} missing letters`}
                  className={targetBlankClassForState(speechState)}
                >
                  {hint || masked.placeholder}
                </span>
              );
            }

            return (
              <span
                key={tok.id}
                data-speech-state={speechState}
                className={wordClassForState(speechState)}
              >
                {tok.text}
              </span>
            );
          })
        ) : (
          <>
            {masked.before}
            {revealed ? (
              <mark className="rounded-lg bg-subtitle/40 px-2 py-0.5 font-extrabold text-ink">
                {masked.hiddenWord}
              </mark>
            ) : (
              <span
                data-testid="stage2-missing-placeholder"
                aria-label={`${masked.letterCount} missing letters`}
                className="inline-block rounded-lg border-b-2 border-subtitle bg-subtitle/10 px-2 py-0.5 font-mono font-bold tracking-[0.2em] text-ink"
              >
                {hint || masked.placeholder}
              </span>
            )}
            {masked.after}
          </>
        )}
        &rdquo;
      </blockquote>

      {/* Live synchronized surrounding caption cue when speaker is before/after the target sentence */}
      {syncedLiveCue ? (
        <p
          aria-live="polite"
          className="rounded-xl bg-black/[0.03] dark:bg-white/[0.04] px-3 py-1.5 text-xs text-muted"
        >
          <span className="font-semibold text-ink/70 mr-1.5">Now speaking:</span>
          <span>&ldquo;{syncedLiveCue}&rdquo;</span>
        </p>
      ) : null}
    </div>
  );
}

"use client";

import { useMemo } from "react";
import { maskWordInSentence, type MaskedSentence } from "@/lib/placeholder";
import type { CaptionCue } from "@/lib/video/types";

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
  // Synchronized live caption cue during video playback (never spoils target word before solve!)
  const syncedLiveCue = useMemo(() => {
    if (!captionCues || captionCues.length <= 1 || typeof currentTimeSec !== "number") {
      return null;
    }
    const active = captionCues.find(
      (c) => currentTimeSec >= c.start - 0.3 && currentTimeSec <= c.end + 0.5,
    );
    if (!active) return null;
    if (revealed) return active.text;

    const maskedCue = maskWordInSentence(active.text, targetWord);
    if (!maskedCue) return active.text;
    return `${maskedCue.before}${maskedCue.placeholder}${maskedCue.after}`;
  }, [captionCues, currentTimeSec, revealed, targetWord]);

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

      {/* Custom WordTap Caption Display (1 dot = 1 exact missing letter) */}
      <blockquote
        data-testid="stage2-caption-quote"
        className="text-base sm:text-xl font-medium leading-relaxed text-ink"
      >
        &ldquo;
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
        &rdquo;
      </blockquote>

      {/* Live synchronized caption cue bar when timestamped cues exist */}
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

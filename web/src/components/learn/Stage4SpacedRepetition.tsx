"use client";

import { useEffect, useMemo } from "react";
import type { Word } from "@/lib/schemas";
import {
  cardStateFromWord,
  previewFsrsIntervals,
  type FsrsRating,
  type FsrsScheduleResult,
} from "@/lib/fsrs";

const RATING_META: Array<{
  rating: FsrsRating;
  label: string;
  sub: string;
  accent: string;
}> = [
  {
    rating: 1,
    label: "Again",
    sub: "Forgot it",
    accent: "hover:border-bad hover:bg-bad-soft/70",
  },
  {
    rating: 2,
    label: "Hard",
    sub: "Took effort",
    accent: "hover:border-amber-500 hover:bg-amber-500/10",
  },
  {
    rating: 3,
    label: "Good",
    sub: "Remembered",
    accent: "border-subtitle/60 bg-subtitle/10 hover:border-subtitle hover:bg-subtitle/20",
  },
  {
    rating: 4,
    label: "Easy",
    sub: "Effortless",
    accent: "hover:border-ok hover:bg-ok/10",
  },
];

export function Stage4SpacedRepetition({
  word,
  definition,
  userSentence,
  saving,
  onRate,
}: {
  word: Word;
  definition?: string;
  userSentence?: string;
  saving?: boolean;
  onRate: (rating: FsrsRating, schedule: FsrsScheduleResult) => void;
}) {
  const card = useMemo(() => cardStateFromWord(word), [word]);
  const previews = useMemo(() => previewFsrsIntervals(card), [card]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (saving) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "1") onRate(1, previews[1].result);
      else if (e.key === "2") onRate(2, previews[2].result);
      else if (e.key === "3") onRate(3, previews[3].result);
      else if (e.key === "4") onRate(4, previews[4].result);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onRate, previews, saving]);

  return (
    <section aria-labelledby="stage4-heading" className="apple-card p-5 sm:p-8 grid gap-6 min-w-0">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-subtitle/20 border border-subtitle/30 px-3 py-0.5 text-xs font-bold text-ink">
            Stage 4 · Spaced Repetition (FSRS)
          </span>
          <span className="rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs font-semibold capitalize text-muted">
            Status: {card.status}
          </span>
        </div>

        <h2 id="stage4-heading" className="text-xl sm:text-2xl font-extrabold text-ink">
          How well do you know &ldquo;{word.text}&rdquo; now?
        </h2>
        <p className="text-xs sm:text-sm text-muted">
          Your rating adapts the FSRS memory schedule so tricky words return sooner and strong words space out longer.
        </p>
      </div>

      {/* Quick Recap Box */}
      <div className="rounded-2xl border border-line bg-black/[0.02] dark:bg-white/[0.03] p-4 grid gap-2 text-sm min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-2 min-w-0">
          <span className="text-lg font-extrabold text-ink break-words">{word.text}</span>
          {word.translation ? (
            <span dir="auto" className="text-sm font-semibold text-muted break-words">
              {word.translation}
            </span>
          ) : null}
        </div>
        {definition || word.definition ? (
          <p className="text-xs sm:text-sm text-muted leading-relaxed break-words">
            {definition || word.definition}
          </p>
        ) : null}
        {userSentence ? (
          <p className="text-xs sm:text-sm text-ink border-t border-line/60 pt-2 italic break-words">
            Your sentence: &ldquo;{userSentence}&rdquo;
          </p>
        ) : null}
      </div>

      {/* 4 Adaptive FSRS Rating Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        {RATING_META.map((item) => {
          const prev = previews[item.rating];
          return (
            <button
              key={item.rating}
              type="button"
              disabled={saving}
              onClick={() => onRate(item.rating, prev.result)}
              className={`flex flex-col items-center justify-center gap-1 rounded-2xl border border-line bg-surface p-3.5 sm:p-4 text-center transition-all active:scale-95 cursor-pointer disabled:opacity-50 ${item.accent}`}
            >
              <span className="text-sm sm:text-base font-extrabold text-ink">{item.label}</span>
              <span className="text-xs font-bold text-ink/80 tabular-nums">{prev.label}</span>
              <span className="text-[11px] text-muted">{item.sub}</span>
            </button>
          );
        })}
      </div>

      <p className="text-center text-[11px] text-muted">
        Keyboard shortcuts: press <kbd className="rounded border border-line px-1.5 py-0.5 font-mono">1</kbd>–
        <kbd className="rounded border border-line px-1.5 py-0.5 font-mono">4</kbd> to rate
      </p>
    </section>
  );
}

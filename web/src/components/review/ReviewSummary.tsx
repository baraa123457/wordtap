"use client";

import { useState } from "react";
import Link from "next/link";
import type { NextReviewSchedule } from "@/lib/review-scheduler";
import type { Word } from "@/lib/schemas";

export type ReviewedWordSummary = {
  word: Word;
  schedule: NextReviewSchedule;
};

function formatNextDueLabel(intervalDays: number): string {
  if (intervalDays <= 0) return "Soon (10m)";
  if (intervalDays === 1) return "In 1 day";
  return `In ${intervalDays} days`;
}

export function ReviewSummary({
  items,
  xpEarned,
  saving,
  saveError,
  onRetrySave,
  onReviewMore,
  onPracticeHard,
}: {
  items: ReviewedWordSummary[];
  xpEarned: number;
  saving: boolean;
  saveError: string | null;
  onRetrySave: () => void;
  onReviewMore: () => void;
  onPracticeHard?: (hardWords: Word[]) => void;
}) {
  const rightCount = items.filter((i) => i.schedule.passedAllRounds).length;
  const hardest = items.filter((i) => !i.schedule.passedAllRounds);
  const [selectedHardIds, setSelectedHardIds] = useState<Set<string>>(
    () => new Set(hardest.map((h) => h.word.id)),
  );

  const toggleHardWord = (wordId: string) => {
    setSelectedHardIds((prev) => {
      const next = new Set(prev);
      if (next.has(wordId)) next.delete(wordId);
      else next.add(wordId);
      return next;
    });
  };

  const selectedHardWords = items
    .filter((i) => selectedHardIds.has(i.word.id))
    .map((i) => i.word);

  return (
    <section className="apple-card p-6 sm:p-8 grid gap-6 min-w-0">
      <div className="text-center space-y-2">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 border border-emerald-500/35 text-2xl font-bold text-emerald-700 dark:text-emerald-400">
          ✓
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-ink">Review complete!</h1>
        <p className="text-sm text-muted">
          You got <strong className="text-ink">{rightCount}</strong> of{" "}
          <strong className="text-ink">{items.length}</strong> words completely right across all
          rounds and earned <strong className="text-ink">{xpEarned} XP</strong>.
        </p>
      </div>

      {saveError ? (
        <div
          role="alert"
          className="rounded-2xl border border-bad/30 bg-bad-soft p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <p className="text-xs sm:text-sm font-medium text-bad-ink">
            Could not save results: {saveError}
          </p>
          <button
            type="button"
            disabled={saving}
            onClick={onRetrySave}
            className="btn btn-primary min-h-10 px-4 text-xs font-bold cursor-pointer shrink-0"
          >
            {saving ? "Retrying…" : "Retry save"}
          </button>
        </div>
      ) : null}

      {hardest.length > 0 || (onPracticeHard && items.length > 0) ? (
        <div className="rounded-2xl border border-line bg-black/[0.02] dark:bg-white/[0.03] p-4 grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted">
                {hardest.length > 0 ? "Hardest words to revisit soon" : "Practice in Hard Mode"}
              </p>
              {onPracticeHard ? (
                <p className="text-[11px] text-muted mt-0.5">
                  Toggle words below to add or remove them from Hard Mode.
                </p>
              ) : null}
            </div>
            {onPracticeHard ? (
              <button
                type="button"
                disabled={selectedHardWords.length === 0}
                onClick={() => onPracticeHard(selectedHardWords)}
                className="btn btn-primary min-h-10 px-4 text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                Practice {selectedHardWords.length} in Hard Mode →
              </button>
            ) : null}
          </div>
          {(onPracticeHard ? selectedHardWords.length > 0 : hardest.length > 0) ? (
            <div className="flex flex-wrap gap-2">
              {onPracticeHard
                ? selectedHardWords.map((w) => {
                    const isMissed = hardest.some((h) => h.word.id === w.id);
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => toggleHardWord(w.id)}
                        className={`rounded-full border px-3 py-1 text-xs font-bold cursor-pointer transition-colors ${
                          isMissed
                            ? "border-bad/30 bg-bad-soft text-bad-ink"
                            : "border-subtitle/40 bg-subtitle/15 text-amber-900 dark:text-subtitle"
                        }`}
                        title="Click to remove from Hard Mode"
                      >
                        {w.text} ×
                      </button>
                    );
                  })
                : hardest.map((h) => (
                    <span
                      key={h.word.id}
                      className="rounded-full border border-bad/30 bg-bad-soft px-3 py-1 text-xs font-bold text-bad-ink"
                    >
                      {h.word.text}
                    </span>
                  ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <ul className="divide-y divide-line/60 rounded-2xl border border-line bg-surface overflow-hidden">
        {items.map(({ word, schedule }) => {
          const isSelectedHard = selectedHardIds.has(word.id);
          return (
            <li
              key={word.id}
              className="flex flex-wrap items-center justify-between gap-2 p-3.5 text-sm"
            >
              <div className="min-w-0 flex flex-wrap items-center gap-2.5">
                {onPracticeHard ? (
                  <input
                    type="checkbox"
                    checked={isSelectedHard}
                    onChange={() => toggleHardWord(word.id)}
                    aria-label={`Include ${word.text} in Hard Mode`}
                    className="accent-subtitle h-4 w-4 cursor-pointer shrink-0"
                  />
                ) : null}
                <div className="min-w-0 flex flex-wrap items-baseline gap-2">
                  <span className="font-bold text-ink">{word.text}</span>
                  <span dir="auto" className="text-xs text-muted">
                    {word.translation}
                  </span>
                </div>
              </div>
              <span
                className={`text-xs font-bold tabular-nums shrink-0 ${
                  schedule.passedAllRounds
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-bad-ink"
                }`}
              >
                Box {schedule.review_box} · {formatNextDueLabel(schedule.intervalDays)}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          type="button"
          onClick={onReviewMore}
          className="btn btn-primary w-full sm:w-auto min-h-11 px-6 font-bold cursor-pointer"
        >
          Review more
        </button>
        <Link
          href="/dashboard"
          className="btn w-full sm:w-auto min-h-11 px-6 font-semibold justify-center"
        >
          Dashboard
        </Link>
      </div>
    </section>
  );
}

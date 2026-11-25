"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  batchUpdateReviewResults,
  recordPractice,
  type ReviewBatchUpdate,
} from "@/lib/api";
import { localDateString } from "@/lib/dates";
import {
  getNextReview,
  pickReviewSessionWords,
  type RoundResults,
} from "@/lib/review-scheduler";
import type { Word } from "@/lib/schemas";
import { CloseIcon } from "@/components/Icons";
import { MultipleChoiceRound } from "./MultipleChoiceRound";
import { MatchingRound } from "./MatchingRound";
import { TypingRound } from "./TypingRound";
import { ReviewSummary, type ReviewedWordSummary } from "./ReviewSummary";

type RoundStep = "choice" | "matching" | "typing" | "summary";

export function ReviewSession({
  words,
  sessionSize = 10,
  onReload,
}: {
  words: Word[];
  sessionSize?: number;
  onReload: () => void;
}) {
  const router = useRouter();
  const sessionWords = useMemo(
    () => pickReviewSessionWords(words, sessionSize),
    [words, sessionSize],
  );

  const [round, setRound] = useState<RoundStep>("choice");
  const [round1, setRound1] = useState<Record<string, boolean>>({});
  const [round2, setRound2] = useState<Record<string, boolean>>({});
  const [round3, setRound3] = useState<Record<string, boolean>>({});
  const [allowSimpleTypos, setAllowSimpleTypos] = useState(false);

  const [summaryItems, setSummaryItems] = useState<ReviewedWordSummary[]>([]);
  const [pendingUpdates, setPendingUpdates] = useState<ReviewBatchUpdate[]>([]);
  const [xpEarned, setXpEarned] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const persistBatch = useCallback(async (updates: ReviewBatchUpdate[], xp: number) => {
    setSaving(true);
    setSaveError(null);
    try {
      await batchUpdateReviewResults(updates);
      if (xp > 0) {
        void recordPractice(xp, localDateString()).catch(() => {});
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save review progress.");
    } finally {
      setSaving(false);
    }
  }, []);

  const finalizeSession = useCallback(
    (
      r1: Record<string, boolean>,
      r2: Record<string, boolean>,
      r3: Record<string, boolean>,
      earlyOnly: boolean,
    ) => {
      const now = new Date();
      const reviewed = sessionWords.filter(
        (w) => !earlyOnly || w.id in r1 || w.id in r2 || w.id in r3,
      );
      const targets = reviewed.length > 0 ? reviewed : sessionWords.slice(0, 1);

      const summaries: ReviewedWordSummary[] = [];
      const updates: ReviewBatchUpdate[] = [];
      let xp = 0;

      for (const word of targets) {
        const res: RoundResults = {
          round1Correct: r1[word.id] ?? true,
          round2Correct: r2[word.id] ?? true,
          round3Correct: r3[word.id] ?? true,
        };
        const schedule = getNextReview(word, res, now);
        summaries.push({ word, schedule });
        updates.push({
          word,
          review_box: schedule.review_box,
          next_review_at: schedule.next_review_at,
          correct_streak: schedule.correct_streak,
          last_reviewed_at: schedule.last_reviewed_at,
          lapses: schedule.lapses,
          passed: schedule.passedAllRounds,
        });
        xp += schedule.passedAllRounds ? 15 : 5;
      }

      setSummaryItems(summaries);
      setPendingUpdates(updates);
      setXpEarned(xp);
      setRound("summary");
      void persistBatch(updates, xp);
    },
    [sessionWords, persistBatch],
  );

  if (sessionWords.length === 0) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-4 py-12 pt-safe pb-safe">
        <div className="apple-card p-6 sm:p-8 text-center grid gap-4">
          <h1 className="text-xl sm:text-2xl font-extrabold text-ink">
            No words ready for Review yet
          </h1>
          <p className="text-xs sm:text-sm text-muted leading-relaxed">
            Practice words in Sequential Learning or mark words you already know as{" "}
            <strong>Easy</strong> to review them here.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-1">
            <Link
              href="/practice"
              className="btn btn-primary w-full sm:w-auto min-h-11 px-6 font-bold justify-center"
            >
              Start Practice →
            </Link>
            <Link
              href="/dashboard"
              className="btn w-full sm:w-auto min-h-11 px-5 font-semibold justify-center"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const progressPct =
    round === "choice" ? 15 : round === "matching" ? 50 : round === "typing" ? 80 : 100;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-3.5 sm:px-5 pt-safe pb-12">
      <header className="flex items-center gap-2.5 sm:gap-4 py-3.5 sm:py-5">
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          aria-label="Back to dashboard"
          className="btn btn-quiet w-11 h-11 min-h-11 p-0 flex items-center justify-center rounded-full text-muted hover:text-ink cursor-pointer shrink-0"
        >
          <CloseIcon />
        </button>

        <div className="flex-1 grid gap-1.5 min-w-0">
          <div className="flex items-center justify-between gap-2 text-[11px] sm:text-xs font-semibold text-muted">
            <span className="truncate">
              Quick Review · <strong className="text-ink">{sessionWords.length} words</strong>
            </span>
            <span className="tabular-nums shrink-0">{xpEarned} XP</span>
          </div>
          <div
            role="progressbar"
            aria-label="Review session progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPct}
            className="h-2.5 w-full overflow-hidden rounded-full bg-line"
          >
            <div
              className="h-full rounded-full bg-emerald-500 transition-[width] duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {round !== "summary" ? (
          <button
            type="button"
            onClick={() => finalizeSession(round1, round2, round3, true)}
            className="btn btn-quiet min-h-10 px-3 py-1 text-xs font-semibold text-muted hover:text-ink rounded-full cursor-pointer shrink-0"
          >
            Finish early
          </button>
        ) : null}
      </header>

      <main className="flex-1 min-w-0">
        {round === "choice" ? (
          <MultipleChoiceRound
            words={sessionWords}
            allWords={words}
            onComplete={(r1) => {
              setRound1(r1);
              setRound(sessionWords.length >= 2 ? "matching" : "typing");
            }}
          />
        ) : round === "matching" ? (
          <MatchingRound
            words={sessionWords}
            onComplete={(r2) => {
              setRound2(r2);
              setRound("typing");
            }}
          />
        ) : round === "typing" ? (
          <TypingRound
            words={sessionWords}
            allowSimpleTypos={allowSimpleTypos}
            onToggleTypos={setAllowSimpleTypos}
            onComplete={(r3) => {
              setRound3(r3);
              finalizeSession(round1, round2, r3, false);
            }}
          />
        ) : (
          <ReviewSummary
            items={summaryItems}
            xpEarned={xpEarned}
            saving={saving}
            saveError={saveError}
            onRetrySave={() => void persistBatch(pendingUpdates, xpEarned)}
            onReviewMore={onReload}
          />
        )}
      </main>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { recordPractice } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { localDateString } from "@/lib/dates";
import { isDue } from "@/lib/format";
import {
  deriveWordLearningStatus,
  formatIntervalLabel,
  type FsrsRating,
  type FsrsScheduleResult,
} from "@/lib/fsrs";
import {
  persistLearningReview,
  type ExerciseType,
  type SentenceEvaluation,
} from "@/lib/learn-api";
import type { Word } from "@/lib/schemas";
import { CloseIcon } from "@/components/Icons";
import { Stage1Understanding } from "./Stage1Understanding";
import { Stage2ContextualVideo } from "./Stage2ContextualVideo";
import { Stage3CreateSentence } from "./Stage3CreateSentence";
import { Stage4SpacedRepetition } from "./Stage4SpacedRepetition";

export type LearningQueueItem = {
  word: Word;
  kind: "new" | "review";
  stages: Array<1 | 2 | 3 | 4>;
};

const STAGE_LABELS: Record<1 | 2 | 3 | 4, string> = {
  1: "Understanding",
  2: "Video Context",
  3: "Your Sentence",
  4: "Spaced Review",
};

/**
 * Builds a structured Daily Learning Session queue using strictly the 4 stages
 * (NO separate Active Recall stage):
 *  - New words: Stage 1 -> Stage 2 -> Stage 3 -> Stage 4
 *  - Review words (due): rotates an exercise from Stages 1–3 based on reps/attempts
 *    so learners avoid memorizing fixed questions, then Stage 4 FSRS rating.
 */
export function buildDailyLearningQueue(
  words: Word[],
  options: {
    newLimit?: number;
    reviewLimit?: number;
    focusWordId?: string | null;
    mode?: "daily" | "new" | "review" | "missed";
  } = {},
): LearningQueueItem[] {
  const now = new Date();
  const newLimit = Math.max(1, options.newLimit ?? 5);
  const reviewLimit = Math.max(1, options.reviewLimit ?? 20);

  if (options.focusWordId) {
    const target = words.find((w) => w.id === options.focusWordId);
    if (target) {
      const status = deriveWordLearningStatus(target);
      return [
        {
          word: target,
          kind: status === "new" ? "new" : "review",
          stages: [1, 2, 3, 4],
        },
      ];
    }
  }

  const newWords: Word[] = [];
  const dueReviews: Word[] = [];
  const otherReviews: Word[] = [];

  for (const w of words) {
    const status = deriveWordLearningStatus(w);
    if (status === "new") {
      newWords.push(w);
    } else if (isDue(w.next_review, now)) {
      dueReviews.push(w);
    } else {
      otherReviews.push(w);
    }
  }

  // Prioritize most-missed or most-overdue review words first
  dueReviews.sort((a, b) => {
    if (options.mode === "missed") {
      return (b.wrong_count || 0) - (a.wrong_count || 0);
    }
    return new Date(a.next_review).getTime() - new Date(b.next_review).getTime();
  });

  const pickReviewStage = (w: Word): 1 | 2 | 3 => {
    // Rotate across Stage 1 (Understanding), Stage 2 (YouGlish Video), Stage 3 (Create Sentence)
    const count = (w.attempts_count || 0) + (w.fsrs_reps || 0) + (w.correct_count || 0);
    const mod = count % 3;
    if (mod === 0) return 2; // Prioritize real video context first on reviews
    if (mod === 1) return 3; // Sentence production
    return 1; // Understanding check
  };

  const queue: LearningQueueItem[] = [];

  if (options.mode !== "new") {
    const chosenReviews = (dueReviews.length > 0 ? dueReviews : otherReviews).slice(0, reviewLimit);
    for (const w of chosenReviews) {
      queue.push({
        word: w,
        kind: "review",
        stages: [pickReviewStage(w), 4],
      });
    }
  }

  if (options.mode !== "review" && options.mode !== "missed") {
    for (const w of newWords.slice(0, newLimit)) {
      queue.push({
        word: w,
        kind: "new",
        stages: [1, 2, 3, 4],
      });
    }
  }

  // Fallback if user has words but none matched filter (e.g., all mastered & not due yet)
  if (queue.length === 0 && words.length > 0) {
    for (const w of words.slice(0, Math.min(5, words.length))) {
      queue.push({
        word: w,
        kind: "review",
        stages: [pickReviewStage(w), 4],
      });
    }
  }

  return queue;
}

export function InteractiveLearningSession({
  words,
  newLimit = 5,
  reviewLimit = 20,
  focusWordId = null,
  mode = "daily",
  onReload,
}: {
  words: Word[];
  newLimit?: number;
  reviewLimit?: number;
  focusWordId?: string | null;
  mode?: "daily" | "new" | "review" | "missed";
  onReload: () => void;
}) {
  const router = useRouter();
  const initialQueue = useMemo(
    () => buildDailyLearningQueue(words, { newLimit, reviewLimit, focusWordId, mode }),
    [words, newLimit, reviewLimit, focusWordId, mode],
  );

  const [queue] = useState<LearningQueueItem[]>(initialQueue);
  const [wordIdx, setWordIdx] = useState(0);
  const [stageIdx, setStageIdx] = useState(0);

  // Per-word accumulated artifacts across Stages 1 -> 2 -> 3 -> 4
  const [capturedDef, setCapturedDef] = useState("");
  const [capturedPron, setCapturedPron] = useState("");
  const [capturedPos, setCapturedPos] = useState("");
  const [capturedSentence, setCapturedSentence] = useState("");
  const [lastAnswerText, setLastAnswerText] = useState("");
  const [lastExerciseType, setLastExerciseType] = useState<ExerciseType>("understanding");
  const [wordPassedCleanly, setWordPassedCleanly] = useState(true);
  const [savingRating, setSavingRating] = useState(false);

  // Session summary telemetry
  const [xp, setXp] = useState(0);
  const [completedWords, setCompletedWords] = useState<
    Array<{ word: string; nextLabel: string; status: string; sentence?: string }>
  >([]);
  const [leaving, setLeaving] = useState(false);

  const currentItem = queue[wordIdx];
  const currentStage = currentItem?.stages[stageIdx];
  const isFinished = !currentItem;

  const awardXp = useCallback((amount: number) => {
    setXp((prev) => prev + amount);
    recordPractice(amount, localDateString()).catch(() => {});
  }, []);

  const advanceStage = useCallback(() => {
    if (!currentItem) return;
    if (stageIdx + 1 < currentItem.stages.length) {
      setStageIdx((s) => s + 1);
    }
  }, [currentItem, stageIdx]);

  const handleStage1Complete = (res: {
    passedFirstTry: boolean;
    selectedAnswer: string;
    definition: string;
    pronunciation: string;
    partOfSpeech: string;
  }) => {
    setCapturedDef(res.definition);
    setCapturedPron(res.pronunciation);
    setCapturedPos(res.partOfSpeech);
    setLastAnswerText(res.selectedAnswer);
    setLastExerciseType("understanding");
    if (!res.passedFirstTry) setWordPassedCleanly(false);
    awardXp(res.passedFirstTry ? 10 : 5);
    advanceStage();
  };

  const handleStage2Complete = (res: {
    passedFirstTry: boolean;
    typedAnswer: string;
    usedVideo: boolean;
  }) => {
    setLastAnswerText(res.typedAnswer);
    setLastExerciseType("contextual_video");
    if (!res.passedFirstTry) setWordPassedCleanly(false);
    awardXp(res.passedFirstTry ? 15 : 8);
    advanceStage();
  };

  const handleStage3Complete = (res: {
    sentence: string;
    evaluation: SentenceEvaluation;
  }) => {
    setCapturedSentence(res.sentence);
    setLastAnswerText(res.sentence);
    setLastExerciseType("create_sentence");
    if (!res.evaluation.isCorrect) setWordPassedCleanly(false);
    awardXp(res.evaluation.isCorrect ? 20 : 10);
    advanceStage();
  };

  const handleStage4Rate = async (rating: FsrsRating, schedule: FsrsScheduleResult) => {
    if (!currentItem || savingRating) return;
    setSavingRating(true);
    try {
      await persistLearningReview({
        wordId: currentItem.word.id,
        exerciseType: lastExerciseType,
        answer: lastAnswerText,
        result: rating > 1 && wordPassedCleanly,
        rating,
        completedStages: currentItem.stages,
        schedule,
        definition: capturedDef,
        pronunciation: capturedPron,
        partOfSpeech: capturedPos,
      });

      awardXp(5);
      setCompletedWords((prev) => [
        ...prev,
        {
          word: currentItem.word.text,
          nextLabel: formatIntervalLabel(schedule.intervalDays),
          status: schedule.learningStatus,
          sentence: capturedSentence || undefined,
        },
      ]);

      if (wordIdx + 1 >= queue.length) {
        void trackEvent("first_practice_completed", {
          xp: xp + 5,
          words: queue.length,
        });
      }

      // Move to next word and reset per-word state
      setWordIdx((i) => i + 1);
      setStageIdx(0);
      setCapturedDef("");
      setCapturedPron("");
      setCapturedPos("");
      setCapturedSentence("");
      setLastAnswerText("");
      setWordPassedCleanly(true);
    } catch (err) {
      console.error("Failed to save FSRS review:", err);
    } finally {
      setSavingRating(false);
    }
  };

  if (isFinished) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col justify-center px-4 py-10 pt-safe pb-safe">
        <div className="apple-card p-6 sm:p-8 grid gap-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-subtitle/25 border border-subtitle/40 text-3xl">
            🎉
          </div>
          <div className="space-y-1.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-ink">Session complete!</h1>
            <p className="text-sm text-muted">
              You completed {completedWords.length}{" "}
              {completedWords.length === 1 ? "word" : "words"} and earned{" "}
              <strong className="text-ink">{xp} XP</strong>.
            </p>
          </div>

          {completedWords.length > 0 ? (
            <ul className="divide-y divide-line/60 rounded-2xl border border-line bg-surface text-start overflow-hidden">
              {completedWords.map((item, idx) => (
                <li key={`${item.word}-${idx}`} className="p-3.5 grid gap-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-bold text-ink text-sm sm:text-base">{item.word}</span>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="rounded-full bg-black/5 dark:bg-white/10 px-2.5 py-0.5 capitalize text-muted font-semibold">
                        {item.status}
                      </span>
                      <span className="font-bold text-ink tabular-nums">Next: {item.nextLabel}</span>
                    </div>
                  </div>
                  {item.sentence ? (
                    <p className="text-xs text-muted italic truncate">&ldquo;{item.sentence}&rdquo;</p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={onReload}
              className="btn btn-primary w-full sm:w-auto min-h-11 px-6 font-bold cursor-pointer"
            >
              Start another session
            </button>
            <Link
              href="/dashboard"
              className="btn w-full sm:w-auto min-h-11 px-6 font-semibold justify-center"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const totalSteps = queue.reduce((sum, item) => sum + item.stages.length, 0);
  const completedSteps =
    queue.slice(0, wordIdx).reduce((sum, item) => sum + item.stages.length, 0) + stageIdx;
  const progressPct = totalSteps === 0 ? 0 : Math.round((completedSteps / totalSteps) * 100);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-3.5 sm:px-5 pt-safe pb-12">
      {/* Top Progress Bar */}
      <header className="flex items-center gap-3 sm:gap-4 py-3.5 sm:py-5">
        <button
          type="button"
          onClick={() => setLeaving(true)}
          aria-label="Leave learning session"
          className="btn btn-quiet w-10 h-10 min-h-10 p-0 flex items-center justify-center rounded-full text-muted hover:text-ink cursor-pointer shrink-0"
        >
          <CloseIcon />
        </button>

        <div className="flex-1 grid gap-1.5 min-w-0">
          <div className="flex items-center justify-between text-[11px] sm:text-xs font-semibold text-muted">
            <span className="truncate">
              Word {wordIdx + 1} of {queue.length} ·{" "}
              <span className="text-ink font-bold">
                {currentItem.kind === "new" ? "New Word" : "Spaced Review"}
              </span>
            </span>
            <span className="tabular-nums shrink-0">{xp} XP</span>
          </div>
          <div
            role="progressbar"
            aria-label="Learning session progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPct}
            className="h-2.5 w-full overflow-hidden rounded-full bg-line"
          >
            <div
              className="h-full rounded-full bg-subtitle transition-[width] duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </header>

      {/* 4-Stage Stepper Indicator */}
      <nav aria-label="Learning stages" className="mb-4 flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-0.5">
        {currentItem.stages.map((st, idx) => {
          const isCurrent = idx === stageIdx;
          const isDone = idx < stageIdx;
          return (
            <div
              key={st}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-all ${
                isCurrent
                  ? "border-subtitle bg-subtitle/20 text-ink font-bold"
                  : isDone
                  ? "border-ok/30 bg-ok/10 text-ok"
                  : "border-line bg-surface text-muted"
              }`}
            >
              <span className="font-mono text-[10px]">{isDone ? "✓" : st}</span>
              <span>{STAGE_LABELS[st]}</span>
            </div>
          );
        })}
      </nav>

      {/* Active Learning Stage (Strictly Stages 1, 2, 3, 4 — NO separate Active Recall stage) */}
      <main className="flex-1 min-w-0">
        {currentStage === 1 ? (
          <Stage1Understanding
            key={`s1-${currentItem.word.id}`}
            word={currentItem.word}
            onComplete={handleStage1Complete}
          />
        ) : currentStage === 2 ? (
          <Stage2ContextualVideo
            key={`s2-${currentItem.word.id}`}
            word={currentItem.word}
            onComplete={handleStage2Complete}
          />
        ) : currentStage === 3 ? (
          <Stage3CreateSentence
            key={`s3-${currentItem.word.id}`}
            word={currentItem.word}
            definition={capturedDef}
            partOfSpeech={capturedPos}
            onComplete={handleStage3Complete}
          />
        ) : (
          <Stage4SpacedRepetition
            key={`s4-${currentItem.word.id}`}
            word={currentItem.word}
            definition={capturedDef}
            userSentence={capturedSentence}
            saving={savingRating}
            onRate={(rating, schedule) => void handleStage4Rate(rating, schedule)}
          />
        )}
      </main>

      {/* Leave Confirmation Modal */}
      {leaving ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div
            role="alertdialog"
            aria-label="Leave learning session?"
            className="w-full max-w-sm grid gap-4 rounded-3xl border border-line bg-surface p-6 shadow-2xl"
          >
            <div>
              <h3 className="text-xl font-bold text-ink">Leave learning session?</h3>
              <p className="text-xs sm:text-sm text-muted mt-1">
                All completed words and XP so far are already saved to your account.
              </p>
            </div>
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => setLeaving(false)}
                className="btn btn-primary w-full font-bold cursor-pointer"
              >
                Keep learning
              </button>
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="btn btn-quiet w-full text-muted hover:text-bad font-medium cursor-pointer"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

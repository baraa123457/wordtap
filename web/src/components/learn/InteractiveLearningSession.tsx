"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { recordPractice } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { localDateString } from "@/lib/dates";
import {
  formatIntervalLabel,
  type FsrsRating,
  type FsrsScheduleResult,
} from "@/lib/fsrs";
import type { ExerciseType, SentenceEvaluation } from "@/lib/learn-api";
import {
  buildSpacedRepetitionQueue,
  createOrResumeInitialLearningSession,
  fetchActiveRemoteLearningSession,
  persistCompleteInitialWordRemote,
  persistSpacedReviewRemote,
  persistStageAdvanceRemote,
  transitionAdvanceStage,
  transitionCompleteWord,
  upsertRemoteLearningSession,
  type LearningSessionState,
  type LearningStage,
  type SpacedReviewQueueItem,
} from "@/lib/learning-session-manager";
import type { Word } from "@/lib/schemas";
import { CloseIcon } from "@/components/Icons";
import { Stage1Understanding } from "./Stage1Understanding";
import { Stage2ContextualVideo } from "./Stage2ContextualVideo";
import { Stage3CreateSentence } from "./Stage3CreateSentence";
import { Stage4SpacedRepetition } from "./Stage4SpacedRepetition";

const STAGE_LABELS: Record<LearningStage, string> = {
  1: "Understanding",
  2: "Video Context",
  3: "Your Sentence",
  4: "Schedule & Complete",
};

const ALL_INITIAL_STAGES: LearningStage[] = [1, 2, 3, 4];

/**
 * STRICT SEQUENTIAL INITIAL LEARNING SESSION
 * Driven entirely by the centralized deterministic state machine (`learning-session-manager.ts`).
 *
 * Enforces:
 *   WORD_1_STAGE_1 -> WORD_1_STAGE_2 -> WORD_1_STAGE_3 -> WORD_1_COMPLETED (Stage 4)
 *   -> WORD_2_STAGE_1 -> WORD_2_STAGE_2 -> WORD_2_STAGE_3 -> WORD_2_COMPLETED ...
 *
 * Persists after EVERY stage transition so refreshing or reopening resumes at the exact word & stage.
 */
export function InteractiveLearningSession({
  words,
  newLimit = 10,
  reviewLimit = 20,
  focusWordId = null,
  langFilter = "all",
  mode = "learn",
  onReload,
}: {
  words: Word[];
  newLimit?: number;
  reviewLimit?: number;
  focusWordId?: string | null;
  langFilter?: string;
  mode?: "learn" | "review" | "missed";
  onReload: () => void;
}) {
  if (mode === "review" || mode === "missed") {
    return (
      <SpacedRepetitionReviewSession
        words={words}
        reviewLimit={reviewLimit}
        missedOnly={mode === "missed"}
        onReload={onReload}
      />
    );
  }

  return (
    <SequentialInitialLearningSession
      words={words}
      newLimit={newLimit}
      focusWordId={focusWordId}
      langFilter={langFilter}
      onReload={onReload}
    />
  );
}

function SequentialInitialLearningSession({
  words,
  newLimit,
  focusWordId,
  langFilter,
  onReload,
}: {
  words: Word[];
  newLimit: number;
  focusWordId: string | null;
  langFilter: string;
  onReload: () => void;
}) {
  const router = useRouter();
  const { state: authState } = useAuth();
  const userId = authState.status === "signed-in" ? authState.user.id : "demo";

  const wordsById = useMemo(() => new Map(words.map((w) => [w.id, w])), [words]);
  const [session, setSession] = useState<LearningSessionState | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [savingStage, setSavingStage] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [completedSummary, setCompletedSummary] = useState<
    Array<{ word: string; nextLabel: string; status: string; sentence?: string }>
  >([]);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const lockRef = useRef(false);

  // Initialize or restore exact persisted session on mount (checks Supabase + per-user localStorage)
  useEffect(() => {
    let active = true;
    setInitializing(true);
    setTransitionError(null);

    const init = async () => {
      const remote = focusWordId
        ? null
        : await fetchActiveRemoteLearningSession(userId, langFilter);

      if (!active) return;

      const resolved = createOrResumeInitialLearningSession({
        userId,
        words,
        langFilter,
        limit: newLimit,
        focusWordId,
        remoteActiveSession: remote,
      });

      setSession(resolved);
      setInitializing(false);

      // Persist newly created session header to Supabase (best-effort; local mirror already saved)
      if (!resolved.resumed && resolved.status === "in_progress") {
        void upsertRemoteLearningSession(resolved);
      }
    };

    void init();
    return () => {
      active = false;
    };
    // Only re-initialize when session identity inputs change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, langFilter, focusWordId]);

  const awardXp = useCallback((amount: number) => {
    if (amount > 0) {
      recordPractice(amount, localDateString()).catch(() => {});
    }
  }, []);

  if (initializing || !session) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center px-4 py-12">
        <div className="apple-card p-8 grid gap-4 animate-pulse">
          <div className="h-5 w-44 rounded bg-line/60" />
          <div className="h-10 w-64 rounded-xl bg-line/50" />
          <div className="h-32 w-full rounded-2xl bg-line/40" />
        </div>
      </div>
    );
  }

  // Empty state: all words in this language already completed Initial Learning!
  if (session.wordIds.length === 0) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-4 py-12 pt-safe pb-safe">
        <div className="apple-card p-6 sm:p-8 text-center grid gap-5">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-ok/15 border border-ok/30 text-2xl">
            ✓
          </div>
          <div className="space-y-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-ink">
              All saved words have completed initial learning!
            </h1>
            <p className="text-xs sm:text-sm text-muted leading-relaxed">
              Every word in your list has already passed Stages 1–4. Review them on schedule in your Spaced Repetition queue or save new words to learn next.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-1">
            <Link href="/practice?mode=review" className="btn btn-primary w-full sm:w-auto min-h-11 px-6 font-bold justify-center">
              Go to Spaced Review →
            </Link>
            <Link href="/dashboard" className="btn w-full sm:w-auto min-h-11 px-5 font-semibold justify-center">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Session completion summary
  if (session.status === "completed" || !session.currentWordId) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col justify-center px-4 py-10 pt-safe pb-safe">
        <div className="apple-card p-6 sm:p-8 grid gap-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-subtitle/25 border border-subtitle/40 text-3xl">
            🎉
          </div>
          <div className="space-y-1.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-ink">
              Learning session complete!
            </h1>
            <p className="text-sm text-muted">
              You sequentially completed {session.completedWordIds.length}{" "}
              {session.completedWordIds.length === 1 ? "word" : "words"} through all 4 stages and earned{" "}
              <strong className="text-ink">{session.xpEarned} XP</strong>.
            </p>
          </div>

          {completedSummary.length > 0 ? (
            <ul className="divide-y divide-line/60 rounded-2xl border border-line bg-surface text-start overflow-hidden">
              {completedSummary.map((item, idx) => (
                <li key={`${item.word}-${idx}`} className="p-3.5 grid gap-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-bold text-ink text-sm sm:text-base">{item.word}</span>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="rounded-full bg-black/5 dark:bg-white/10 px-2.5 py-0.5 capitalize text-muted font-semibold">
                        {item.status}
                      </span>
                      <span className="font-bold text-ink tabular-nums">Next review: {item.nextLabel}</span>
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
              Learn next batch of words
            </button>
            <Link
              href="/practice?mode=review"
              className="btn w-full sm:w-auto min-h-11 px-6 font-semibold justify-center"
            >
              Spaced Review Queue
            </Link>
            <Link
              href="/dashboard"
              className="btn btn-quiet w-full sm:w-auto min-h-11 px-5 font-semibold justify-center"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const activeWord = wordsById.get(session.currentWordId);
  if (!activeWord) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <button type="button" onClick={onReload} className="btn btn-primary px-6">
          Reload learning session
        </button>
      </div>
    );
  }

  const activeProgress = session.wordProgress[activeWord.id];
  const currentStage = session.currentStage;

  const handleStageAdvance = async (
    completedStage: 1 | 2 | 3,
    answer: string,
    passed: boolean,
    xpDelta: number,
    payload?: {
      definition?: string;
      pronunciation?: string;
      partOfSpeech?: string;
      userSentence?: string;
      usedVideo?: boolean;
      stageAttempts?: number;
    },
  ) => {
    if (lockRef.current) return;
    lockRef.current = true;
    setSavingStage(true);
    setTransitionError(null);
    try {
      const next = transitionAdvanceStage(session, {
        wordId: activeWord.id,
        completedStage,
        answer,
        passed,
        payload,
        xpDelta,
      });
      setSession(next);
      awardXp(xpDelta);
      await persistStageAdvanceRemote({
        sessionId: next.sessionId,
        wordId: activeWord.id,
        completedStage,
        answer,
        passed,
        payload,
        xpDelta,
      });
    } catch (err) {
      setTransitionError(err instanceof Error ? err.message : "Could not save stage progress.");
    } finally {
      setSavingStage(false);
      lockRef.current = false;
    }
  };

  const handleStage4CompleteWord = async (rating: FsrsRating, schedule: FsrsScheduleResult) => {
    if (lockRef.current) return;
    lockRef.current = true;
    setSavingStage(true);
    setTransitionError(null);
    try {
      const xpDelta = 5;
      const next = transitionCompleteWord(session, {
        wordId: activeWord.id,
        xpDelta,
      });
      await persistCompleteInitialWordRemote({
        sessionId: session.sessionId,
        wordId: activeWord.id,
        rating,
        schedule,
        xpDelta,
      });

      awardXp(xpDelta);
      setCompletedSummary((prev) => [
        ...prev,
        {
          word: activeWord.text,
          nextLabel: formatIntervalLabel(schedule.intervalDays),
          status: schedule.learningStatus,
          sentence: activeProgress?.userSentence || undefined,
        },
      ]);

      if (next.status === "completed") {
        void trackEvent("first_practice_completed", {
          xp: next.xpEarned,
          words: next.completedWordIds.length,
        });
      }

      setSession(next);
    } catch (err) {
      setTransitionError(err instanceof Error ? err.message : "Could not complete word.");
    } finally {
      setSavingStage(false);
      lockRef.current = false;
    }
  };

  const totalSteps = session.wordIds.length * 4;
  const completedSteps = session.completedWordIds.length * 4 + (currentStage - 1);
  const progressPct = totalSteps === 0 ? 0 : Math.round((completedSteps / totalSteps) * 100);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-3.5 sm:px-5 pt-safe pb-12">
      {/* Top Progress Header */}
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
              Word {session.currentWordIndex + 1} of {session.wordIds.length} ·{" "}
              <span className="text-ink font-bold">Sequential Learning</span>
            </span>
            <span className="tabular-nums shrink-0">{session.xpEarned} XP</span>
          </div>
          <div
            role="progressbar"
            aria-label="Sequential learning progress"
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

      {/* Resumed Progress Indicator */}
      {session.resumed ? (
        <div className="mb-3 rounded-xl border border-subtitle/40 bg-subtitle/10 px-3.5 py-2 text-xs font-medium text-ink flex items-center justify-between gap-2">
          <span>
            Resumed where you left off:{" "}
            <strong>
              {currentStage === 2 ? `Word ${session.currentWordIndex + 1}` : activeWord.text}
            </strong>{" "}
            · Stage {currentStage} ({STAGE_LABELS[currentStage]})
          </span>
        </div>
      ) : null}

      {transitionError ? (
        <div role="alert" className="mb-3 rounded-xl border border-bad/30 bg-bad-soft px-3.5 py-2.5 text-xs font-semibold text-bad">
          {transitionError}
        </div>
      ) : null}

      {/* Strict 4-Stage Sequential Stepper */}
      <nav aria-label="Learning stages" className="mb-4 flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-0.5">
        {ALL_INITIAL_STAGES.map((st) => {
          const isCurrent = st === currentStage;
          const isDone = activeProgress?.completedStages.includes(st) || st < currentStage;
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

      {/* Deterministic Active Stage (1 -> 2 -> 3 -> 4 strictly in order) */}
      <main className="flex-1 min-w-0">
        {currentStage === 1 ? (
          <Stage1Understanding
            key={`seq-s1-${activeWord.id}`}
            word={activeWord}
            onComplete={(res) =>
              void handleStageAdvance(
                1,
                res.selectedAnswer,
                res.passedFirstTry,
                res.passedFirstTry ? 10 : 5,
                {
                  definition: res.definition,
                  pronunciation: res.pronunciation,
                  partOfSpeech: res.partOfSpeech,
                },
              )
            }
          />
        ) : currentStage === 2 ? (
          <Stage2ContextualVideo
            key={`seq-s2-${activeWord.id}`}
            word={activeWord}
            onComplete={(res) =>
              void handleStageAdvance(
                2,
                res.typedAnswer,
                res.passedFirstTry,
                res.passedFirstTry ? 15 : 8,
                { usedVideo: res.usedVideo, stageAttempts: res.attempts },
              )
            }
          />
        ) : currentStage === 3 ? (
          <Stage3CreateSentence
            key={`seq-s3-${activeWord.id}`}
            word={activeWord}
            definition={activeProgress?.definition || activeWord.definition || ""}
            partOfSpeech={activeProgress?.partOfSpeech || activeWord.part_of_speech || ""}
            onComplete={(res: { sentence: string; evaluation: SentenceEvaluation }) =>
              void handleStageAdvance(
                3,
                res.sentence,
                res.evaluation.isCorrect,
                res.evaluation.isCorrect ? 20 : 10,
                { userSentence: res.sentence },
              )
            }
          />
        ) : (
          <Stage4SpacedRepetition
            key={`seq-s4-${activeWord.id}`}
            word={activeWord}
            definition={activeProgress?.definition || activeWord.definition || ""}
            userSentence={activeProgress?.userSentence || ""}
            saving={savingStage}
            onRate={(rating, schedule) => void handleStage4CompleteWord(rating, schedule)}
          />
        )}
      </main>

      {/* Leave Confirmation Modal */}
      {leaving ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div
            role="alertdialog"
            aria-label="Pause learning session?"
            className="w-full max-w-sm grid gap-4 rounded-3xl border border-line bg-surface p-6 shadow-2xl"
          >
            <div>
              <h3 className="text-xl font-bold text-ink">Pause learning session?</h3>
              <p className="text-xs sm:text-sm text-muted mt-1">
                Your exact word and stage (Stage {currentStage}) are saved automatically. You&apos;ll resume right here when you return.
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
                Save &amp; return to Dashboard
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * SEPARATE SPACED REPETITION REVIEW SESSION
 * Strictly isolated from Initial Learning!
 * - Only reviews words that have ALREADY completed initial learning.
 * - Never resets or modifies `initial_learning_completed`, `current_stage`, or `completed_stages`.
 */
function SpacedRepetitionReviewSession({
  words,
  reviewLimit,
  missedOnly,
  onReload,
}: {
  words: Word[];
  reviewLimit: number;
  missedOnly: boolean;
  onReload: () => void;
}) {
  const router = useRouter();
  const { state: authState } = useAuth();
  const userId = authState.status === "signed-in" ? authState.user.id : "demo";

  const queue: SpacedReviewQueueItem[] = useMemo(
    () => buildSpacedRepetitionQueue(words, { userId, limit: reviewLimit, missedOnly }),
    [words, userId, reviewLimit, missedOnly],
  );

  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"exercise" | "rate">("exercise");
  const [lastAnswer, setLastAnswer] = useState("");
  const [lastPassed, setLastPassed] = useState(true);
  const [lastSentence, setLastSentence] = useState("");
  const [saving, setSaving] = useState(false);
  const [xp, setXp] = useState(0);
  const [doneItems, setDoneItems] = useState<Array<{ word: string; nextLabel: string; status: string }>>([]);

  const current = queue[index];

  if (queue.length === 0) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-4 py-12 pt-safe pb-safe">
        <div className="apple-card p-6 sm:p-8 text-center grid gap-5">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-subtitle/20 border border-subtitle/30 text-2xl">
            📅
          </div>
          <div className="space-y-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-ink">
              No words ready for spaced review yet
            </h1>
            <p className="text-xs sm:text-sm text-muted leading-relaxed">
              Words enter the Spaced Repetition review queue automatically after you complete their 4-stage sequential learning session.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-1">
            <Link href="/practice?mode=learn" className="btn btn-primary w-full sm:w-auto min-h-11 px-6 font-bold justify-center">
              Start Sequential Learning →
            </Link>
            <Link href="/dashboard" className="btn w-full sm:w-auto min-h-11 px-5 font-semibold justify-center">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col justify-center px-4 py-10 pt-safe pb-safe">
        <div className="apple-card p-6 sm:p-8 grid gap-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-ok/15 border border-ok/30 text-3xl">
            ✓
          </div>
          <div className="space-y-1.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-ink">Spaced review complete!</h1>
            <p className="text-sm text-muted">
              You reviewed {doneItems.length} {doneItems.length === 1 ? "word" : "words"} and earned{" "}
              <strong className="text-ink">{xp} XP</strong>.
            </p>
          </div>
          <ul className="divide-y divide-line/60 rounded-2xl border border-line bg-surface text-start overflow-hidden">
            {doneItems.map((it, i) => (
              <li key={`${it.word}-${i}`} className="flex items-center justify-between gap-3 p-3.5 text-sm">
                <span className="font-bold text-ink">{it.word}</span>
                <span className="text-xs font-semibold text-muted tabular-nums">
                  {it.status} · Next: {it.nextLabel}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button type="button" onClick={onReload} className="btn btn-primary w-full sm:w-auto min-h-11 px-6 font-bold cursor-pointer">
              Review more
            </button>
            <Link href="/dashboard" className="btn w-full sm:w-auto min-h-11 px-6 font-semibold justify-center">
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const exStage = current.reviewExerciseStage;
  const exType: ExerciseType =
    exStage === 1 ? "understanding" : exStage === 2 ? "contextual_video" : "create_sentence";

  const handleRate = async (rating: FsrsRating, schedule: FsrsScheduleResult) => {
    if (saving) return;
    setSaving(true);
    try {
      await persistSpacedReviewRemote({
        wordId: current.word.id,
        exerciseType: exType,
        answer: lastAnswer,
        result: rating > 1 && lastPassed,
        rating,
        schedule,
      });
      const earned = rating > 1 ? 15 : 5;
      setXp((prev) => prev + earned);
      recordPractice(earned, localDateString()).catch(() => {});
      setDoneItems((prev) => [
        ...prev,
        {
          word: current.word.text,
          nextLabel: formatIntervalLabel(schedule.intervalDays),
          status: schedule.learningStatus,
        },
      ]);
      setIndex((i) => i + 1);
      setPhase("exercise");
      setLastAnswer("");
      setLastPassed(true);
      setLastSentence("");
    } finally {
      setSaving(false);
    }
  };

  const progressPct = Math.round((index / queue.length) * 100);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-3.5 sm:px-5 pt-safe pb-12">
      <header className="flex items-center gap-3 sm:gap-4 py-3.5 sm:py-5">
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          aria-label="Back to dashboard"
          className="btn btn-quiet w-10 h-10 min-h-10 p-0 flex items-center justify-center rounded-full text-muted hover:text-ink cursor-pointer shrink-0"
        >
          <CloseIcon />
        </button>
        <div className="flex-1 grid gap-1.5 min-w-0">
          <div className="flex items-center justify-between text-[11px] sm:text-xs font-semibold text-muted">
            <span>
              Review {index + 1} of {queue.length} · <strong className="text-ink">Spaced Repetition</strong>
            </span>
            <span className="tabular-nums">{xp} XP</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-ok transition-[width] duration-300" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      </header>

      <main className="flex-1 min-w-0">
        {phase === "exercise" ? (
          exStage === 1 ? (
            <Stage1Understanding
              key={`rev-s1-${current.word.id}`}
              word={current.word}
              onComplete={(res) => {
                setLastAnswer(res.selectedAnswer);
                setLastPassed(res.passedFirstTry);
                setPhase("rate");
              }}
            />
          ) : exStage === 2 ? (
            <Stage2ContextualVideo
              key={`rev-s2-${current.word.id}`}
              word={current.word}
              onComplete={(res) => {
                setLastAnswer(res.typedAnswer);
                setLastPassed(res.passedFirstTry);
                setPhase("rate");
              }}
            />
          ) : (
            <Stage3CreateSentence
              key={`rev-s3-${current.word.id}`}
              word={current.word}
              onComplete={(res) => {
                setLastAnswer(res.sentence);
                setLastSentence(res.sentence);
                setLastPassed(res.evaluation.isCorrect);
                setPhase("rate");
              }}
            />
          )
        ) : (
          <Stage4SpacedRepetition
            key={`rev-s4-${current.word.id}`}
            word={current.word}
            userSentence={lastSentence}
            saving={saving}
            onRate={(r, s) => void handleRate(r, s)}
          />
        )}
      </main>
    </div>
  );
}

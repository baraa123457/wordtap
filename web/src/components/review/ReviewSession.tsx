"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useEnterPrimaryAction } from "@/lib/use-enter-primary";
import {
  batchUpdateReviewResults,
  deleteWord,
  deleteWordByText,
  recordPractice,
  updateWordDetails,
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
import { DictationRound } from "./DictationRound";
import { TypingRound } from "./TypingRound";
import { ReviewSummary, type ReviewedWordSummary } from "./ReviewSummary";

type RoundStep = "choice" | "matching" | "dictation" | "typing" | "summary";

export function ReviewSession({
  words,
  allDeckWords,
  sessionSize = 10,
  ignoreEligibility = false,
  includeDictation = false,
  promptMode = "word",
  onClose,
  onPracticeHard,
  onReload,
}: {
  words: Word[];
  allDeckWords?: Word[];
  sessionSize?: number;
  ignoreEligibility?: boolean;
  includeDictation?: boolean;
  promptMode?: "word" | "translation";
  onClose?: () => void;
  onPracticeHard?: (hardWords: Word[]) => void;
  onReload: () => void;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  useEnterPrimaryAction(containerRef);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(() => new Set());
  const [wordOverrides, setWordOverrides] = useState<Record<string, Partial<Word>>>({});
  const [editTarget, setEditTarget] = useState<Word | null>(null);
  const [editText, setEditText] = useState("");
  const [editTranslation, setEditTranslation] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Word | null>(null);
  const [deletingWord, setDeletingWord] = useState(false);

  const initialPicked = useMemo(
    () =>
      ignoreEligibility
        ? words
            .filter((w) => w.text.trim() && w.translation.trim())
            .slice(0, Math.max(1, sessionSize))
        : pickReviewSessionWords(words, sessionSize),
    [words, sessionSize, ignoreEligibility],
  );
  const sessionWords = useMemo(
    () =>
      initialPicked
        .filter((w) => !deletedIds.has(w.id))
        .map((w) => (wordOverrides[w.id] ? { ...w, ...wordOverrides[w.id] } : w)),
    [initialPicked, deletedIds, wordOverrides],
  );

  const [round, setRound] = useState<RoundStep>("choice");
  const [round1, setRound1] = useState<Record<string, boolean>>({});
  const [round2, setRound2] = useState<Record<string, boolean>>({});
  const [roundDictation, setRoundDictation] = useState<Record<string, boolean>>({});
  const [round3, setRound3] = useState<Record<string, boolean>>({});
  const [allowSimpleTypos, setAllowSimpleTypos] = useState(false);

  const draftKey = useMemo(
    () =>
      sessionWords.length > 0
        ? `wordtap_review_draft_${sessionWords.map((w) => w.id).join("_")}`
        : "",
    [sessionWords],
  );

  // Restore mid-session round progress if user closed/reloaded the page
  useEffect(() => {
    if (!draftKey) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        round?: RoundStep;
        round1?: Record<string, boolean>;
        round2?: Record<string, boolean>;
        roundDictation?: Record<string, boolean>;
      };
      if (parsed.round && parsed.round !== "summary" && parsed.round !== "choice") {
        setRound(parsed.round);
        if (parsed.round1) setRound1(parsed.round1);
        if (parsed.round2) setRound2(parsed.round2);
        if (parsed.roundDictation) setRoundDictation(parsed.roundDictation);
      }
    } catch {
      // ignore invalid draft
    }
  }, [draftKey]);

  // Auto-save completed rounds so progress is never lost on tab close
  useEffect(() => {
    if (!draftKey) return;
    try {
      if (round === "summary") {
        localStorage.removeItem(draftKey);
      } else if (round !== "choice") {
        localStorage.setItem(
          draftKey,
          JSON.stringify({ round, round1, round2, roundDictation }),
        );
      }
    } catch {
      // ignore storage quota errors
    }
  }, [draftKey, round, round1, round2, roundDictation]);

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

  const progressPct = includeDictation
    ? round === "choice"
      ? 15
      : round === "matching"
        ? 40
        : round === "dictation"
          ? 65
          : round === "typing"
            ? 85
            : 100
    : round === "choice"
      ? 15
      : round === "matching"
        ? 50
        : round === "typing"
          ? 80
          : 100;

  return (
    <div ref={containerRef} className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-3.5 sm:px-5 pt-safe pb-12">
      <header className="flex items-center gap-2.5 sm:gap-4 py-3.5 sm:py-5">
        <button
          type="button"
          onClick={() => (onClose ? onClose() : router.push("/dashboard"))}
          aria-label={onClose ? "Close review" : "Back to dashboard"}
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
            allWords={allDeckWords && allDeckWords.length > 0 ? allDeckWords : words}
            onEditWord={(w) => {
              setEditTarget(w);
              setEditText(w.text);
              setEditTranslation(w.translation || "");
            }}
            onDeleteWord={(w) => setDeleteTarget(w)}
            onComplete={(r1) => {
              setRound1(r1);
              setRound(
                sessionWords.length >= 2
                  ? "matching"
                  : includeDictation
                    ? "dictation"
                    : "typing",
              );
            }}
          />
        ) : round === "matching" ? (
          <MatchingRound
            words={sessionWords}
            onComplete={(r2) => {
              setRound2(r2);
              setRound(includeDictation ? "dictation" : "typing");
            }}
          />
        ) : round === "dictation" ? (
          <DictationRound
            words={sessionWords}
            onEditWord={(w) => {
              setEditTarget(w);
              setEditText(w.text);
              setEditTranslation(w.translation || "");
            }}
            onDeleteWord={(w) => setDeleteTarget(w)}
            onComplete={(rDict) => {
              setRoundDictation(rDict);
              setRound("typing");
            }}
          />
        ) : round === "typing" ? (
          <TypingRound
            words={sessionWords}
            allowSimpleTypos={allowSimpleTypos}
            promptMode={promptMode}
            roundLabel={includeDictation ? "Round 4 · Write Translation" : "Round 3 · Typing Recall"}
            onToggleTypos={setAllowSimpleTypos}
            onEditWord={(w) => {
              setEditTarget(w);
              setEditText(w.text);
              setEditTranslation(w.translation || "");
            }}
            onDeleteWord={(w) => setDeleteTarget(w)}
            onComplete={(r3) => {
              setRound3(r3);
              const combinedR3: Record<string, boolean> = { ...r3 };
              if (includeDictation) {
                for (const w of sessionWords) {
                  combinedR3[w.id] = (roundDictation[w.id] ?? true) && (r3[w.id] ?? true);
                }
              }
              finalizeSession(round1, round2, combinedR3, false);
            }}
          />
        ) : (
          <ReviewSummary
            items={summaryItems}
            xpEarned={xpEarned}
            saving={saving}
            saveError={saveError}
            onRetrySave={() => void persistBatch(pendingUpdates, xpEarned)}
            onPracticeHard={onPracticeHard}
            onReviewMore={onReload}
          />
        )}
      </main>

      {editTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget && !savingEdit) setEditTarget(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape" && !savingEdit) setEditTarget(null);
          }}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-review-word-title"
            onSubmit={async (e) => {
              e.preventDefault();
              const nextText = editText.trim();
              if (!nextText || savingEdit) return;
              const nextTrans = editTranslation.trim();
              setSavingEdit(true);
              try {
                await updateWordDetails(
                  editTarget.id,
                  { text: nextText, translation: nextTrans },
                  editTarget,
                );
                setWordOverrides((prev) => ({
                  ...prev,
                  [editTarget.id]: { text: nextText, translation: nextTrans },
                }));
                setEditTarget(null);
              } finally {
                setSavingEdit(false);
              }
            }}
            className="w-full max-w-sm grid gap-4 rounded-3xl border border-line bg-surface p-6 shadow-2xl"
          >
            <h3 id="edit-review-word-title" className="text-xl font-bold text-ink">
              Edit word
            </h3>
            <div className="grid gap-3">
              <label className="grid gap-1 text-xs font-semibold text-muted">
                <span>Word</span>
                <input
                  type="text"
                  autoFocus
                  required
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="field text-sm font-semibold text-ink"
                />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-muted">
                <span>Meaning / Translation</span>
                <input
                  type="text"
                  value={editTranslation}
                  onChange={(e) => setEditTranslation(e.target.value)}
                  className="field text-sm text-ink"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2.5 pt-1">
              <button
                type="button"
                disabled={savingEdit}
                onClick={() => setEditTarget(null)}
                className="btn btn-quiet cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingEdit || !editText.trim()}
                className="btn btn-primary font-bold cursor-pointer disabled:opacity-50"
              >
                {savingEdit ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {deleteTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deletingWord) setDeleteTarget(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape" && !deletingWord) setDeleteTarget(null);
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-quick-review-word-title"
            className="w-full max-w-sm grid gap-4 rounded-3xl border border-line bg-surface p-6 shadow-2xl"
          >
            <div>
              <h3 id="delete-quick-review-word-title" className="text-xl font-bold text-ink">
                Delete &ldquo;{deleteTarget.text}&rdquo;?
              </h3>
              <p className="text-xs sm:text-sm text-muted mt-1">
                This permanently removes the word from your saved vocabulary and skips to the next word.
              </p>
            </div>
            <div className="flex justify-end gap-2.5 pt-1">
              <button
                type="button"
                autoFocus
                disabled={deletingWord}
                onClick={() => setDeleteTarget(null)}
                className="btn btn-quiet cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingWord}
                onClick={async () => {
                  if (deletingWord) return;
                  setDeletingWord(true);
                  try {
                    await deleteWord(deleteTarget.id);
                    await deleteWordByText(deleteTarget.text, deleteTarget.src_lang).catch(
                      () => {},
                    );
                    setDeletedIds((prev) => new Set(prev).add(deleteTarget.id));
                    setDeleteTarget(null);
                  } finally {
                    setDeletingWord(false);
                  }
                }}
                className="btn btn-bad font-bold cursor-pointer"
              >
                {deletingWord ? "Deleting…" : "Yes, delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

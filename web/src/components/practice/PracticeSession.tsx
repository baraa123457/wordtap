"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteWord, recordPractice, reviewWord } from "@/lib/api";
import { localDateString } from "@/lib/dates";
import type { Word } from "@/lib/schemas";
import { buildSession, isPracticableWord, type MatchQuestion, type Question } from "@/lib/session";
import { getStoredSettings } from "@/lib/settings";
import { canSpeak } from "@/lib/speech";
import { checkTyped } from "@/lib/text";
import { parseSourceContext } from "@/lib/format";
import { CloseIcon } from "../Icons";
import { ChoiceView } from "./ChoiceView";
import { ScrambleView } from "./ScrambleView";
import { FeedbackBar } from "./FeedbackBar";
import { MatchView } from "./MatchView";
import { Summary, type SaveState } from "./Summary";
import { TypeView } from "./TypeView";
import type { Phase } from "./types";

type Item = { q: Question; retry: boolean };

const XP_FIRST_TRY = 10;
const XP_RETRY = 5;
const SESSION_WORDS = 8;

export function PracticeSession({
  words,
  onAgain,
  onChangeLang,
  modeOverride,
}: {
  words: Word[];
  onAgain: () => void;
  onChangeLang?: () => void;
  modeOverride?: "mixed" | "typing" | "choice" | "dictation";
}) {
  const router = useRouter();
  const [settings] = useState(() => getStoredSettings());

  const [queue, setQueue] = useState<Item[]>(() => {
    let mode = modeOverride || settings.practiceMode || "mixed";
    if (!modeOverride && mode !== "dictation") {
      if (settings.enableChoice === false && settings.enableTyping) mode = "typing";
      else if (settings.enableTyping === false && settings.enableChoice) mode = "choice";
      else if (settings.enableChoice && settings.enableTyping) mode = "mixed";
    }

    return buildSession(words, {
      size: settings.sessionSize || SESSION_WORDS,
      canSpeak: canSpeak(),
      mode,
    }).map((q) => ({ q, retry: false }));
  });
  const [total, setTotal] = useState(() => queue.length);
  const [done, setDone] = useState(0);
  const [phase, setPhase] = useState<Phase>("answering");
  const [selected, setSelected] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [xp, setXp] = useState(0);
  const [tally, setTally] = useState({ asked: 0, right: 0 });
  const [missed, setMissed] = useState<Word[]>([]);
  const [reviewFailed, setReviewFailed] = useState(false);
  const [save, setSave] = useState<SaveState>("idle");
  const [leaving, setLeaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const reviewed = useRef(new Set<string>());
  const xpSaved = useRef(false);
  const lastRecordedXp = useRef(0);
  const wordsById = useMemo(() => new Map(words.map((w) => [w.id, w])), [words]);
  const [remainingIds, setRemainingIds] = useState<string[]>(() =>
    words.filter(isPracticableWord).map((w) => w.id),
  );

  const current = queue[0];
  const finished = current === undefined;

  const remainingCount = remainingIds.length;

  const handleDeleteWord = useCallback(
    async (wordId: string) => {
      setIsDeleting(true);
      try {
        await deleteWord(wordId);
        setRemainingIds((prev) => prev.filter((id) => id !== wordId));
        // Remove word from queue immediately, including within Match questions!
        setQueue((prev) =>
          prev
            .map((item) => {
              if (item.q.type === "match") {
                const remainingPairs = item.q.pairs.filter((p) => p.wordId !== wordId);
                if (remainingPairs.length < 2) return null;
                return {
                  ...item,
                  q: {
                    ...item.q,
                    pairs: remainingPairs,
                  },
                };
              }
              if ("wordId" in item.q && item.q.wordId === wordId) {
                return null;
              }
              return item;
            })
            .filter((item): item is Item => item !== null),
        );
        setMissed((prev) => prev.filter((w) => w.id !== wordId));
        setPhase("answering");
        setSelected(null);
        setTyped("");
        setDeleteConfirmId(null);
      } catch (err) {
        console.error("Failed to delete word:", err);
      } finally {
        setIsDeleting(false);
      }
    },
    [],
  );

  /** Only the first result for a word in a session changes its schedule. */
  const review = useCallback((wordId: string, correct: boolean) => {
    if (reviewed.current.has(wordId)) return;
    reviewed.current.add(wordId);
    setRemainingIds((prev) => prev.filter((id) => id !== wordId));
    reviewWord(wordId, correct).catch(() => setReviewFailed(true));
  }, []);

  const markMissed = useCallback(
    (wordId: string) => {
      const word = wordsById.get(wordId);
      if (!word) return;
      setMissed((prev) => (prev.some((w) => w.id === wordId) ? prev : [...prev, word]));
    },
    [wordsById],
  );

  // Progressively record XP and maintain streak on every correct answer
  const syncXpProgress = useCallback((currentTotalXp: number) => {
    const delta = currentTotalXp - lastRecordedXp.current;
    if (delta > 0) {
      lastRecordedXp.current = currentTotalXp;
      recordPractice(delta, localDateString()).catch((err) => {
        console.warn("Could not sync incremental practice progress:", err);
      });
    }
  }, []);

  // Save any remaining unsaved XP and confirm streak once the last question is done.
  useEffect(() => {
    if (!finished || xpSaved.current) return;
    xpSaved.current = true;
    const delta = xp - lastRecordedXp.current;
    if (delta > 0) {
      lastRecordedXp.current = xp;
      setSave("saving");
      recordPractice(delta, localDateString())
        .then(() => setSave("saved"))
        .catch(() => setSave("error"));
    } else {
      setSave("saved");
    }
  }, [finished, xp]);

  function retrySave() {
    setSave("saving");
    const delta = xp - lastRecordedXp.current;
    const toSave = delta > 0 ? delta : xp;
    recordPractice(toSave, localDateString())
      .then(() => {
        lastRecordedXp.current = xp;
        setSave("saved");
      })
      .catch(() => setSave("error"));
  }

  function evaluate(result: "correct" | "typo" | "wrong") {
    if (!current || current.q.type === "match") return;
    const ok = result !== "wrong";
    if (!current.retry) {
      setTally((t) => ({ asked: t.asked + 1, right: t.right + (ok ? 1 : 0) }));
      review(current.q.wordId, ok);
      if (!ok) markMissed(current.q.wordId);
    }
    if (ok) {
      const earned = current.retry ? XP_RETRY : XP_FIRST_TRY;
      setXp((prev) => {
        const next = prev + earned;
        syncXpProgress(next);
        return next;
      });
    }
    setPhase(result);
  }

  function check() {
    const q = current?.q;
    if (!q) return;
    if (q.type === "choice") {
      if (selected !== null) evaluate(selected === q.answer ? "correct" : "wrong");
    } else if (q.type === "scramble") {
      if (selected !== null) {
        evaluate(selected.trim().toLowerCase() === q.answer.trim().toLowerCase() ? "correct" : "wrong");
      }
    } else if (q.type === "type") {
      evaluate(checkTyped(typed, q.answer));
    }
  }

  const advance = useCallback(
    (difficulty?: "hard" | "medium" | "easy") => {
      const isHard = difficulty === "hard";
      const isEasy = difficulty === "easy";

      if (current && current.q.type !== "match") {
        const wordId = current.q.wordId;
        if (isHard) {
          // If rated Hard, mark as missed so it appears in summary and database interval resets
          markMissed(wordId);
          reviewWord(wordId, false, 1).catch(() => setReviewFailed(true));
          setTally((t) => ({ ...t, right: Math.max(0, t.right - 1) }));
        } else if (isEasy) {
          // If rated Easy, advance schedule with Grade 3 (+2 boxes)
          reviewWord(wordId, true, 3).catch(() => setReviewFailed(true));
        } else {
          // Medium / Default: advance schedule with Grade 2 (+1 box)
          reviewWord(wordId, true, 2).catch(() => setReviewFailed(true));
        }
      }

      setQueue((prev) => {
        const [head, ...rest] = prev;
        if (!head) return prev;
        const requeue = (phase === "wrong" && !head.retry) || (isHard && !head.retry);
        return requeue ? [...rest, { q: head.q, retry: true }] : rest;
      });

      setDone((d) => ((phase === "wrong" || isHard) && !current?.retry ? d : d + 1));
      setPhase("answering");
      setSelected(null);
      setTyped("");
    },
    [phase, current, markMissed],
  );

  const completeMatch = useCallback(
    (q: MatchQuestion, mistakes: string[]) => {
      const bad = new Set(mistakes);
      for (const pair of q.pairs) {
        review(pair.wordId, !bad.has(pair.wordId));
        if (bad.has(pair.wordId)) markMissed(pair.wordId);
      }
      const clean = mistakes.length === 0;
      setTally((t) => ({ asked: t.asked + 1, right: t.right + (clean ? 1 : 0) }));
      const earned = clean ? XP_FIRST_TRY : XP_RETRY;
      setXp((prev) => {
        const next = prev + earned;
        syncXpProgress(next);
        return next;
      });
      setQueue((prev) => prev.slice(1));
      setDone((d) => d + 1);
    },
    [review, markMissed, syncXpProgress],
  );

  async function leave() {
    if (!xpSaved.current) {
      xpSaved.current = true;
      const delta = xp - lastRecordedXp.current;
      if (delta > 0) {
        lastRecordedXp.current = xp;
        try {
          await recordPractice(delta, localDateString());
        } catch {
          // Leaving anyway; reviews already saved one by one.
        }
      }
    }
    router.push("/dashboard");
  }

  const startDrillMissed = useCallback(
    (wordsToDrill: Word[]) => {
      let mode = modeOverride || settings.practiceMode || "mixed";
      if (!modeOverride && mode !== "dictation") {
        if (settings.enableChoice === false && settings.enableTyping) mode = "typing";
        else if (settings.enableTyping === false && settings.enableChoice) mode = "choice";
        else if (settings.enableChoice && settings.enableTyping) mode = "mixed";
      }

      const newQueue = buildSession(wordsToDrill, {
        size: wordsToDrill.length,
        canSpeak: canSpeak(),
        mode,
      }).map((q) => ({ q, retry: false }));

      setQueue(newQueue);
      setTotal(newQueue.length);
      setDone(0);
      setPhase("answering");
      setSelected(null);
      setTyped("");
      setXp(0);
      lastRecordedXp.current = 0;
      setTally({ asked: 0, right: 0 });
      setMissed([]);
      setRemainingIds(wordsToDrill.map((w) => w.id));
      reviewed.current.clear();
      xpSaved.current = false;
      setSave("idle");
      setReviewFailed(false);
    },
    [modeOverride, settings],
  );

  const handleAgain = useCallback(() => {
    let mode = modeOverride || settings.practiceMode || "mixed";
    if (!modeOverride && mode !== "dictation") {
      if (settings.enableChoice === false && settings.enableTyping) mode = "typing";
      else if (settings.enableTyping === false && settings.enableChoice) mode = "choice";
      else if (settings.enableChoice && settings.enableTyping) mode = "mixed";
    }

    const newQueue = buildSession(words, {
      size: settings.sessionSize || SESSION_WORDS,
      canSpeak: canSpeak(),
      mode,
    }).map((q) => ({ q, retry: false }));

    setQueue(newQueue);
    setTotal(newQueue.length);
    setDone(0);
    setPhase("answering");
    setSelected(null);
    setTyped("");
    setXp(0);
    lastRecordedXp.current = 0;
    setTally({ asked: 0, right: 0 });
    setMissed([]);
    reviewed.current.clear();
    xpSaved.current = false;
    setSave("idle");
    setReviewFailed(false);

    if (onAgain) {
      onAgain();
    }
  }, [words, modeOverride, settings, onAgain]);

  if (finished) {
    return (
      <Summary
        xp={xp}
        asked={tally.asked}
        right={tally.right}
        missed={missed}
        save={save}
        reviewFailed={reviewFailed}
        onRetrySave={retrySave}
        onAgain={handleAgain}
        onDrillMissed={() => startDrillMissed(missed)}
        onChangeLang={onChangeLang}
        remainingCount={remainingCount}
      />
    );
  }

  const q = current.q;
  const progress = total === 0 ? 0 : Math.round((done / total) * 100);
  const canCheck =
    q.type === "choice"
      ? selected !== null
      : q.type === "scramble"
      ? selected !== null && selected.trim().length > 0
      : q.type === "type"
      ? typed.trim() !== ""
      : false;
  const answer = q.type === "match" ? "" : q.answer;
  const parsedContext = "context" in q ? parseSourceContext(q.context) : { sentence: undefined, sourceTitle: "" };
  const sourceUrl = "sourceUrl" in q ? q.sourceUrl : undefined;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-3.5 sm:px-4 pt-safe">
      <header className="flex items-center gap-3 sm:gap-4 py-3.5 sm:py-5">
        <button
          type="button"
          className="btn btn-quiet w-10 h-10 min-h-10 p-0 flex items-center justify-center rounded-full text-muted hover:text-ink active:scale-95 transition-all cursor-pointer shrink-0"
          aria-label="Leave practice"
          onClick={() => setLeaving(true)}
        >
          <CloseIcon />
        </button>
        <div
          role="progressbar"
          aria-label="Session progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          className="h-2.5 sm:h-3 flex-1 overflow-hidden rounded-full bg-line"
        >
          <div className="h-full rounded-full bg-subtitle transition-[width] duration-300" style={{ width: `${progress}%` }} />
        </div>
        <span className="min-w-12 sm:min-w-14 text-end text-xs sm:text-sm tabular-nums text-muted font-bold">{xp} XP</span>
      </header>

      {/* Leave Practice Confirmation Modal */}
      {leaving ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div role="alertdialog" aria-label="Leave practice?" className="w-full max-w-sm grid gap-4 rounded-3xl border border-line bg-surface p-5 sm:p-6 shadow-2xl text-center sm:text-start animate-in fade-in zoom-in-95 duration-150">
            <div>
              <h3 className="text-xl font-bold text-ink">Leave practice?</h3>
              <p className="text-xs sm:text-sm text-muted mt-1">The answers you gave so far are saved.</p>
            </div>
            <div className="flex flex-col gap-2.5 pt-1">
              <button
                type="button"
                className="btn btn-primary w-full font-bold cursor-pointer"
                onClick={() => setLeaving(false)}
              >
                Keep practicing
              </button>
              {onChangeLang ? (
                <button
                  type="button"
                  className="btn w-full font-semibold cursor-pointer"
                  onClick={() => {
                    setLeaving(false);
                    onChangeLang();
                  }}
                >
                  Change language
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn-quiet text-muted hover:text-bad w-full font-medium cursor-pointer"
                onClick={() => void leave()}
              >
                Leave practice
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Delete Word Confirmation Modal */}
      {deleteConfirmId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div role="alertdialog" aria-label="Delete word?" className="w-full max-w-md grid gap-4 rounded-3xl border border-line bg-surface p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-ink">Delete this word?</h3>
            <p className="text-sm text-muted">It will be permanently deleted from your saved words so you won&apos;t practice it again.</p>
            <div className="flex gap-3 justify-end mt-2">
              <button
                type="button"
                className="btn btn-quiet"
                onClick={() => setDeleteConfirmId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                className="btn btn-bad"
                onClick={() => void handleDeleteWord(deleteConfirmId)}
              >
                {isDeleting ? "Deleting..." : "Yes, delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <main className="flex-1 pb-44">
        {q.type === "choice" ? (
          <ChoiceView
            key={q.id + String(current.retry)}
            q={q}
            selected={selected}
            phase={phase}
            onSelect={setSelected}
            onDeleteWord={(wordId) => setDeleteConfirmId(wordId)}
          />
        ) : q.type === "scramble" ? (
          <ScrambleView
            key={q.id + String(current.retry)}
            q={q}
            value={selected || ""}
            phase={phase}
            onChange={setSelected}
            onSubmit={check}
            onDeleteWord={(wordId) => setDeleteConfirmId(wordId)}
          />
        ) : q.type === "type" ? (
          <TypeView
            key={q.id + String(current.retry)}
            q={q}
            value={typed}
            phase={phase}
            onChange={setTyped}
            onSubmit={check}
            onDeleteWord={(wordId) => setDeleteConfirmId(wordId)}
          />
        ) : (
          <MatchView
            key={q.id}
            q={q}
            onComplete={(mistakes) => completeMatch(q, mistakes)}
            onDeleteWord={(wordId) => setDeleteConfirmId(wordId)}
          />
        )}
      </main>

      {q.type !== "match" ? (
        <FeedbackBar
          phase={phase}
          answer={answer}
          sentence={("sentence" in q && q.sentence) || parsedContext.sentence}
          sourceUrl={sourceUrl}
          sourceTitle={parsedContext.sourceTitle}
          canCheck={canCheck}
          onCheck={check}
          onSkip={() => evaluate("wrong")}
          onContinue={advance}
        />
      ) : null}
    </div>
  );
}

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
  modeOverride,
}: {
  words: Word[];
  onAgain: () => void;
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
  const [total] = useState(() => queue.length);
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

  // Save XP and streak once, when the last question is done.
  useEffect(() => {
    if (!finished || xpSaved.current) return;
    xpSaved.current = true;
    if (xp === 0) {
      setSave("saved");
      return;
    }
    setSave("saving");
    recordPractice(xp, localDateString())
      .then(() => setSave("saved"))
      .catch(() => setSave("error"));
  }, [finished, xp]);

  function retrySave() {
    setSave("saving");
    recordPractice(xp, localDateString())
      .then(() => setSave("saved"))
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
    if (ok) setXp((x) => x + (current.retry ? XP_RETRY : XP_FIRST_TRY));
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

  const advance = useCallback(() => {
    setQueue((prev) => {
      const [head, ...rest] = prev;
      if (!head) return prev;
      const requeue = phase === "wrong" && !head.retry;
      return requeue ? [...rest, { q: head.q, retry: true }] : rest;
    });
    setDone((d) => (phase === "wrong" && !current?.retry ? d : d + 1));
    setPhase("answering");
    setSelected(null);
    setTyped("");
  }, [phase, current]);

  const completeMatch = useCallback(
    (q: MatchQuestion, mistakes: string[]) => {
      const bad = new Set(mistakes);
      for (const pair of q.pairs) {
        review(pair.wordId, !bad.has(pair.wordId));
        if (bad.has(pair.wordId)) markMissed(pair.wordId);
      }
      const clean = mistakes.length === 0;
      setTally((t) => ({ asked: t.asked + 1, right: t.right + (clean ? 1 : 0) }));
      setXp((x) => x + (clean ? XP_FIRST_TRY : XP_RETRY));
      setQueue((prev) => prev.slice(1));
      setDone((d) => d + 1);
    },
    [review, markMissed],
  );

  async function leave() {
    if (!xpSaved.current && xp > 0) {
      xpSaved.current = true;
      try {
        await recordPractice(xp, localDateString());
      } catch {
        // Leaving anyway; reviews already saved one by one.
      }
    }
    router.push("/dashboard");
  }

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
        onAgain={onAgain}
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
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4">
      <header className="flex items-center gap-4 py-5">
        <button type="button" className="btn btn-quiet min-h-10 px-2" aria-label="Leave practice" onClick={() => setLeaving(true)}>
          <CloseIcon />
        </button>
        <div
          role="progressbar"
          aria-label="Session progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          className="h-3 flex-1 overflow-hidden rounded-full bg-line"
        >
          <div className="h-full rounded-full bg-subtitle transition-[width] duration-300" style={{ width: `${progress}%` }} />
        </div>
        <span className="min-w-14 text-end text-sm tabular-nums text-muted">{xp} XP</span>
      </header>

      {/* Leave Practice Confirmation Modal */}
      {leaving ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div role="alertdialog" aria-label="Leave practice?" className="w-full max-w-md grid gap-4 rounded-3xl border border-line bg-surface p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-ink">Leave practice?</h3>
            <p className="text-sm text-muted">The answers you gave so far are saved.</p>
            <div className="flex gap-3 justify-end mt-2">
              <button type="button" className="btn btn-quiet" onClick={() => setLeaving(false)}>
                Keep practicing
              </button>
              <button type="button" className="btn btn-primary" onClick={() => void leave()}>
                Leave
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

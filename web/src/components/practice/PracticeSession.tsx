"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { recordPractice, reviewWord } from "@/lib/api";
import { localDateString } from "@/lib/dates";
import type { Word } from "@/lib/schemas";
import { buildSession, type MatchQuestion, type Question } from "@/lib/session";
import { getStoredSettings } from "@/lib/settings";
import { canSpeak } from "@/lib/speech";
import { checkTyped } from "@/lib/text";
import { CloseIcon } from "../Icons";
import { ChoiceView } from "./ChoiceView";
import { FeedbackBar } from "./FeedbackBar";
import { MatchView } from "./MatchView";
import { Summary, type SaveState } from "./Summary";
import { TypeView } from "./TypeView";
import type { Phase } from "./types";

type Item = { q: Question; retry: boolean };

const XP_FIRST_TRY = 10;
const XP_RETRY = 5;
const SESSION_WORDS = 8;

export function PracticeSession({ words, onAgain }: { words: Word[]; onAgain: () => void }) {
  const router = useRouter();
  const [settings] = useState(() => getStoredSettings());

  const [queue, setQueue] = useState<Item[]>(() => {
    let mode = settings.practiceMode || "mixed";
    if (settings.enableChoice === false && settings.enableTyping) mode = "typing";
    else if (settings.enableTyping === false && settings.enableChoice) mode = "choice";
    else if (settings.enableChoice && settings.enableTyping) mode = "mixed";

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

  const reviewed = useRef(new Set<string>());
  const xpSaved = useRef(false);
  const wordsById = useMemo(() => new Map(words.map((w) => [w.id, w])), [words]);

  const current = queue[0];
  const finished = current === undefined;

  /** Only the first result for a word in a session changes its schedule. */
  const review = useCallback((wordId: string, correct: boolean) => {
    if (reviewed.current.has(wordId)) return;
    reviewed.current.add(wordId);
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
      />
    );
  }

  const q = current.q;
  const progress = total === 0 ? 0 : Math.round((done / total) * 100);
  const canCheck = q.type === "choice" ? selected !== null : q.type === "type" ? typed.trim() !== "" : false;
  const answer = q.type === "match" ? "" : q.answer;

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

      {leaving ? (
        <div role="alertdialog" aria-label="Leave practice?" className="mb-4 grid gap-3 rounded-2xl border-2 border-line bg-surface p-4">
          <p className="font-semibold">Leave practice? The answers you gave so far are saved.</p>
          <div className="flex gap-3">
            <button type="button" className="btn btn-primary" onClick={() => setLeaving(false)}>
              Keep practicing
            </button>
            <button type="button" className="btn" onClick={() => void leave()}>
              Leave
            </button>
          </div>
        </div>
      ) : null}

      <main className="flex-1 pb-44">
        {q.type === "choice" ? (
          <ChoiceView key={q.id + String(current.retry)} q={q} selected={selected} phase={phase} onSelect={setSelected} />
        ) : q.type === "type" ? (
          <TypeView key={q.id + String(current.retry)} q={q} value={typed} phase={phase} onChange={setTyped} onSubmit={check} />
        ) : (
          <MatchView key={q.id} q={q} onComplete={(mistakes) => completeMatch(q, mistakes)} />
        )}
      </main>

      {q.type !== "match" ? (
        <FeedbackBar
          phase={phase}
          answer={answer}
          canCheck={canCheck}
          onCheck={check}
          onSkip={() => evaluate("wrong")}
          onContinue={advance}
        />
      ) : null}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { shuffle, type MatchQuestion } from "@/lib/session";
import { speak } from "@/lib/speech";
import { TrashIcon } from "../Icons";

type Props = {
  q: MatchQuestion;
  /** Called once every pair is matched, with the ids of words the learner mismatched. */
  onComplete: (mistakes: string[]) => void;
  onDeleteWord?: (wordId: string) => void;
};

export function MatchView({ q, onComplete, onDeleteWord }: Props) {
  const [left, setLeft] = useState(() => shuffle(q.pairs.map((p) => p.wordId)));
  const [right, setRight] = useState(() => shuffle(q.pairs.map((p) => p.wordId)));
  const [pickedLeft, setPickedLeft] = useState<string | null>(null);
  const [pickedRight, setPickedRight] = useState<string | null>(null);
  const [matched, setMatched] = useState<ReadonlySet<string>>(new Set());
  const [mistakes, setMistakes] = useState<ReadonlySet<string>>(new Set());
  const [flash, setFlash] = useState<{ left: string; right: string } | null>(null);
  const completed = useRef(false);

  // Sync left and right arrays if q.pairs changes (e.g. when a word is deleted)
  useEffect(() => {
    const validIds = new Set(q.pairs.map((p) => p.wordId));
    setLeft((prev) => prev.filter((id) => validIds.has(id)));
    setRight((prev) => prev.filter((id) => validIds.has(id)));
    setMatched((prev) => {
      const next = new Set<string>();
      for (const id of prev) {
        if (validIds.has(id)) next.add(id);
      }
      return next;
    });
    setPickedLeft((cur) => (cur && validIds.has(cur) ? cur : null));
    setPickedRight((cur) => (cur && validIds.has(cur) ? cur : null));
  }, [q.pairs]);

  // If fewer than 2 pairs remain after deletion, conclude match
  useEffect(() => {
    if (q.pairs.length < 2 && !completed.current) {
      completed.current = true;
      onComplete([]);
    }
  }, [q.pairs.length, onComplete]);

  const pair = (id: string) => q.pairs.find((p) => p.wordId === id);

  function resolve(l: string, r: string) {
    if (l === r) {
      setMatched((prev) => new Set(prev).add(l));
      setPickedLeft(null);
      setPickedRight(null);
      return;
    }
    setMistakes((prev) => new Set(prev).add(l));
    setFlash({ left: l, right: r });
    window.setTimeout(() => {
      setFlash(null);
      setPickedLeft(null);
      setPickedRight(null);
    }, 450);
  }

  function chooseLeft(id: string) {
    if (matched.has(id) || flash) return;
    if (pickedLeft === id) {
      setPickedLeft(null);
      return;
    }
    const p = pair(id);
    if (p) speak(p.word, p.lang);
    setPickedLeft(id);
    if (pickedRight) resolve(id, pickedRight);
  }

  function chooseRight(id: string) {
    if (matched.has(id) || flash) return;
    if (pickedRight === id) {
      setPickedRight(null);
      return;
    }
    setPickedRight(id);
    if (pickedLeft) resolve(pickedLeft, id);
  }

  useEffect(() => {
    if (matched.size !== q.pairs.length || completed.current) return;
    const t = window.setTimeout(() => {
      completed.current = true;
      onComplete([...mistakes]);
    }, 500);
    return () => window.clearTimeout(t);
  }, [matched, mistakes, q.pairs.length, onComplete]);

  function stateOf(id: string, side: "left" | "right"): string | undefined {
    if (matched.has(id)) return "right";
    if (flash && flash[side] === id) return "wrong";
    if ((side === "left" ? pickedLeft : pickedRight) === id) return "selected";
    return undefined;
  }

  return (
    <div className="grid gap-6">
      <div className="frame">
        <div className="frame-bar">
          <span>Match each word with its translation</span>
          <div className="flex items-center gap-3">
            {(pickedLeft || pickedRight) && onDeleteWord && (
              <button
                type="button"
                onClick={() => {
                  const idToDelete = pickedLeft || pickedRight;
                  if (idToDelete) onDeleteWord(idToDelete);
                }}
                className="inline-flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 font-medium transition-colors cursor-pointer bg-rose-500/10 hover:bg-rose-500/20 px-2.5 py-1 rounded-full border border-rose-500/30"
                title="Delete selected word from your account"
              >
                <TrashIcon size={13} />
                <span>Delete selected word</span>
              </button>
            )}
            <span>
              {matched.size} of {q.pairs.length}
            </span>
          </div>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 sm:gap-6 sm:p-6">
          <div className="grid content-start gap-3">
            {left.map((id) => (
              <button
                key={id}
                type="button"
                className="option"
                data-state={stateOf(id, "left")}
                data-flash={flash?.left === id}
                disabled={matched.has(id)}
                onClick={() => chooseLeft(id)}
              >
                <span dir="auto" className="min-w-0 break-words">
                  {pair(id)?.word}
                </span>
              </button>
            ))}
          </div>
          <div className="grid content-start gap-3">
            {right.map((id) => (
              <button
                key={id}
                type="button"
                className="option"
                data-state={stateOf(id, "right")}
                data-flash={flash?.right === id}
                disabled={matched.has(id)}
                onClick={() => chooseRight(id)}
              >
                <span dir="auto" className="min-w-0 break-words">
                  {pair(id)?.translation}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

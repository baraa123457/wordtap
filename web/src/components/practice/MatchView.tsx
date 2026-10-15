"use client";

import { useEffect, useRef, useState } from "react";
import { shuffle, type MatchQuestion } from "@/lib/session";
import { speak } from "@/lib/speech";

type Props = {
  q: MatchQuestion;
  /** Called once every pair is matched, with the ids of words the learner mismatched. */
  onComplete: (mistakes: string[]) => void;
};

export function MatchView({ q, onComplete }: Props) {
  const [left] = useState(() => shuffle(q.pairs.map((p) => p.wordId)));
  const [right] = useState(() => shuffle(q.pairs.map((p) => p.wordId)));
  const [pickedLeft, setPickedLeft] = useState<string | null>(null);
  const [pickedRight, setPickedRight] = useState<string | null>(null);
  const [matched, setMatched] = useState<ReadonlySet<string>>(new Set());
  const [mistakes, setMistakes] = useState<ReadonlySet<string>>(new Set());
  const [flash, setFlash] = useState<{ left: string; right: string } | null>(null);
  const completed = useRef(false);

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
    const p = pair(id);
    if (p) speak(p.word, p.lang);
    setPickedLeft(id);
    if (pickedRight) resolve(id, pickedRight);
  }

  function chooseRight(id: string) {
    if (matched.has(id) || flash) return;
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
          <span>
            {matched.size} of {q.pairs.length}
          </span>
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

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { speak } from "@/lib/speech";
import type { Word } from "@/lib/schemas";

function shuffleIds(ids: string[]): string[] {
  const copy = [...ids];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

export function MatchingRound({
  words,
  onComplete,
}: {
  words: Word[];
  onComplete: (results: Record<string, boolean>) => void;
}) {
  const batches = useMemo(() => {
    const out: Word[][] = [];
    for (let i = 0; i < words.length; i += 5) {
      const slice = words.slice(i, i + 5);
      if (slice.length < 5 && words.length >= 5) {
        const seen = new Set(slice.map((w) => w.id));
        for (const extra of words) {
          if (slice.length >= 5) break;
          if (!seen.has(extra.id)) {
            seen.add(extra.id);
            slice.push(extra);
          }
        }
      }
      out.push(slice);
    }
    return out;
  }, [words]);

  const [batchIndex, setBatchIndex] = useState(0);
  const currentBatch = useMemo(() => batches[batchIndex] ?? [], [batches, batchIndex]);

  const [leftOrder, setLeftOrder] = useState<string[]>([]);
  const [rightOrder, setRightOrder] = useState<string[]>([]);
  const [pickedLeft, setPickedLeft] = useState<string | null>(null);
  const [pickedRight, setPickedRight] = useState<string | null>(null);
  const [matched, setMatched] = useState<ReadonlySet<string>>(() => new Set());
  const [wrongFlash, setWrongFlash] = useState<{ left: string; right: string } | null>(null);
  const [mistakeIds, setMistakeIds] = useState<Set<string>>(() => new Set());
  const flashTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const ids = currentBatch.map((w) => w.id);
    setLeftOrder(shuffleIds(ids));
    setRightOrder(shuffleIds(ids));
    setPickedLeft(null);
    setPickedRight(null);
    setMatched(new Set());
    setWrongFlash(null);
  }, [currentBatch]);

  useEffect(() => {
    return () => {
      if (flashTimerRef.current !== null) window.clearTimeout(flashTimerRef.current);
    };
  }, []);

  const wordById = useMemo(
    () => new Map(currentBatch.map((w) => [w.id, w])),
    [currentBatch],
  );

  const resolvePair = (leftId: string, rightId: string) => {
    if (leftId === rightId) {
      const nextMatched = new Set(matched);
      nextMatched.add(leftId);
      setMatched(nextMatched);
      setPickedLeft(null);
      setPickedRight(null);

      if (nextMatched.size === currentBatch.length) {
        window.setTimeout(() => {
          if (batchIndex + 1 < batches.length) {
            setBatchIndex((b) => b + 1);
          } else {
            const finalResults: Record<string, boolean> = {};
            for (const w of words) {
              finalResults[w.id] = !mistakeIds.has(w.id);
            }
            onComplete(finalResults);
          }
        }, 400);
      }
      return;
    }

    setMistakeIds((prev) => {
      const next = new Set(prev);
      next.add(leftId);
      return next;
    });
    setWrongFlash({ left: leftId, right: rightId });
    if (flashTimerRef.current !== null) window.clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => {
      setWrongFlash(null);
      setPickedLeft(null);
      setPickedRight(null);
      flashTimerRef.current = null;
    }, 450);
  };

  const handleTapLeft = (id: string) => {
    if (matched.has(id) || wrongFlash) return;
    if (pickedLeft === id) {
      setPickedLeft(null);
      return;
    }
    const w = wordById.get(id);
    if (w) speak(w.text, w.src_lang || "en");
    setPickedLeft(id);
    if (pickedRight) resolvePair(id, pickedRight);
  };

  const handleTapRight = (id: string) => {
    if (matched.has(id) || wrongFlash) return;
    if (pickedRight === id) {
      setPickedRight(null);
      return;
    }
    setPickedRight(id);
    if (pickedLeft) resolvePair(pickedLeft, id);
  };

  const tileClass = (id: string, side: "left" | "right") => {
    if (matched.has(id)) {
      return "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 opacity-75 cursor-default";
    }
    if (wrongFlash && wrongFlash[side] === id) {
      return "border-bad bg-bad-soft text-bad-ink animate-pulse";
    }
    const isPicked = (side === "left" ? pickedLeft : pickedRight) === id;
    if (isPicked) {
      return "border-subtitle bg-subtitle/25 text-ink ring-2 ring-subtitle/60";
    }
    return "border-line bg-surface hover:border-subtitle text-ink cursor-pointer";
  };

  return (
    <section className="apple-card p-5 sm:p-7 grid gap-5 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-muted">
        <span className="rounded-full bg-subtitle/20 border border-subtitle/30 px-3 py-0.5 text-ink">
          Round 2 · Link Words
        </span>
        <span className="tabular-nums">
          Batch {batchIndex + 1} / {batches.length} · {matched.size} / {currentBatch.length} paired
        </span>
      </div>

      <p className="text-xs sm:text-sm text-muted">
        Tap a word, then tap its matching translation.
      </p>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 min-w-0">
        <div className="grid gap-2.5 min-w-0">
          {leftOrder.map((id) => {
            const w = wordById.get(id);
            if (!w) return null;
            return (
              <button
                key={`left-${id}`}
                type="button"
                disabled={matched.has(id)}
                onClick={() => handleTapLeft(id)}
                dir="auto"
                className={`min-h-12 w-full rounded-2xl border px-3 py-2.5 text-sm sm:text-base font-bold text-center break-words transition-all ${tileClass(id, "left")}`}
              >
                {w.text}
              </button>
            );
          })}
        </div>

        <div className="grid gap-2.5 min-w-0">
          {rightOrder.map((id) => {
            const w = wordById.get(id);
            if (!w) return null;
            return (
              <button
                key={`right-${id}`}
                type="button"
                disabled={matched.has(id)}
                onClick={() => handleTapRight(id)}
                dir="auto"
                className={`min-h-12 w-full rounded-2xl border px-3 py-2.5 text-sm sm:text-base font-semibold text-center break-words transition-all ${tileClass(id, "right")}`}
              >
                {w.translation}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

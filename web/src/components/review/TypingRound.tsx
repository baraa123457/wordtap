"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { canSpeak, speak } from "@/lib/speech";
import { playKeyClickSound } from "@/lib/typing-sound";
import type { Word } from "@/lib/schemas";
import { SpeakerIcon, TrashIcon } from "@/components/Icons";

function normalizeTyped(value: string): string {
  return value
    .trim()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")
    .toLowerCase();
}

function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    Array<number>(b.length + 1).fill(0),
  );
  for (let i = 0; i <= a.length; i++) dp[i]![0] = i;
  for (let j = 0; j <= b.length; j++) dp[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + cost,
      );
    }
  }
  return dp[a.length]![b.length]!;
}

export function TypingRound({
  words,
  allowSimpleTypos,
  onToggleTypos,
  onEditWord,
  onDeleteWord,
  onComplete,
}: {
  words: Word[];
  allowSimpleTypos: boolean;
  onToggleTypos: (next: boolean) => void;
  onEditWord?: (word: Word) => void;
  onDeleteWord?: (word: Word) => void;
  onComplete: (results: Record<string, boolean>) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [checked, setChecked] = useState<"idle" | "correct" | "wrong">("idle");
  const [results, setResults] = useState<Record<string, boolean>>({});

  const current = words[index];

  useEffect(() => {
    if (!current) return;
    inputRef.current?.focus();
    if (canSpeak()) {
      const t = window.setTimeout(() => {
        speak(current.text, current.src_lang || "en");
      }, 90);
      return () => window.clearTimeout(t);
    }
  }, [current]);

  if (!current) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (checked !== "idle" || !typed.trim()) return;

    const cleanTyped = normalizeTyped(typed);
    const cleanTarget = normalizeTyped(current.text);
    const isExact = cleanTyped === cleanTarget;
    const isNearTypo =
      allowSimpleTypos && cleanTarget.length >= 4 && levenshtein(cleanTyped, cleanTarget) <= 1;
    const ok = isExact || isNearTypo;

    if (!ok) playKeyClickSound("error");
    setChecked(ok ? "correct" : "wrong");
    const nextResults = { ...results, [current.id]: ok };
    setResults(nextResults);
  };

  const handleDontKnow = () => {
    if (checked !== "idle") return;
    setChecked("wrong");
    setResults((prev) => ({ ...prev, [current.id]: false }));
  };

  const handleNext = () => {
    if (index + 1 >= words.length) {
      onComplete(results);
    } else {
      setTyped("");
      setChecked("idle");
      setIndex((i) => i + 1);
    }
  };

  return (
    <section className="apple-card p-5 sm:p-7 grid gap-5 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-muted">
        <span className="rounded-full bg-subtitle/20 border border-subtitle/30 px-3 py-0.5 text-ink">
          Round 3 · Typing Recall
        </span>
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-1.5 text-xs font-medium text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={allowSimpleTypos}
              onChange={(e) => onToggleTypos(e.target.checked)}
              className="accent-subtitle h-3.5 w-3.5"
            />
            <span>Allow typos</span>
          </label>
          <span className="tabular-nums">
            {index + 1} / {words.length}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-black/[0.02] dark:bg-white/[0.03] px-4 py-4">
        <p dir="auto" className="text-lg sm:text-2xl font-bold text-ink break-words">
          {current.translation}
        </p>
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {canSpeak() ? (
            <button
              type="button"
              onClick={() => speak(current.text, current.src_lang || "en")}
              aria-label="Play pronunciation"
              className="btn min-h-10 px-3.5 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <SpeakerIcon size={16} />
              <span>Listen</span>
            </button>
          ) : null}
          {onEditWord ? (
            <button
              type="button"
              onClick={() => onEditWord(current)}
              aria-label={`Edit ${current.text}`}
              className="btn btn-quiet min-h-9 px-2.5 py-1 text-xs font-semibold text-muted hover:text-ink rounded-full inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Edit</span>
            </button>
          ) : null}
          {onDeleteWord ? (
            <button
              type="button"
              onClick={() => onDeleteWord(current)}
              aria-label={`Delete ${current.text}`}
              className="btn btn-quiet min-h-9 px-2.5 py-1 text-xs font-semibold text-muted hover:text-bad hover:bg-bad/10 rounded-full inline-flex items-center gap-1 cursor-pointer"
            >
              <TrashIcon size={13} />
              <span>Delete</span>
            </button>
          ) : null}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-3">
        <input
          ref={inputRef}
          type="text"
          value={typed}
          disabled={checked !== "idle"}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onChange={(e) => {
            const nextVal = e.target.value;
            playKeyClickSound(nextVal.length < typed.length ? "backspace" : "key");
            setTyped(nextVal);
          }}
          placeholder="Type the word…"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Type the word"
          className="sr-only"
        />

        {(() => {
          const cleanTarget = normalizeTyped(current.text);
          const typedChars = Array.from(typed);
          const remainingCount = Math.max(0, cleanTarget.length - typedChars.length);
          return (
            <button
              type="button"
              disabled={checked !== "idle"}
              onClick={() => {
                playKeyClickSound("key");
                inputRef.current?.focus();
              }}
              title="Click to type the word"
              className={`w-full min-h-14 rounded-2xl border-b-2 border-subtitle bg-subtitle/10 px-4 py-3 text-center font-mono text-lg sm:text-2xl font-bold tracking-[0.18em] text-ink cursor-text transition-all break-all ${
                isFocused ? "ring-2 ring-amber-500/80 shadow-sm" : "hover:bg-subtitle/20"
              }`}
            >
              {typedChars.length > 0 ? (
                <>
                  {typedChars.map((ch, idx) => {
                    const expected = cleanTarget[idx];
                    const isCharCorrect =
                      typeof expected === "string" && ch.toLowerCase() === expected.toLowerCase();
                    return (
                      <span
                        key={idx}
                        className={
                          isCharCorrect
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-red-600 dark:text-red-400 underline decoration-red-500/70"
                        }
                      >
                        {ch === " " ? "\u00A0" : ch}
                      </span>
                    );
                  })}
                  {remainingCount > 0 ? (
                    <span className="opacity-50">
                      {Array.from(cleanTarget.slice(typedChars.length))
                        .map((c) => (c === " " ? "\u00A0" : "·"))
                        .join("")}
                    </span>
                  ) : null}
                </>
              ) : (
                <span className="opacity-70">
                  {Array.from(cleanTarget)
                    .map((c) => (c === " " ? "\u00A0" : "·"))
                    .join("")}
                </span>
              )}
            </button>
          );
        })()}

        {checked === "idle" ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleDontKnow}
              className="btn btn-quiet min-h-11 px-4 text-xs sm:text-sm font-semibold text-muted hover:text-ink cursor-pointer"
            >
              I don&apos;t know
            </button>
            <button
              type="submit"
              disabled={!typed.trim()}
              className="btn btn-primary flex-1 sm:flex-initial min-h-12 px-6 text-sm sm:text-base font-bold cursor-pointer disabled:opacity-50"
            >
              Check
            </button>
          </div>
        ) : (
          <div
            role="status"
            className={`rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              checked === "correct"
                ? "border-emerald-500/35 bg-emerald-500/10"
                : "border-bad/30 bg-bad-soft"
            }`}
          >
            <div>
              <p
                className={`text-sm font-bold ${
                  checked === "correct"
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-bad-ink"
                }`}
              >
                {checked === "correct"
                  ? `Correct! "${current.text}"`
                  : `Correct word: "${current.text}"`}
              </p>
            </div>
            <button
              type="button"
              autoFocus
              onClick={handleNext}
              className="btn btn-primary min-h-11 px-5 text-sm font-bold cursor-pointer shrink-0"
            >
              {index + 1 >= words.length ? "Finish Review →" : "Next word →"}
            </button>
          </div>
        )}
      </form>
    </section>
  );
}

"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { canSpeak, speak } from "@/lib/speech";
import { usePartOfSpeech } from "@/lib/pos-lookup";
import { playKeyClickSound } from "@/lib/typing-sound";
import type { Word } from "@/lib/schemas";
import { SpeakerIcon, TrashIcon } from "@/components/Icons";

function normalizeSpelling(value: string): string {
  return value
    .trim()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function DictationRound({
  words,
  roundLabel = "Round 3 · Listen & Spell",
  onEditWord,
  onDeleteWord,
  onComplete,
}: {
  words: Word[];
  roundLabel?: string;
  onEditWord?: (word: Word) => void;
  onDeleteWord?: (word: Word) => void;
  onComplete: (results: Record<string, boolean>) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [checked, setChecked] = useState<"idle" | "correct" | "wrong">("idle");
  const [showMeaningHint, setShowMeaningHint] = useState(false);
  const [results, setResults] = useState<Record<string, boolean>>({});

  const current = words[index];
  const partOfSpeech = usePartOfSpeech(current);

  useEffect(() => {
    if (!current) return;
    inputRef.current?.focus();
    if (canSpeak()) {
      const t = window.setTimeout(() => {
        speak(current.text, current.src_lang || "en");
      }, 100);
      return () => window.clearTimeout(t);
    }
  }, [current]);

  const handleNext = () => {
    if (index + 1 >= words.length) {
      onComplete(results);
    } else {
      setTyped("");
      setShowMeaningHint(false);
      setChecked("idle");
      setIndex((i) => i + 1);
    }
  };

  useEffect(() => {
    if (checked === "idle") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.repeat) {
        e.preventDefault();
        handleNext();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (!current) return null;

  const cleanTarget = normalizeSpelling(current.text);
  const typedChars = Array.from(typed);
  const remainingCount = Math.max(0, cleanTarget.length - typedChars.length);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (checked !== "idle" || !typed.trim()) return;

    const cleanTyped = normalizeSpelling(typed);
    const ok = cleanTyped === cleanTarget;
    if (!ok) playKeyClickSound("error");

    setChecked(ok ? "correct" : "wrong");
    setResults((prev) => ({ ...prev, [current.id]: ok }));
  };

  const handleDontKnow = () => {
    if (checked !== "idle") return;
    setChecked("wrong");
    setResults((prev) => ({ ...prev, [current.id]: false }));
  };

  const handleHint = () => {
    if (checked !== "idle") return;
    if (!showMeaningHint && current.translation) {
      setShowMeaningHint(true);
      inputRef.current?.focus();
      return;
    }
    const currentChars = Array.from(typed);
    let prefixLen = 0;
    while (
      prefixLen < currentChars.length &&
      prefixLen < cleanTarget.length &&
      currentChars[prefixLen]?.toLowerCase() === cleanTarget[prefixLen]?.toLowerCase()
    ) {
      prefixLen++;
    }
    if (prefixLen < cleanTarget.length) {
      setTyped(cleanTarget.slice(0, prefixLen + 1));
      playKeyClickSound("key");
    }
    inputRef.current?.focus();
  };

  return (
    <section className="apple-card p-5 sm:p-7 grid gap-5 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-muted">
        <span className="rounded-full bg-subtitle/20 border border-subtitle/30 px-3 py-0.5 text-ink">
          {roundLabel}
        </span>
        <span className="tabular-nums">
          {index + 1} / {words.length}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-black/[0.02] dark:bg-white/[0.03] px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => speak(current.text, current.src_lang || "en")}
            aria-label="Play word audio"
            className="btn btn-primary min-h-11 px-4 text-xs sm:text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
          >
            <SpeakerIcon size={17} />
            <span>Listen</span>
          </button>
          <button
            type="button"
            onClick={() => speak(current.text, current.src_lang || "en", { rate: 0.65 })}
            aria-label="Play word audio slowly"
            className="btn min-h-11 px-3.5 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <span>Slow (0.65×)</span>
          </button>
          {partOfSpeech ? (
            <span className="rounded-full border border-line bg-black/[0.03] dark:bg-white/[0.05] px-2.5 py-0.5 text-xs font-semibold text-muted capitalize">
              {partOfSpeech}
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
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

      <p className="text-xs text-muted text-center">
        Listen to the word and type the exact spelling without errors.
      </p>

      {showMeaningHint && checked === "idle" ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-center">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-subtitle me-2">
            Hint:
          </span>
          <span dir="auto" className="text-sm font-bold text-ink">
            {current.translation}
          </span>
        </div>
      ) : null}

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
          placeholder="Type what you hear…"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Type the word you hear"
          className="sr-only"
        />

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

        {checked === "idle" ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleDontKnow}
                className="btn btn-quiet min-h-11 px-4 text-xs sm:text-sm font-semibold text-muted hover:text-ink cursor-pointer"
              >
                I don&apos;t know
              </button>
              <button
                type="button"
                onClick={handleHint}
                className="btn btn-quiet min-h-11 px-3.5 text-xs sm:text-sm font-semibold text-amber-700 dark:text-subtitle hover:bg-subtitle/10 cursor-pointer"
              >
                {!showMeaningHint && current.translation ? "Hint" : "Reveal letter"}
              </button>
            </div>
            <button
              type="submit"
              disabled={!typed.trim()}
              className="btn btn-primary flex-1 sm:flex-initial min-h-12 px-6 text-sm sm:text-base font-bold cursor-pointer disabled:opacity-50"
            >
              Check Spelling
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
                  ? `Exact spelling! "${current.text}"`
                  : `Correct spelling: "${current.text}"`}
              </p>
              <p dir="auto" className="text-xs text-muted mt-0.5">
                {current.translation}
              </p>
            </div>
            <button
              type="button"
              autoFocus
              onClick={handleNext}
              className="btn btn-primary min-h-11 px-5 text-sm font-bold cursor-pointer shrink-0"
            >
              {index + 1 >= words.length ? "Continue →" : "Next word →"}
            </button>
          </div>
        )}
      </form>
    </section>
  );
}

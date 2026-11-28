"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { canSpeak, speak } from "@/lib/speech";
import { usePartOfSpeech } from "@/lib/pos-lookup";
import { playKeyClickSound } from "@/lib/typing-sound";
import type { Word } from "@/lib/schemas";
import { SpeakerIcon, TrashIcon } from "@/components/Icons";

function normalizeTyped(value: string): string {
  return value
    .trim()
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")
    .toLowerCase();
}

function stripArabicAlPrefix(value: string): string {
  return value
    .split(/\s+/)
    .map((tok) => (tok.startsWith("ال") && tok.length > 3 ? tok.slice(2) : tok))
    .join(" ");
}

function getTranslationCandidates(translation: string): string[] {
  const full = normalizeTyped(translation);
  const parts = translation
    .split(/[,،;/]+/)
    .map((p) => normalizeTyped(p))
    .filter(Boolean);
  return Array.from(new Set(full ? [full, ...parts] : parts));
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
  promptMode = "word",
  roundLabel = "Round 3 · Typing Recall",
  onToggleTypos,
  onEditWord,
  onDeleteWord,
  onComplete,
}: {
  words: Word[];
  allowSimpleTypos: boolean;
  promptMode?: "word" | "translation";
  roundLabel?: string;
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
  const [checking, setChecking] = useState(false);
  const [hintLevel, setHintLevel] = useState(0);
  const [feedbackReason, setFeedbackReason] = useState("");
  const [results, setResults] = useState<Record<string, boolean>>({});

  const current = words[index];
  const partOfSpeech = usePartOfSpeech(current);

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

  const handleNext = () => {
    if (index + 1 >= words.length) {
      onComplete(results);
    } else {
      setTyped("");
      setHintLevel(0);
      setFeedbackReason("");
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (checked !== "idle" || checking || !typed.trim()) return;

    const cleanTyped = normalizeTyped(typed);
    let ok = false;
    let reason = "";

    if (promptMode === "translation") {
      const typedNoAl = stripArabicAlPrefix(cleanTyped);
      const candidates = getTranslationCandidates(current.translation);
      ok = candidates.some((cand) => {
        const candNoAl = stripArabicAlPrefix(cand);
        if (cleanTyped === cand || typedNoAl === candNoAl) return true;
        return (
          allowSimpleTypos &&
          candNoAl.length >= 4 &&
          levenshtein(typedNoAl, candNoAl) <= 1
        );
      });

      if (!ok) {
        setChecking(true);
        try {
          const res = await fetch("/api/learn/evaluate-translation", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              word: current.text,
              expectedTranslation: current.translation,
              userTranslation: typed.trim(),
              srcLang: current.src_lang || "en",
              targetLang: current.target_lang || "ar",
              allowSimpleTypos,
            }),
          });
          if (res.ok) {
            const data = (await res.json()) as { isCorrect?: boolean; reason?: string };
            ok = Boolean(data.isCorrect);
            reason = data.reason || "";
          }
        } catch {
          // Keep local fallback result
        } finally {
          setChecking(false);
        }
      }
    } else {
      const cleanTarget = normalizeTyped(current.text);
      const isExact = cleanTyped === cleanTarget;
      const isNearTypo =
        allowSimpleTypos && cleanTarget.length >= 4 && levenshtein(cleanTyped, cleanTarget) <= 1;
      ok = isExact || isNearTypo;
    }

    if (!ok) playKeyClickSound("error");
    setFeedbackReason(reason);
    setChecked(ok ? "correct" : "wrong");
    const nextResults = { ...results, [current.id]: ok };
    setResults(nextResults);
  };

  const handleDontKnow = () => {
    if (checked !== "idle" || checking) return;
    setFeedbackReason("");
    setChecked("wrong");
    setResults((prev) => ({ ...prev, [current.id]: false }));
  };

  const handleHint = () => {
    if (checked !== "idle" || checking) return;
    if (promptMode === "translation") {
      setHintLevel((h) => Math.min(2, h + 1));
      inputRef.current?.focus();
      return;
    }
    const cleanTarget = normalizeTyped(current.text);
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
        <div className="flex flex-wrap items-center gap-2.5 min-w-0">
          <p dir="auto" className="text-lg sm:text-2xl font-bold text-ink break-words">
            {promptMode === "translation" ? current.text : current.translation}
          </p>
          {partOfSpeech ? (
            <span className="rounded-full border border-line bg-black/[0.03] dark:bg-white/[0.05] px-2.5 py-0.5 text-xs font-semibold text-muted capitalize">
              {partOfSpeech}
            </span>
          ) : null}
        </div>
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

      {hintLevel > 0 && checked === "idle" && promptMode === "translation" ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-center">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-subtitle me-2">
            Hint:
          </span>
          <span dir="auto" className="text-sm font-bold text-ink">
            {hintLevel === 1 && current.sentence
              ? current.sentence
              : `${Array.from(current.translation.trim()).slice(0, Math.min(3, Math.ceil(current.translation.trim().length / 2))).join("")}…`}
          </span>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="grid gap-3">
        {promptMode === "translation" ? (
          <input
            ref={inputRef}
            type="text"
            dir="auto"
            value={typed}
            disabled={checked !== "idle"}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onChange={(e) => {
              const nextVal = e.target.value;
              playKeyClickSound(nextVal.length < typed.length ? "backspace" : "key");
              setTyped(nextVal);
            }}
            placeholder="Write the translation…"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Write the translation"
            className="w-full min-h-14 rounded-2xl border border-line border-b-2 border-b-subtitle bg-subtitle/10 px-4 py-3 text-center text-lg sm:text-xl font-bold text-ink placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-amber-500/80 transition-all"
          />
        ) : (
          <>
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
          </>
        )}

        {checked === "idle" ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={checking}
                onClick={handleDontKnow}
                className="btn btn-quiet min-h-11 px-4 text-xs sm:text-sm font-semibold text-muted hover:text-ink cursor-pointer disabled:opacity-50"
              >
                I don&apos;t know
              </button>
              <button
                type="button"
                disabled={checking}
                onClick={handleHint}
                className="btn btn-quiet min-h-11 px-3.5 text-xs sm:text-sm font-semibold text-amber-700 dark:text-subtitle hover:bg-subtitle/10 cursor-pointer disabled:opacity-50"
              >
                Hint
              </button>
            </div>
            <button
              type="submit"
              disabled={checking || !typed.trim()}
              className="btn btn-primary flex-1 sm:flex-initial min-h-12 px-6 text-sm sm:text-base font-bold cursor-pointer disabled:opacity-50"
            >
              {checking ? "Checking…" : "Check"}
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
                  ? `Correct! "${promptMode === "translation" ? current.translation : current.text}"`
                  : `${promptMode === "translation" ? "Correct translation" : "Correct word"}: "${promptMode === "translation" ? current.translation : current.text}"`}
              </p>
              {feedbackReason ? (
                <p className="text-xs text-muted mt-1">{feedbackReason}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setTyped("");
                  setFeedbackReason("");
                  setChecked("idle");
                  window.setTimeout(() => inputRef.current?.focus(), 0);
                }}
                className="btn min-h-11 px-4 text-sm font-semibold cursor-pointer"
              >
                Rewrite
              </button>
              <button
                type="button"
                autoFocus
                onClick={handleNext}
                className="btn btn-primary min-h-11 px-5 text-sm font-bold cursor-pointer"
              >
                {index + 1 >= words.length ? "Finish Review →" : "Next word →"}
              </button>
            </div>
          </div>
        )}
      </form>
    </section>
  );
}

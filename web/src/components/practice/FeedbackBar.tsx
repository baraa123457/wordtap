"use client";

import { useEffect, useRef } from "react";
import { canSpeak, speak } from "@/lib/speech";
import { SpeakerIcon } from "../Icons";
import type { Phase } from "./types";

type Props = {
  phase: Phase;
  /** Correct answer, shown after a wrong or almost-right answer. */
  answer: string;
  sentence?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  canCheck: boolean;
  onCheck: () => void;
  onSkip: () => void;
  onContinue: (difficulty?: "hard" | "medium" | "easy") => void;
};

const TONE: Record<Phase, string> = {
  answering: "bg-surface border-line",
  correct: "bg-ok-soft border-ok",
  typo: "bg-ok-soft border-ok",
  wrong: "bg-bad-soft border-bad",
};

export function FeedbackBar({
  phase,
  answer,
  sentence,
  sourceUrl,
  sourceTitle,
  canCheck,
  onCheck,
  onSkip,
  onContinue,
}: Props) {
  const continueRef = useRef<HTMLButtonElement>(null);
  const checkRef = useRef<HTMLButtonElement>(null);

  // Focus Continue/Easy button whenever feedback appears
  useEffect(() => {
    if (phase === "wrong" || phase === "typo" || phase === "correct") {
      continueRef.current?.focus();
    }
  }, [phase]);

  // Once an option is picked, focus lands on Check so Enter submits.
  useEffect(() => {
    if (phase === "answering" && canCheck && document.activeElement?.tagName !== "INPUT") {
      checkRef.current?.focus();
    }
  }, [phase, canCheck]);

  // Keyboard shortcuts when correct:
  // 1 or H -> Hard
  // 2 or M or Space or Enter -> Medium
  // 3 or E -> Easy
  useEffect(() => {
    if (phase !== "correct") return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "1" || e.key.toLowerCase() === "h") {
        e.preventDefault();
        onContinue("hard");
      } else if (e.key === "2" || e.key.toLowerCase() === "m" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onContinue("medium");
      } else if (e.key === "3" || e.key.toLowerCase() === "e") {
        e.preventDefault();
        onContinue("easy");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, onContinue]);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 border-t-2 z-40 transition-colors duration-150 ${TONE[phase]}`}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-4 px-4 py-4 min-h-[5.5rem]">
        {phase === "answering" ? (
          <>
            <button type="button" className="btn btn-quiet" onClick={onSkip}>
              I don&apos;t know
            </button>
            <button
              ref={checkRef}
              type="button"
              className="btn btn-primary min-w-36"
              disabled={!canCheck}
              onClick={onCheck}
            >
              Check
            </button>
          </>
        ) : phase === "correct" ? (
          /* CORRECT: Prompt user self-rating (Hard = practice again, Easy = advance) */
          <div role="status" aria-live="polite" className="flex flex-wrap items-center justify-between gap-3 text-ok-ink w-full">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ok text-white font-bold text-xl shadow-sm">
                ✓
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold tracking-tight">Correct</p>
                <p className="text-xs text-ok-ink/80 font-medium">Was this easy, medium, or hard?</p>
              </div>
            </div>

            {/* Difficulty Rating Buttons: Hard, Medium, Easy */}
            <div className="flex items-center gap-2 sm:gap-2.5">
              <button
                type="button"
                onClick={() => onContinue("hard")}
                title="Mark as Hard (will practice again this session) [1 or H]"
                className="btn min-h-10 px-3 sm:px-3.5 py-2 text-xs sm:text-sm font-semibold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <span>😓 Hard</span>
                <span className="hidden sm:inline text-[11px] text-muted">(Practice more)</span>
              </button>

              <button
                ref={continueRef}
                type="button"
                onClick={() => onContinue("medium")}
                title="Mark as Medium (advance schedule standard) [2, M, or Enter]"
                className="btn btn-primary min-h-10 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-bold shadow-sm transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
              >
                <span>👌 Medium</span>
                <span className="text-[11px] opacity-80">(Continue ↵)</span>
              </button>

              <button
                type="button"
                onClick={() => onContinue("easy")}
                title="Mark as Easy (mastered, advance faster) [3 or E]"
                className="btn min-h-10 px-3 sm:px-3.5 py-2 text-xs sm:text-sm font-semibold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <span>⚡ Easy</span>
                <span className="hidden sm:inline text-[11px] text-muted">(Mastered)</span>
              </button>
            </div>
          </div>
        ) : (
          /* WRONG or TYPO: Keep continue button so learner can review mistake */
          <>
            <div role="status" aria-live="polite" className={phase === "wrong" ? "text-bad-ink" : "text-ok-ink"}>
              <p className="text-lg font-bold">
                {phase === "typo" ? "Almost: watch the spelling" : "Not quite"}
              </p>
              <p className="text-ink flex items-center gap-2">
                <span className="text-muted">Answer: </span>
                <strong dir="auto">{answer}</strong>
                {canSpeak() ? (
                  <button
                    type="button"
                    aria-label={`Hear “${answer}”`}
                    title={`Pronounce “${answer}”`}
                    className="p-1 rounded-full text-muted hover:text-ink cursor-pointer"
                    onClick={() => {
                      const hasAr = /[\u0600-\u06FF]/.test(answer);
                      speak(answer, hasAr ? "ar" : "en");
                    }}
                  >
                    <SpeakerIcon size={16} />
                  </button>
                ) : null}
              </p>
              {sentence ? (
                <p className="text-xs text-muted max-w-lg italic mt-1 line-clamp-2" dir="auto">
                  “{sentence}”
                </p>
              ) : null}
              {sourceUrl ? (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-subtitle-edge dark:text-subtitle font-semibold hover:underline inline-flex items-center gap-1 mt-0.5"
                >
                  Watch scene from {sourceTitle || "video"} ↗
                </a>
              ) : null}
            </div>
            <button
              ref={continueRef}
              type="button"
              className={`btn min-w-36 ${phase === "wrong" ? "btn-bad" : "btn-ok"}`}
              onClick={() => onContinue()}
            >
              Continue
            </button>
          </>
        )}
      </div>
    </div>
  );
}

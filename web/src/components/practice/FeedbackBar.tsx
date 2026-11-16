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
  answering: "bg-surface/90 border-line",
  correct: "bg-ok-soft/95 border-ok/40",
  typo: "bg-ok-soft/95 border-ok/40",
  wrong: "bg-bad-soft/95 border-bad/40",
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
      className={`fixed inset-x-0 bottom-0 border-t z-40 transition-colors duration-200 apple-glass ${TONE[phase]}`}
    >
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:py-3.5 min-h-[4.5rem]">
        {phase === "answering" ? (
          <div className="flex items-center justify-between gap-3 w-full">
            <button type="button" className="btn btn-quiet min-h-9 sm:min-h-10 px-3 sm:px-4 text-xs sm:text-sm" onClick={onSkip}>
              I don&apos;t know
            </button>
            <button
              ref={checkRef}
              type="button"
              className="btn btn-primary min-h-9 sm:min-h-10 min-w-28 sm:min-w-36 text-xs sm:text-sm font-bold shadow-sm"
              disabled={!canCheck}
              onClick={onCheck}
            >
              Check
            </button>
          </div>
        ) : phase === "correct" ? (
          /* CORRECT: Apple HIG inline toolbar with status on leading side and rating group on trailing side */
          <div role="status" aria-live="polite" className="flex items-center justify-between gap-2 sm:gap-4 text-ok-ink w-full">
            <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full bg-ok text-white font-bold text-lg sm:text-xl shadow-xs">
                ✓
              </div>
              <div>
                <p className="text-lg sm:text-xl font-bold tracking-tight leading-tight">Correct</p>
                <p className="hidden sm:block text-xs text-ok-ink/80 font-medium">Rate recall</p>
              </div>
            </div>

            {/* Apple HIG Segmented Rating Controls (Hard / Medium / Easy) on same baseline */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onContinue("hard")}
                title="Mark as Hard — practice again this session [Key: 1 or H]"
                className="btn min-h-9 sm:min-h-10 px-2.5 sm:px-3.5 py-1.5 text-xs sm:text-sm font-semibold shadow-2xs transition-all flex items-center gap-1 cursor-pointer active:scale-95"
              >
                <span>😓 Hard</span>
              </button>

              <button
                ref={continueRef}
                type="button"
                onClick={() => onContinue("medium")}
                title="Mark as Medium — advance schedule normally [Key: 2, M, or Enter]"
                className="btn btn-primary min-h-9 sm:min-h-10 px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-bold shadow-sm transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
              >
                <span>👌 Medium</span>
                <span className="text-[10px] sm:text-xs opacity-80">↵</span>
              </button>

              <button
                type="button"
                onClick={() => onContinue("easy")}
                title="Mark as Easy — mastered, advance faster [Key: 3 or E]"
                className="btn min-h-9 sm:min-h-10 px-2.5 sm:px-3.5 py-1.5 text-xs sm:text-sm font-semibold shadow-2xs transition-all flex items-center gap-1 cursor-pointer active:scale-95"
              >
                <span>⚡ Easy</span>
              </button>
            </div>
          </div>
        ) : (
          /* WRONG or TYPO: Single baseline layout with Answer and Continue button */
          <div role="status" aria-live="polite" className="flex items-center justify-between gap-3 w-full min-w-0">
            <div className={`min-w-0 flex-1 ${phase === "wrong" ? "text-bad-ink" : "text-ok-ink"}`}>
              <p className="text-base sm:text-lg font-bold leading-tight">
                {phase === "typo" ? "Almost: watch the spelling" : "Not quite"}
              </p>
              <div className="text-ink flex items-center gap-2 mt-0.5 text-sm sm:text-base">
                <span className="text-muted text-xs sm:text-sm shrink-0">Answer: </span>
                <strong dir="auto" className="font-bold truncate">{answer}</strong>
                {canSpeak() ? (
                  <button
                    type="button"
                    aria-label={`Hear “${answer}”`}
                    title={`Pronounce “${answer}”`}
                    className="p-1 rounded-full text-muted hover:text-ink cursor-pointer shrink-0"
                    onClick={() => {
                      const hasAr = /[\u0600-\u06FF]/.test(answer);
                      speak(answer, hasAr ? "ar" : "en");
                    }}
                  >
                    <SpeakerIcon size={16} />
                  </button>
                ) : null}
              </div>
              {sentence ? (
                <p className="text-xs text-muted max-w-lg italic mt-0.5 line-clamp-1" dir="auto">
                  “{sentence}”
                </p>
              ) : null}
              {sourceUrl ? (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-subtitle-edge dark:text-subtitle font-semibold hover:underline inline-flex items-center gap-1 mt-0.5 truncate max-w-xs"
                >
                  Watch scene from {sourceTitle || "video"} ↗
                </a>
              ) : null}
            </div>
            <button
              ref={continueRef}
              type="button"
              className={`btn shrink-0 min-h-9 sm:min-h-10 min-w-28 sm:min-w-36 text-xs sm:text-sm font-bold shadow-sm ${phase === "wrong" ? "btn-bad" : "btn-ok"}`}
              onClick={() => onContinue()}
            >
              Continue ↵
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

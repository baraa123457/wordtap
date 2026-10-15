"use client";

import { useEffect, useRef, useState } from "react";
import type { Phase } from "./types";

type Props = {
  phase: Phase;
  /** Correct answer, shown after a wrong or almost-right answer. */
  answer: string;
  canCheck: boolean;
  onCheck: () => void;
  onSkip: () => void;
  onContinue: () => void;
};

const TONE: Record<Phase, string> = {
  answering: "bg-surface border-line",
  correct: "bg-ok-soft border-ok",
  typo: "bg-ok-soft border-ok",
  wrong: "bg-bad-soft border-bad",
};

export function FeedbackBar({ phase, answer, canCheck, onCheck, onSkip, onContinue }: Props) {
  const continueRef = useRef<HTMLButtonElement>(null);
  const checkRef = useRef<HTMLButtonElement>(null);
  const [isExiting, setIsExiting] = useState(false);

  // When correct: NO continue button! Show "Correct" and exit with animation after 1s.
  useEffect(() => {
    if (phase !== "correct") {
      setIsExiting(false);
      return;
    }

    setIsExiting(false);
    // At 750ms trigger the slideDown animation (duration 240ms), then at 1000ms advance
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
    }, 750);

    const advanceTimer = setTimeout(() => {
      onContinue();
    }, 1000);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(advanceTimer);
    };
  }, [phase, onContinue]);

  // Keep keyboard flow: Enter on wrong or typo moves focus to Continue
  useEffect(() => {
    if (phase === "wrong" || phase === "typo") {
      continueRef.current?.focus();
    }
  }, [phase]);

  // Once an option is picked, focus lands on Check so Enter submits.
  useEffect(() => {
    if (phase === "answering" && canCheck && document.activeElement?.tagName !== "INPUT") {
      checkRef.current?.focus();
    }
  }, [phase, canCheck]);

  // If user presses Enter while "Correct" is shown, advance immediately
  useEffect(() => {
    if (phase !== "correct") return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Enter") {
        e.preventDefault();
        onContinue();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, onContinue]);

  const animationClass =
    phase === "correct"
      ? isExiting
        ? "feedback-exit"
        : "feedback-enter"
      : "";

  return (
    <div
      className={`fixed inset-x-0 bottom-0 border-t-2 z-40 transition-colors duration-150 ${TONE[phase]} ${animationClass}`}
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
          /* CORRECT: NO CONTINUE BUTTON AT ALL! Just animated checkmark, "Correct", and 1s exit */
          <div role="status" aria-live="polite" className="flex items-center gap-3 text-ok w-full justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ok text-white font-bold text-xl shadow-sm">
                ✓
              </div>
              <p className="text-2xl font-bold tracking-tight">Correct</p>
            </div>
            {/* Subtle animated indicator for the 1s auto-advance */}
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-ok/25">
              <div className="h-full bg-ok animate-pulse" />
            </div>
          </div>
        ) : (
          /* WRONG or TYPO: Keep continue button so learner can review mistake */
          <>
            <div role="status" aria-live="polite" className={phase === "wrong" ? "text-bad" : "text-ok"}>
              <p className="text-lg font-bold">
                {phase === "typo" ? "Almost: watch the spelling" : "Not quite"}
              </p>
              <p className="text-ink">
                <span className="text-muted">Answer: </span>
                <strong dir="auto">{answer}</strong>
              </p>
            </div>
            <button
              ref={continueRef}
              type="button"
              className={`btn min-w-36 ${phase === "wrong" ? "btn-bad" : "btn-ok"}`}
              onClick={onContinue}
            >
              Continue
            </button>
          </>
        )}
      </div>
    </div>
  );
}

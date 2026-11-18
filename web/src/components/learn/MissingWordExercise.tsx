"use client";

import { useMemo, useRef, useState } from "react";
import {
  buildProgressiveHint,
  validateMissingWordAnswer,
  type MaskedSentence,
} from "@/lib/placeholder";
import { canSpeak, speak } from "@/lib/speech";
import { SpeakerIcon } from "@/components/Icons";
import type { CaptionCue } from "@/lib/video/types";
import { ContextCaption } from "./ContextCaption";

export function MissingWordExercise({
  masked,
  fullSentence,
  targetWord,
  srcLang,
  captionLabel,
  captionCues,
  currentTimeSec,
  isVideoMode,
  hasMoreExamples,
  onReplay,
  onNextExample,
  onSolved,
  onContinue,
}: {
  masked: MaskedSentence;
  fullSentence: string;
  targetWord: string;
  srcLang: string;
  captionLabel: string;
  captionCues?: CaptionCue[];
  currentTimeSec?: number;
  isVideoMode: boolean;
  hasMoreExamples: boolean;
  onReplay?: () => void;
  onNextExample?: () => void;
  onSolved: (details: { hiddenWord: string; attempts: number; passedFirstTry: boolean }) => void;
  onContinue: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [answer, setAnswer] = useState("");
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [totalSubmits, setTotalSubmits] = useState(0);
  const [state, setState] = useState<"answering" | "wrong" | "correct">("answering");

  const hint = useMemo(
    () => buildProgressiveHint(masked.hiddenWord, wrongAttempts),
    [masked.hiddenWord, wrongAttempts],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer.trim()) return;

    const nextSubmits = totalSubmits + 1;
    setTotalSubmits(nextSubmits);

    const ok = validateMissingWordAnswer(answer, masked.hiddenWord, targetWord);
    if (ok) {
      setState("correct");
      onSolved({
        hiddenWord: masked.hiddenWord,
        attempts: nextSubmits,
        passedFirstTry: wrongAttempts === 0,
      });
    } else {
      setWrongAttempts((a) => a + 1);
      setState("wrong");
      inputRef.current?.focus();
    }
  };

  return (
    <div
      data-testid="stage2-caption-exercise"
      className="rounded-2xl border border-line bg-surface p-4 sm:p-5 grid gap-4"
    >
      <ContextCaption
        masked={masked}
        targetWord={targetWord}
        revealed={state === "correct"}
        hint={hint}
        captionCues={captionCues}
        currentTimeSec={currentTimeSec}
        label={
          state === "correct"
            ? isVideoMode
              ? "Verified video caption (target word highlighted):"
              : "Complete context sentence (target word highlighted):"
            : captionLabel
        }
      />

      {state !== "correct" ? (
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2.5">
          <input
            ref={inputRef}
            type="text"
            value={answer}
            onChange={(e) => {
              setAnswer(e.target.value);
              if (state === "wrong") setState("answering");
            }}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder={`Type the ${masked.letterCount}-letter word…`}
            aria-label="Type the missing word"
            className="field flex-1 text-base font-semibold"
          />
          <div className="flex items-center gap-2">
            {!isVideoMode && canSpeak() ? (
              <button
                type="button"
                onClick={() => speak(fullSentence, srcLang || "en")}
                aria-label="Listen to sentence audio"
                className="btn min-h-11 px-3.5 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <SpeakerIcon size={15} />
                <span>Listen</span>
              </button>
            ) : null}
            <button
              type="submit"
              disabled={!answer.trim()}
              className="btn btn-primary flex-1 sm:flex-initial min-h-11 px-6 text-sm font-bold cursor-pointer disabled:opacity-50"
            >
              Submit
            </button>
          </div>
        </form>
      ) : null}

      {state === "wrong" ? (
        <div
          role="alert"
          className="rounded-xl border border-bad/30 bg-bad-soft px-3.5 py-2.5 text-xs sm:text-sm text-bad font-medium"
        >
          Not quite! {isVideoMode ? "Replay the video clip" : "Listen again"} and count the dots (
          {masked.letterCount} letters).
          {hint ? (
            <span className="block mt-1 text-ink">
              Hint: <span className="font-mono font-bold tracking-widest">{hint}</span>
            </span>
          ) : null}
        </div>
      ) : null}

      {state === "correct" ? (
        <div
          role="status"
          className="rounded-2xl border border-ok/30 bg-ok/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-150"
        >
          <div>
            <p className="text-sm font-bold text-ok">
              Spot on! &ldquo;{masked.hiddenWord}&rdquo; fits naturally here.
            </p>
            <p className="text-xs text-muted mt-0.5">
              {hasMoreExamples
                ? isVideoMode
                  ? "Replay this clip, explore another verified video example, or continue to Stage 3."
                  : "Try another context sentence or continue to Stage 3."
                : "Now write your own original sentence in Stage 3."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {isVideoMode && onReplay ? (
              <button
                type="button"
                onClick={onReplay}
                className="btn min-h-10 px-3.5 text-xs sm:text-sm font-semibold cursor-pointer"
              >
                ↺ Replay
              </button>
            ) : null}
            {hasMoreExamples && onNextExample ? (
              <button
                type="button"
                onClick={onNextExample}
                className="btn min-h-10 px-3.5 text-xs sm:text-sm font-semibold cursor-pointer"
              >
                {isVideoMode ? "Next video →" : "Another example →"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onContinue}
              className="btn btn-primary min-h-10 px-5 text-xs sm:text-sm font-bold cursor-pointer"
            >
              Continue to Stage 3 →
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

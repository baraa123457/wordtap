"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  analyzeAnswerFaults,
  buildProgressiveHint,
  validateMissingWordAnswer,
  type MaskedSentence,
} from "@/lib/placeholder";
import { canSpeak, speak } from "@/lib/speech";
import { playKeyClickSound } from "@/lib/typing-sound";
import { LightbulbIcon, SpeakerIcon } from "@/components/Icons";
import type { CaptionCue } from "@/lib/video/types";
import { ContextCaption } from "./ContextCaption";

export function MissingWordExercise({
  masked,
  fullSentence,
  targetWord,
  srcLang,
  targetLang,
  sourceTitle,
  sourceUrl,
  captionLabel,
  captionCues,
  currentTimeSec,
  isVideoMode,
  hasMoreExamples,
  onWordLookupOpen,
  onReplay,
  onNextExample,
  onSolved,
  onContinue,
}: {
  masked: MaskedSentence;
  fullSentence: string;
  targetWord: string;
  srcLang: string;
  targetLang?: string;
  sourceTitle?: string;
  sourceUrl?: string;
  captionLabel: string;
  captionCues?: CaptionCue[];
  currentTimeSec?: number;
  isVideoMode: boolean;
  hasMoreExamples: boolean;
  onWordLookupOpen?: () => void;
  onReplay?: () => void;
  onNextExample?: () => void;
  onSolved: (details: { hiddenWord: string; attempts: number; passedFirstTry: boolean }) => void;
  onContinue: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [answer, setAnswer] = useState("");
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [hintClicks, setHintClicks] = useState(0);
  const [totalSubmits, setTotalSubmits] = useState(0);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [state, setState] = useState<"answering" | "wrong" | "correct">("answering");

  const hintLevel = wrongAttempts + hintClicks;
  const faultAnalysis = useMemo(
    () => (answer.trim() ? analyzeAnswerFaults(answer, masked.hiddenWord) : null),
    [answer, masked.hiddenWord],
  );

  const hint = useMemo(
    () => buildProgressiveHint(masked.hiddenWord, hintLevel, answer.trim().length),
    [masked.hiddenWord, hintLevel, answer],
  );
  const canShowMoreHint =
    answer.trim().toLowerCase() !== masked.hiddenWord.trim().toLowerCase() &&
    masked.letterCount > 1;

  const handleHintClick = () => {
    setHintClicks((c) => c + 1);

    const target = masked.hiddenWord;
    const current = answer.trim();

    // Find how many characters match target from the start (case-insensitive)
    let matchLen = 0;
    while (
      matchLen < current.length &&
      matchLen < target.length &&
      current[matchLen].toLowerCase() === target[matchLen].toLowerCase()
    ) {
      matchLen++;
    }

    // Give the next letter!
    const nextLen = Math.min(target.length, matchLen + 1);
    const nextAnswer = target.slice(0, nextLen);
    setAnswer(nextAnswer);

    if (inputRef.current) {
      inputRef.current.focus();
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.setSelectionRange(nextAnswer.length, nextAnswer.length);
        }
      }, 0);
    }
  };

  const closenessTip = useMemo(() => {
    const cleanGuess = answer.trim().toLowerCase();
    const cleanTarget = masked.hiddenWord.trim().toLowerCase();
    if (!cleanGuess || !cleanTarget) return null;
    if (cleanTarget.startsWith(cleanGuess) && cleanGuess.length >= Math.max(3, cleanTarget.length - 2)) {
      const missing = cleanTarget.length - cleanGuess.length;
      return `Super close! You're just missing ${missing} ${missing === 1 ? "letter" : "letters"} at the end.`;
    }
    if (cleanGuess.startsWith(cleanTarget) && cleanGuess.length <= cleanTarget.length + 2) {
      const extra = cleanGuess.length - cleanTarget.length;
      return `Super close! Remove ${extra} extra ${extra === 1 ? "letter" : "letters"} at the end.`;
    }
    if (cleanGuess.length !== masked.letterCount) {
      return `You typed ${cleanGuess.length} ${cleanGuess.length === 1 ? "letter" : "letters"}, but the word has ${masked.letterCount} letters.`;
    }
    return "Right length — check the spelling and listen again!";
  }, [answer, masked.hiddenWord, masked.letterCount]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer.trim()) return;

    const nextSubmits = totalSubmits + 1;
    setTotalSubmits(nextSubmits);
    setHasSubmitted(true);

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
      playKeyClickSound("error");
      inputRef.current?.focus();
    }
  };

  useEffect(() => {
    if (state !== "correct") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.repeat) {
        e.preventDefault();
        onContinue();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [state, onContinue]);

  return (
    <div
      data-testid="stage2-caption-exercise"
      className="rounded-2xl border border-line bg-surface p-4 sm:p-5 flex flex-col gap-4 min-w-0 w-full max-w-full"
    >
      <ContextCaption
        masked={masked}
        fullSentence={fullSentence}
        targetWord={targetWord}
        srcLang={srcLang}
        targetLang={targetLang}
        sourceTitle={sourceTitle}
        sourceUrl={sourceUrl}
        revealed={hasSubmitted}
        isCorrect={state === "correct"}
        hint={hint}
        captionCues={captionCues}
        currentTimeSec={currentTimeSec}
        typedAnswer={answer}
        isTypingFocused={isInputFocused}
        onBlankClick={() => {
          playKeyClickSound("key");
          inputRef.current?.focus();
        }}
        onWordLookupOpen={onWordLookupOpen}
        label={
          hasSubmitted
            ? isVideoMode
              ? "Verified video caption (target word highlighted):"
              : "Complete context sentence (target word highlighted):"
            : captionLabel
        }
      />

      {state !== "correct" ? (
        <form onSubmit={handleSubmit} className="flex flex-wrap items-center justify-between gap-2.5">
          <input
            ref={inputRef}
            type="text"
            value={answer}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
            onChange={(e) => {
              const nextVal = e.target.value;
              playKeyClickSound(nextVal.length < answer.length ? "backspace" : "key");
              setAnswer(nextVal);
              if (state === "wrong") setState("answering");
            }}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-label={`Type the ${masked.letterCount}-letter missing word`}
            className="sr-only"
          />
          <span className="text-xs text-muted">
            {isInputFocused
              ? "Typing inline — press Enter or Submit"
              : "Click the highlighted blank above to type"}
          </span>
          <div className="flex flex-wrap items-center gap-2 ml-auto">
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
            {canShowMoreHint || (faultAnalysis && faultAnalysis.hasFault) ? (
              <button
                type="button"
                onClick={handleHintClick}
                aria-label={
                  faultAnalysis?.hasFault
                    ? "Fix fault letter"
                    : "Reveal next hint letter"
                }
                className="btn btn-quiet min-h-11 px-3.5 text-xs font-semibold text-amber-700 dark:text-subtitle border border-subtitle/35 bg-subtitle/10 hover:bg-subtitle/20 cursor-pointer inline-flex items-center gap-1.5"
              >
                <LightbulbIcon size={14} className="text-amber-800 dark:text-subtitle" />
                <span>
                  {faultAnalysis?.hasFault && faultAnalysis?.firstWrongChar
                    ? "Fix fault"
                    : answer.trim().length > 0
                    ? "Next letter (+1)"
                    : hintClicks > 0
                    ? "More hint"
                    : "Hint"}
                </span>
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

      {/* Dynamic Hint & Fault Analysis Display */}
      {state === "answering" && (hint || (faultAnalysis && faultAnalysis.hasFault)) ? (
        <div
          role="status"
          data-testid="missing-word-hint-card"
          className="rounded-xl border border-subtitle/35 bg-subtitle/10 px-3.5 py-3 text-xs sm:text-sm text-ink flex flex-col gap-2.5 shadow-xs"
        >
          {/* Main Hint Line */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <LightbulbIcon size={16} className="text-amber-800 dark:text-subtitle shrink-0" />
              <span>
                <strong className="text-amber-800 dark:text-subtitle">
                  {faultAnalysis?.hasFault && faultAnalysis?.firstWrongChar ? "Fault Hint:" : "Hint:"}
                </strong>{" "}
                {faultAnalysis?.firstWrongChar ? (
                  <span className="font-semibold text-bad">
                    Letter #{faultAnalysis.firstWrongIndex + 1} &ldquo;{faultAnalysis.firstWrongChar}&rdquo; is wrong
                    {faultAnalysis.expectedChar ? ` — change it to “${faultAnalysis.expectedChar}”` : " — remove it"}
                  </span>
                ) : faultAnalysis && faultAnalysis.firstWrongIndex === -1 && answer.trim().length > 0 ? (
                  <span className="font-semibold text-ok">
                    &ldquo;{answer.trim()}&rdquo; is correct so far! Next letter is &ldquo;{faultAnalysis.expectedChar}&rdquo;
                  </span>
                ) : (
                  <span className="font-mono font-bold tracking-[0.18em]">{hint}</span>
                )}
                <span className="text-muted text-xs ms-2">({masked.letterCount} letters)</span>
              </span>
            </div>

            {canShowMoreHint ? (
              <button
                type="button"
                onClick={handleHintClick}
                className="text-xs font-bold text-amber-800 dark:text-subtitle underline underline-offset-4 hover:opacity-80 cursor-pointer shrink-0"
              >
                {answer.trim().length > 0 ? "Add next letter (+1) →" : "Reveal more →"}
              </button>
            ) : null}
          </div>

          {/* Letter-by-letter Diagnosis & Auto-Correction */}
          {faultAnalysis && answer.trim().length > 0 && faultAnalysis.letterFaults.length > 0 ? (
            <div className="pt-2 border-t border-subtitle/25 flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-amber-950 dark:text-amber-200">
                  {faultAnalysis.hasFault ? "Your letters (faults marked in red):" : "Your letters so far:"}
                </span>
                {faultAnalysis.hasFault && faultAnalysis.firstWrongIndex >= 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      const cleanTarget = masked.hiddenWord;
                      const fixedPrefix = cleanTarget.slice(0, faultAnalysis.firstWrongIndex + 1);
                      setAnswer(fixedPrefix);
                      inputRef.current?.focus();
                    }}
                    className="text-[11px] font-bold text-ok hover:underline cursor-pointer bg-ok/10 border border-ok/30 rounded-md px-2 py-0.5"
                  >
                    ✓ Auto-correct to &ldquo;{masked.hiddenWord.slice(0, faultAnalysis.firstWrongIndex + 1)}&rdquo;
                  </button>
                ) : null}
              </div>

              {/* Visual Letter Chips */}
              <div className="flex flex-wrap items-center gap-1.5 font-mono text-sm font-bold">
                {faultAnalysis.letterFaults.map((lf, i) => (
                  <button
                    type="button"
                    key={i}
                    onClick={() => {
                      // Focus input and place cursor right after this character
                      if (inputRef.current) {
                        inputRef.current.focus();
                        inputRef.current.setSelectionRange(lf.index, lf.index + 1);
                      }
                    }}
                    title={
                      lf.status === "correct"
                        ? `Letter #${lf.position} (${lf.char}) is correct`
                        : `Fault letter #${lf.position}: "${lf.char}" is wrong (expected "${lf.expectedChar ?? "none"}")`
                    }
                    className={`flex flex-col items-center justify-center min-w-[30px] h-9 px-1.5 rounded-lg border text-center transition-all cursor-pointer ${
                      lf.status === "correct"
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/35 hover:bg-emerald-500/25"
                        : "bg-bad/20 text-bad border-bad ring-2 ring-bad/20 hover:bg-bad/30"
                    }`}
                  >
                    <span>{lf.char}</span>
                    <span className="text-[9px] leading-none font-sans font-normal opacity-70">
                      {lf.status === "correct" ? "✓" : "✗"}
                    </span>
                  </button>
                ))}

                {/* Remaining dots for untyped letters */}
                {Array.from({ length: Math.max(0, masked.letterCount - answer.trim().length) }).map((_, i) => (
                  <div
                    key={`dot-${i}`}
                    className="flex flex-col items-center justify-center w-7 h-9 rounded-lg border border-line bg-surface text-muted text-xs font-mono"
                  >
                    <span>·</span>
                    <span className="text-[9px] leading-none opacity-40 font-sans">
                      {answer.trim().length + i + 1}
                    </span>
                  </div>
                ))}
              </div>

              {faultAnalysis.summary ? (
                <p className="text-xs font-medium text-amber-900 dark:text-amber-200">
                  {faultAnalysis.summary}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {state === "wrong" ? (
        <div
          role="alert"
          className="rounded-xl border border-bad/30 bg-bad-soft px-3.5 py-2.5 text-xs sm:text-sm text-bad-ink font-medium grid gap-2"
        >
          <p>
            Not quite! {faultAnalysis?.summary || closenessTip || `${isVideoMode ? "Replay the video clip" : "Listen again"} and count the dots (${masked.letterCount} letters).`}
          </p>

          {/* Fault Letters Breakdown in Alert */}
          {faultAnalysis && faultAnalysis.letterFaults.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5 font-mono text-sm font-bold pt-1">
              {faultAnalysis.letterFaults.map((lf, i) => (
                <div
                  key={i}
                  className={`flex flex-col items-center justify-center min-w-[28px] h-8 px-1 rounded-md border text-center ${
                    lf.status === "correct"
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/35"
                      : "bg-bad/25 text-bad border-bad font-extrabold"
                  }`}
                >
                  <span>{lf.char}</span>
                  <span className="text-[8px] leading-none font-sans opacity-70">
                    {lf.status === "correct" ? "✓" : "✗"}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {hint ? (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 text-ink">
              <span>
                <strong className="text-amber-800 dark:text-subtitle">Hint:</strong>{" "}
                <span className="font-mono font-bold tracking-[0.18em]">{hint}</span>
                <span className="text-muted text-xs ms-2">({masked.letterCount} letters)</span>
              </span>
              {canShowMoreHint ? (
                <button
                  type="button"
                  onClick={() => {
                    setHintClicks((c) => c + 1);
                    inputRef.current?.focus();
                  }}
                  className="text-xs font-bold text-amber-800 dark:text-subtitle underline underline-offset-4 hover:opacity-80 cursor-pointer"
                >
                  Show another letter →
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {state === "correct" ? (
        <div
          role="status"
          className="rounded-2xl border border-emerald-500/35 bg-emerald-500/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-150"
        >
          <div>
            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
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
                {isVideoMode ? "Next clip →" : "Another example →"}
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

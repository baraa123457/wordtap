"use client";

import { useEffect, useState } from "react";
import type { Word } from "@/lib/schemas";
import {
  fetchUnderstandingQuestion,
  type UnderstandingQuestion,
} from "@/lib/learn-api";
import { canSpeak, speak } from "@/lib/speech";
import { SpeakerIcon } from "@/components/Icons";

export function Stage1Understanding({
  word,
  onComplete,
}: {
  word: Word;
  onComplete: (result: {
    passedFirstTry: boolean;
    selectedAnswer: string;
    definition: string;
    pronunciation: string;
    partOfSpeech: string;
  }) => void;
}) {
  const [question, setQuestion] = useState<UnderstandingQuestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<"A" | "B" | "C" | "D" | null>(null);
  const [status, setStatus] = useState<"answering" | "wrong" | "correct">("answering");
  const [hadWrongAttempt, setHadWrongAttempt] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    setSelectedId(null);
    setStatus("answering");
    try {
      const q = await fetchUnderstandingQuestion(word);
      setQuestion(q);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load meaning question.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word.id]);

  const handleSelect = (id: "A" | "B" | "C" | "D") => {
    if (!question || status === "correct") return;
    setSelectedId(id);
    if (id === question.correctOptionId) {
      setStatus("correct");
    } else {
      setStatus("wrong");
      setHadWrongAttempt(true);
    }
  };

  const handleRetry = () => {
    setSelectedId(null);
    setStatus("answering");
  };

  // Keyboard shortcuts (1-4 or A-D to select, Enter to continue when correct)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!question) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const key = e.key.toUpperCase();
      if (status !== "correct") {
        if (key === "1" || key === "A") handleSelect("A");
        else if (key === "2" || key === "B") handleSelect("B");
        else if (key === "3" || key === "C") handleSelect("C");
        else if (key === "4" || key === "D") handleSelect("D");
      } else if (e.key === "Enter" && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        const correctOpt = question.options.find((o) => o.id === question.correctOptionId);
        onComplete({
          passedFirstTry: !hadWrongAttempt,
          selectedAnswer: correctOpt?.text || question.definition,
          definition: question.definition,
          pronunciation: question.pronunciation,
          partOfSpeech: question.partOfSpeech,
        });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question, status, hadWrongAttempt]);

  if (loading) {
    return (
      <div className="apple-card p-6 sm:p-8 grid gap-4 animate-pulse">
        <div className="h-4 w-36 rounded bg-line/60" />
        <div className="h-9 w-52 rounded-xl bg-line/60" />
        <div className="grid gap-3 pt-2">
          <div className="h-14 rounded-2xl bg-line/40" />
          <div className="h-14 rounded-2xl bg-line/40" />
          <div className="h-14 rounded-2xl bg-line/40" />
          <div className="h-14 rounded-2xl bg-line/40" />
        </div>
      </div>
    );
  }

  if (error || !question) {
    return (
      <div className="apple-card p-6 text-center grid gap-4">
        <p className="text-sm text-bad font-medium">{error || "Question unavailable."}</p>
        <div className="flex justify-center gap-3">
          <button type="button" onClick={() => void load()} className="btn btn-primary px-5">
            Try again
          </button>
        </div>
      </div>
    );
  }

  const correctOption = question.options.find((o) => o.id === question.correctOptionId);

  return (
    <section aria-labelledby="stage1-heading" className="apple-card w-full max-w-full p-4 sm:p-8 flex flex-col gap-5 sm:gap-6 min-w-0">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5 min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-subtitle/20 border border-subtitle/30 px-3 py-0.5 text-xs font-bold text-ink">
            Stage 1 · Understanding
          </span>
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <h2
              id="stage1-heading"
              dir="auto"
              className="text-2xl sm:text-4xl font-extrabold tracking-tight text-ink uppercase break-words"
            >
              {word.text}
            </h2>
            {canSpeak() ? (
              <button
                type="button"
                onClick={() => speak(word.text, word.src_lang || "en")}
                aria-label={`Pronounce ${word.text}`}
                className="btn btn-quiet w-11 h-11 min-h-11 p-0 rounded-full flex items-center justify-center cursor-pointer"
              >
                <SpeakerIcon size={18} />
              </button>
            ) : null}
          </div>
          {status === "correct" && (question.pronunciation || question.partOfSpeech) ? (
            <p className="text-xs sm:text-sm text-muted">
              {question.partOfSpeech ? (
                <span className="font-semibold capitalize">{question.partOfSpeech}</span>
              ) : null}
              {question.partOfSpeech && question.pronunciation ? " · " : ""}
              {question.pronunciation ? <span className="font-mono">{question.pronunciation}</span> : null}
            </p>
          ) : null}
        </div>
      </div>

      {/* Prompt */}
      <p className="text-base sm:text-lg font-semibold text-ink">{question.question}</p>

      {/* Options */}
      <div className="grid gap-2.5 sm:gap-3" role="radiogroup" aria-label={question.question}>
        {question.options.map((opt) => {
          const isSelected = selectedId === opt.id;
          const isCorrect = opt.id === question.correctOptionId;

          let cardStyle =
            "border-line bg-surface hover:border-subtitle hover:bg-black/[0.02] dark:hover:bg-white/[0.04]";
          let badgeStyle = "bg-black/5 dark:bg-white/10 text-muted";

          if (status === "correct" && isCorrect) {
            cardStyle = "border-ok bg-ok/10 text-ink ring-1 ring-ok/30";
            badgeStyle = "bg-ok text-white";
          } else if (status === "wrong" && isSelected) {
            cardStyle = "border-bad bg-bad-soft text-ink ring-1 ring-bad/30";
            badgeStyle = "bg-bad text-white";
          }

          return (
            <div
              key={opt.id}
              role="radio"
              tabIndex={status === "correct" ? -1 : 0}
              aria-checked={isSelected}
              aria-disabled={status === "correct" || undefined}
              onClick={() => {
                if (status === "correct") return;
                if (typeof window !== "undefined" && window.getSelection()?.toString().trim()) return;
                handleSelect(opt.id);
              }}
              onKeyDown={(e) => {
                if (status !== "correct" && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  handleSelect(opt.id);
                }
              }}
              className={`flex items-start gap-3.5 rounded-2xl border p-3.5 sm:p-4 text-start transition-all select-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-subtitle ${
                status === "correct" ? "cursor-text" : "cursor-pointer"
              } ${cardStyle}`}
            >
              <span
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${badgeStyle}`}
              >
                {opt.id}
              </span>
              <span className="text-sm sm:text-base font-medium leading-snug text-ink pt-0.5 break-words min-w-0 select-text">
                {opt.text}
              </span>
            </div>
          );
        })}
      </div>

      {/* Immediate Feedback */}
      {status === "wrong" ? (
        <div
          role="alert"
          className="rounded-2xl border border-bad/30 bg-bad-soft p-4 grid gap-3 animate-in fade-in duration-150"
        >
          <div className="space-y-1">
            <p className="text-sm font-bold text-bad-ink">Not quite — here&apos;s what it means:</p>
            <p className="text-sm text-ink leading-relaxed break-words">{question.explanation}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleRetry}
              className="btn btn-primary min-h-10 px-5 text-sm font-bold cursor-pointer"
            >
              Try again
            </button>
          </div>
        </div>
      ) : null}

      {status === "correct" ? (
        <div
          role="status"
          className="rounded-2xl border border-ok/30 bg-ok/10 p-4 grid gap-3 animate-in fade-in duration-150"
        >
          <div className="space-y-1">
            <p className="text-sm font-bold text-ok">Correct! You understand this word.</p>
            <p className="text-sm text-ink leading-relaxed">{question.explanation}</p>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() =>
                onComplete({
                  passedFirstTry: !hadWrongAttempt,
                  selectedAnswer: correctOption?.text || question.definition,
                  definition: question.definition,
                  pronunciation: question.pronunciation,
                  partOfSpeech: question.partOfSpeech,
                })
              }
              className="btn btn-primary w-full sm:w-auto min-h-11 px-6 text-sm sm:text-base font-bold cursor-pointer"
            >
              Continue to Real Videos →
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

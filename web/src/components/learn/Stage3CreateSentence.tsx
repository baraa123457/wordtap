"use client";

import { useState } from "react";
import type { Word } from "@/lib/schemas";
import {
  evaluateUserSentence,
  saveUserSentence,
  type SentenceEvaluation,
} from "@/lib/learn-api";

export function Stage3CreateSentence({
  word,
  definition,
  partOfSpeech,
  onComplete,
}: {
  word: Word;
  definition?: string;
  partOfSpeech?: string;
  onComplete: (result: {
    sentence: string;
    evaluation: SentenceEvaluation;
  }) => void;
}) {
  const [sentence, setSentence] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<SentenceEvaluation | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [attempts, setAttempts] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = sentence.trim();
    if (!trimmed) return;

    setSubmitting(true);
    setError(null);
    try {
      const evalRes = await evaluateUserSentence({
        word: word.text,
        sentence: trimmed,
        definition: definition || word.definition || "",
        partOfSpeech: partOfSpeech || word.part_of_speech || "",
      });
      setEvaluation(evalRes);
      setAttempts((a) => a + 1);
      // Persist original sentence and AI feedback in Supabase
      void saveUserSentence({
        wordId: word.id,
        wordText: word.text,
        originalSentence: trimmed,
        evaluation: evalRes,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not evaluate your sentence.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRewrite = () => {
    setEvaluation(null);
    setError(null);
  };

  const canContinue = Boolean(evaluation && (evaluation.isCorrect || attempts >= 2));

  return (
    <section aria-labelledby="stage3-heading" className="apple-card p-5 sm:p-8 grid gap-5 min-w-0">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5 min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-subtitle/20 border border-subtitle/30 px-3 py-0.5 text-xs font-bold text-ink">
            Stage 3 · Create Your Own Sentence
          </span>
          <h2 id="stage3-heading" className="text-xl sm:text-2xl font-extrabold text-ink break-words">
            Can you write your own sentence using &ldquo;<span className="underline decoration-subtitle decoration-4 underline-offset-4">{word.text}</span>&rdquo;?
          </h2>
          <p className="text-xs sm:text-sm text-muted">
            Use it in any real-life situation. Any natural, grammatically sound sentence is accepted.
          </p>
        </div>

        {(definition || word.definition || word.translation) ? (
          <button
            type="button"
            onClick={() => setShowHint((s) => !s)}
            className="btn btn-quiet min-h-10 px-3 py-1.5 text-xs font-semibold cursor-pointer shrink-0"
          >
            {showHint ? "Hide meaning" : "Meaning reminder"}
          </button>
        ) : null}
      </div>

      {showHint ? (
        <div className="rounded-xl border border-line bg-black/[0.02] dark:bg-white/[0.03] px-4 py-3 text-xs sm:text-sm text-muted">
          <strong className="text-ink">{word.text}</strong>
          {partOfSpeech || word.part_of_speech ? ` (${partOfSpeech || word.part_of_speech})` : ""}:{" "}
          {definition || word.definition || word.translation}
        </div>
      ) : null}

      {/* Sentence Form */}
      <form onSubmit={(e) => void handleSubmit(e)} className="grid gap-3">
        <textarea
          rows={3}
          value={sentence}
          disabled={submitting || Boolean(evaluation)}
          onChange={(e) => setSentence(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !evaluation && sentence.trim()) {
              e.preventDefault();
              void handleSubmit(e);
            }
          }}
          placeholder={`Example structure: Write a natural sentence with "${word.text}"…`}
          aria-label={`Write your own sentence using ${word.text}`}
          className="field min-h-[104px] resize-y text-base leading-relaxed disabled:opacity-75"
        />

        {error ? (
          <p role="alert" className="rounded-xl bg-bad-soft px-3.5 py-2.5 text-xs sm:text-sm text-bad-ink font-medium break-words">
            {error}
          </p>
        ) : null}

        {!evaluation ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="hidden sm:inline text-[11px] text-muted">Tip: Press Ctrl+Enter to submit</span>
            <button
              type="submit"
              disabled={submitting || !sentence.trim()}
              className="btn btn-primary w-full sm:w-auto ms-auto min-h-11 px-6 text-sm font-bold cursor-pointer disabled:opacity-50"
            >
              {submitting ? "Evaluating your sentence…" : "Evaluate Sentence"}
            </button>
          </div>
        ) : null}
      </form>

      {/* AI / Grammar Feedback Card */}
      {evaluation ? (
        <div
          role="status"
          className={`rounded-2xl border p-4 sm:p-5 grid gap-4 animate-in fade-in duration-150 ${
            evaluation.isCorrect
              ? "border-ok/30 bg-ok/10"
              : "border-subtitle/50 bg-subtitle/10"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white ${
                  evaluation.isCorrect ? "bg-ok" : "bg-amber-500"
                }`}
              >
                {evaluation.isCorrect ? "✓" : "!"}
              </span>
              <h3 className="text-sm sm:text-base font-bold text-ink">
                {evaluation.isCorrect
                  ? "Well written! Your sentence works naturally."
                  : "Good try — let's polish a few details"}
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
              <span className="rounded-full bg-surface border border-line px-2.5 py-0.5 text-ink tabular-nums">
                Grammar: {evaluation.grammarScore}/100
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 ${
                  evaluation.usageCorrect
                    ? "bg-ok/15 text-ok-ink"
                    : "bg-bad-soft text-bad-ink"
                }`}
              >
                {evaluation.usageCorrect ? "Word used correctly" : "Check word usage"}
              </span>
            </div>
          </div>

          <p className="text-sm text-ink leading-relaxed break-words">{evaluation.explanation}</p>

          {evaluation.naturalnessFeedback ? (
            <p className="text-xs sm:text-sm text-muted break-words">
              <strong className="text-ink">Naturalness:</strong> {evaluation.naturalnessFeedback}
            </p>
          ) : null}

          {evaluation.grammarCorrections.length > 0 ? (
            <div className="rounded-xl border border-line bg-surface p-3 grid gap-1.5">
              <p className="text-xs font-bold text-ink">Suggestions to improve:</p>
              <ul className="list-disc ps-5 text-xs sm:text-sm text-muted space-y-1 break-words">
                {evaluation.grammarCorrections.map((c, idx) => (
                  <li key={idx}>{c}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {evaluation.naturalAlternative ? (
            <div className="rounded-xl border border-line bg-surface p-3 grid gap-1">
              <p className="text-xs font-bold text-ink">Even more natural alternative:</p>
              <p className="text-sm text-ink italic break-words">&ldquo;{evaluation.naturalAlternative}&rdquo;</p>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={handleRewrite}
              className="btn min-h-10 px-4 text-xs sm:text-sm font-semibold cursor-pointer"
            >
              Rewrite sentence
            </button>
            {canContinue ? (
              <button
                type="button"
                onClick={() => onComplete({ sentence: sentence.trim(), evaluation })}
                className="btn btn-primary min-h-10 px-5 text-xs sm:text-sm font-bold cursor-pointer"
              >
                Continue to Review Rating →
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

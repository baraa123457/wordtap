"use client";

import { useEffect, useState } from "react";
import type { Word } from "@/lib/schemas";
import {
  evaluateUserSentence,
  fetchSentenceExamples,
  saveUserSentence,
  type SentenceEvaluation,
} from "@/lib/learn-api";
import { canSpeak, speak } from "@/lib/speech";
import { SpeakerIcon } from "@/components/Icons";
import { POS_BADGES } from "@/components/TranslatorCard";

function normalizePosList(raw: string | string[] | undefined): string[] {
  const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const cleaned = arr
    .map((p) => p.toLowerCase().trim())
    .filter((p) => p && p !== "def" && p !== "alternatives" && p !== "undefined");
  return Array.from(new Set(cleaned));
}

function highlightWord(text: string, targetWord: string) {
  const clean = targetWord.trim();
  if (!clean) return text;
  const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped}[a-z]*)`, "i");
  const parts = text.split(new RegExp(`(${escaped}[a-z]*)`, "gi"));
  return parts.map((part, i) => {
    if (regex.test(part)) {
      return (
        <span
          key={i}
          className="rounded bg-subtitle/25 px-1 py-0.5 font-bold text-ink underline decoration-subtitle decoration-2 underline-offset-2"
        >
          {part}
        </span>
      );
    }
    return part;
  });
}

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
  const [posList, setPosList] = useState<string[]>(() =>
    normalizePosList(partOfSpeech || word.part_of_speech || ""),
  );
  const [examples, setExamples] = useState<string[]>([]);
  const [loadingExamples, setLoadingExamples] = useState(false);
  const [showExamples, setShowExamples] = useState(true);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);

  // Auto-resolve Part of Speech (Noun / Verb / Adjective / Adverb) from dictionary if missing
  useEffect(() => {
    const initial = normalizePosList(partOfSpeech || word.part_of_speech || "");
    if (initial.length > 0) {
      setPosList(initial);
      return;
    }
    let active = true;
    fetch(
      `/api/translate?text=${encodeURIComponent(word.text)}&src=${encodeURIComponent(word.src_lang || "en")}&target=ar`,
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return;
        const resolved = normalizePosList(
          Array.isArray(data.partsOfSpeech) && data.partsOfSpeech.length > 0
            ? data.partsOfSpeech
            : data.primaryPartOfSpeech,
        );
        if (resolved.length > 0) {
          setPosList(resolved.slice(0, 2));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [word.text, word.src_lang, word.part_of_speech, partOfSpeech]);

  const primaryPos = posList[0] || partOfSpeech || word.part_of_speech || "";

  // Fetch 3 authentic example sentences for the word
  useEffect(() => {
    let active = true;
    setLoadingExamples(true);
    fetchSentenceExamples(
      word.text,
      definition || word.definition || undefined,
      primaryPos || undefined,
    )
      .then((res) => {
        if (!active) return;
        setExamples(res);
      })
      .catch(() => {
        if (!active) return;
        setExamples([]);
      })
      .finally(() => {
        if (active) setLoadingExamples(false);
      });

    return () => {
      active = false;
    };
  }, [word.text, definition, word.definition, primaryPos]);

  const handlePlayAudio = (text: string, index: number) => {
    setSpeakingIndex(index);
    speak(text, "en");
    setTimeout(() => {
      setSpeakingIndex((curr) => (curr === index ? null : curr));
    }, 4000);
  };

  const handleUseTemplate = (templateSentence: string) => {
    setSentence(templateSentence);
    setEvaluation(null);
    setError(null);
  };

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
        partOfSpeech: primaryPos,
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
    <section aria-labelledby="stage3-heading" className="apple-card w-full max-w-full p-4 sm:p-8 flex flex-col gap-5 min-w-0">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-subtitle/20 border border-subtitle/30 px-3 py-0.5 text-xs font-bold text-ink">
              Stage 3 · Create Your Own Sentence
            </span>
            {posList.map((pos) => {
              const meta = POS_BADGES[pos];
              const badgeCls =
                meta?.badge ||
                "bg-subtitle/15 text-amber-800 dark:text-subtitle border-subtitle/35";
              return (
                <span
                  key={pos}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold ${badgeCls}`}
                >
                  <span className="capitalize">{meta?.en || pos}</span>
                  {meta?.ar ? (
                    <span className="opacity-80 font-medium text-[11px]">· {meta.ar}</span>
                  ) : null}
                </span>
              );
            })}
          </div>
          <h2 id="stage3-heading" className="text-xl sm:text-2xl font-extrabold text-ink break-words">
            Can you write your own sentence using &ldquo;<span className="underline decoration-subtitle decoration-4 underline-offset-4">{word.text}</span>&rdquo;?
          </h2>
          <p className="text-xs sm:text-sm text-muted">
            Use it in any real-life situation. Any natural, grammatically sound sentence is accepted.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowExamples((s) => !s)}
            className="btn btn-quiet min-h-10 px-3 py-1.5 text-xs font-semibold cursor-pointer shrink-0 inline-flex items-center gap-1.5"
            title="Toggle 3 authentic example sentences"
          >
            <span>💡</span>
            <span>{showExamples ? "Hide examples" : "3 Examples"}</span>
            {examples.length > 0 && !showExamples ? (
              <span className="rounded-full bg-subtitle/30 px-1.5 py-0.2 text-[10px] font-bold">
                {examples.length}
              </span>
            ) : null}
          </button>

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
      </div>

      {showHint ? (
        <div className="rounded-xl border border-line bg-black/[0.02] dark:bg-white/[0.03] px-4 py-3 text-xs sm:text-sm text-muted">
          <strong className="text-ink">{word.text}</strong>
          {primaryPos ? ` (${POS_BADGES[primaryPos]?.en || primaryPos})` : ""}:{" "}
          {definition || word.definition || word.translation}
        </div>
      ) : null}

      {/* 3 Example sentences card */}
      {showExamples ? (
        <div className="rounded-2xl border border-subtitle/40 bg-subtitle/10 p-4 sm:p-5 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-base">💡</span>
              <h3 className="text-sm sm:text-base font-bold text-ink">
                3 Real Examples with &ldquo;<span className="text-subtitle font-extrabold">{word.text}</span>&rdquo;
              </h3>
            </div>
            <span className="text-[11px] font-medium text-muted">
              Learn usage patterns or adapt as a starting template
            </span>
          </div>

          {loadingExamples && examples.length === 0 ? (
            <div className="py-3 flex items-center justify-center gap-2 text-xs text-muted">
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-subtitle" />
              <span>Finding authentic example sentences for &ldquo;{word.text}&rdquo;…</span>
            </div>
          ) : examples.length > 0 ? (
            <div className="grid gap-2.5">
              {examples.map((ex, index) => (
                <div
                  key={index}
                  className="rounded-xl border border-line bg-surface/90 hover:bg-surface p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors shadow-xs"
                >
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-subtitle/25 text-[11px] font-bold text-ink">
                      {index + 1}
                    </span>
                    <p className="text-xs sm:text-sm text-ink leading-relaxed break-words">
                      {highlightWord(ex, word.text)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {canSpeak() ? (
                      <button
                        type="button"
                        onClick={() => handlePlayAudio(ex, index)}
                        className={`btn btn-quiet min-h-8 px-2.5 py-1 text-xs font-semibold cursor-pointer inline-flex items-center gap-1 ${
                          speakingIndex === index ? "text-subtitle font-bold" : "text-muted hover:text-ink"
                        }`}
                        title="Listen to pronunciation"
                      >
                        <SpeakerIcon size={14} />
                        <span>{speakingIndex === index ? "Playing…" : "Listen"}</span>
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => handleUseTemplate(ex)}
                      className="btn btn-quiet border border-line min-h-8 px-2.5 py-1 text-xs font-medium cursor-pointer hover:border-subtitle/50 hover:bg-subtitle/15"
                      title="Insert into your sentence box to adapt or customize"
                    >
                      Use as template
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted">No examples loaded. You can still write your own sentence below.</p>
          )}
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

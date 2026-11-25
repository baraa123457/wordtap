"use client";

import { useEffect, useState } from "react";
import type { Word } from "@/lib/schemas";
import {
  fetchUnderstandingQuestion,
  type UnderstandingQuestion,
} from "@/lib/learn-api";
import { canSpeak, speak } from "@/lib/speech";
import { SpeakerIcon, TrashIcon } from "@/components/Icons";
import { POS_BADGES } from "@/components/TranslatorCard";
import { updateWordDetails } from "@/lib/api";

export function Stage1Understanding({
  word,
  onComplete,
  onDeleteWord,
}: {
  word: Word;
  onComplete: (result: {
    passedFirstTry: boolean;
    selectedAnswer: string;
    definition: string;
    pronunciation: string;
    partOfSpeech: string;
  }) => void;
  onDeleteWord?: (word: Word) => void;
}) {
  const [question, setQuestion] = useState<UnderstandingQuestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<"A" | "B" | "C" | "D" | null>(null);
  const [status, setStatus] = useState<"answering" | "wrong" | "correct">("answering");
  const [hadWrongAttempt, setHadWrongAttempt] = useState(false);

  const [meanings, setMeanings] = useState<string[]>(() => {
    if (!word.translation) return [];
    return word.translation
      .split(/[,/،;·•\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  });
  const [isAddingMeaning, setIsAddingMeaning] = useState(false);
  const [newMeaningInput, setNewMeaningInput] = useState("");
  const [savingMeaning, setSavingMeaning] = useState(false);

  useEffect(() => {
    const list = word.translation
      ? word.translation.split(/[,/،;·•\n]+/).map((s) => s.trim()).filter(Boolean)
      : [];
    setMeanings(list);
    setIsAddingMeaning(false);
    setNewMeaningInput("");
  }, [word.id, word.translation]);

  useEffect(() => {
    if (question?.meanings && question.meanings.length > 0) {
      setMeanings((prev) => {
        const merged = [...prev];
        for (const m of question.meanings!) {
          const clean = m.trim();
          if (clean && !merged.some((e) => e.toLowerCase() === clean.toLowerCase())) {
            merged.push(clean);
          }
        }
        return merged.slice(0, 5);
      });
    }
  }, [question?.meanings]);

  useEffect(() => {
    let active = true;
    if (meanings.length <= 1) {
      const targetLang = word.target_lang || "ar";
      fetch(`/api/translate?text=${encodeURIComponent(word.text)}&src=en&target=${targetLang}`)
        .then((r) => r.json())
        .then((data: { translation?: string; definitions?: Array<{ meanings?: string[] }> }) => {
          if (!active) return;
          const candidates: string[] = [];
          if (data.translation) candidates.push(data.translation);
          for (const d of data.definitions || []) {
            for (const m of d.meanings || []) {
              if (typeof m === "string") candidates.push(m);
            }
          }
          if (candidates.length > 0) {
            setMeanings((prev) => {
              const combined = [...prev];
              for (const c of candidates) {
                const clean = c.trim();
                if (clean && !combined.some((x) => x.toLowerCase() === clean.toLowerCase())) {
                  combined.push(clean);
                }
              }
              return combined.slice(0, 5);
            });
          }
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [word.id, word.text, word.target_lang, meanings.length]);

  const handleAddCustomMeaning = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newMeaningInput.trim();
    if (!clean) return;
    if (meanings.some((m) => m.toLowerCase() === clean.toLowerCase())) {
      setIsAddingMeaning(false);
      setNewMeaningInput("");
      return;
    }
    setSavingMeaning(true);
    try {
      const nextList = [...meanings, clean];
      setMeanings(nextList);
      const joined = nextList.join(" ، ");
      await updateWordDetails(word.id, { translation: joined }, word).catch(() => {});
      setIsAddingMeaning(false);
      setNewMeaningInput("");
    } finally {
      setSavingMeaning(false);
    }
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    setSelectedId(null);
    setStatus("answering");
    try {
      const q = await fetchUnderstandingQuestion(word);
      const ids: Array<"A" | "B" | "C" | "D"> = ["A", "B", "C", "D"];
      const tagged = q.options.map((opt) => ({
        text: opt.text,
        isCorrect: opt.id === q.correctOptionId,
      }));
      for (let i = tagged.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tagged[i], tagged[j]] = [tagged[j]!, tagged[i]!];
      }
      const shuffledOptions = tagged.map((item, idx) => ({
        id: ids[idx] ?? "A",
        text: item.text,
      }));
      const newCorrectIdx = tagged.findIndex((item) => item.isCorrect);
      setQuestion({
        ...q,
        options: shuffledOptions,
        correctOptionId: ids[newCorrectIdx] ?? q.correctOptionId,
      });
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
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-subtitle/20 border border-subtitle/30 px-3 py-0.5 text-xs font-bold text-ink">
              Stage 1 · Understanding
            </span>
            {(question.partOfSpeech || word.part_of_speech) ? (() => {
              const rawPos = (question.partOfSpeech || word.part_of_speech || "").toLowerCase().trim();
              const meta = POS_BADGES[rawPos];
              const badgeCls =
                meta?.badge ||
                "bg-subtitle/15 text-amber-800 dark:text-subtitle border-subtitle/35";
              return (
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold ${badgeCls}`}
                >
                  <span className="capitalize">{meta?.en || rawPos}</span>
                  {meta?.ar ? (
                    <span className="opacity-80 font-medium text-[11px]">· {meta.ar}</span>
                  ) : null}
                </span>
              );
            })() : null}
          </div>
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <h2
              id="stage1-heading"
              dir="auto"
              className="text-2xl sm:text-4xl font-extrabold tracking-tight text-ink break-words"
            >
              {word.text === word.text.toUpperCase() ? word.text.toLowerCase() : word.text}
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

          {/* Mother Language Meanings */}
          {meanings.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 pt-1 min-w-0 max-w-full">
              <div
                dir="auto"
                data-testid="stage1-mother-language-meaning"
                className="inline-flex flex-wrap items-center gap-2 rounded-xl border border-subtitle/35 bg-subtitle/15 px-3.5 py-1.5 text-base sm:text-lg font-bold text-ink min-w-0"
              >
                <span className="text-xs font-semibold text-amber-800 dark:text-subtitle opacity-90 uppercase tracking-wider shrink-0 select-none">
                  {meanings.length > 1 ? "Meanings:" : "Meaning:"}
                </span>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  {meanings.map((m, idx) => (
                    <span key={idx} className="inline-flex items-center">
                      <span className="font-extrabold">{m}</span>
                      {idx < meanings.length - 1 ? (
                        <span className="mx-1.5 text-ink/35 font-bold select-none">·</span>
                      ) : null}
                    </span>
                  ))}
                </div>
                {!isAddingMeaning ? (
                  <button
                    type="button"
                    onClick={() => setIsAddingMeaning(true)}
                    title="Add another meaning in your language"
                    className="ml-1 inline-flex items-center justify-center rounded-lg border border-subtitle/40 bg-subtitle/20 hover:bg-subtitle/35 px-2 py-0.5 text-xs font-bold text-ink cursor-pointer transition-colors"
                  >
                    + Add
                  </button>
                ) : null}
              </div>

              {isAddingMeaning ? (
                <form
                  onSubmit={(e) => void handleAddCustomMeaning(e)}
                  className="inline-flex items-center gap-1.5"
                >
                  <input
                    type="text"
                    dir="auto"
                    autoFocus
                    value={newMeaningInput}
                    onChange={(e) => setNewMeaningInput(e.target.value)}
                    placeholder="Add meaning..."
                    className="input min-h-8 px-2.5 py-1 text-xs sm:text-sm font-semibold rounded-lg border border-subtitle"
                  />
                  <button
                    type="submit"
                    disabled={savingMeaning || !newMeaningInput.trim()}
                    className="btn btn-primary min-h-8 px-2.5 py-1 text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    {savingMeaning ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingMeaning(false);
                      setNewMeaningInput("");
                    }}
                    className="btn btn-quiet min-h-8 px-2 py-1 text-xs font-semibold cursor-pointer"
                  >
                    ✕
                  </button>
                </form>
              ) : null}
            </div>
          ) : null}

          {question.pronunciation ? (
            <p className="text-xs sm:text-sm text-muted font-mono">{question.pronunciation}</p>
          ) : null}
        </div>

        {/* Action controls: Delete Word */}
        {onDeleteWord ? (
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => onDeleteWord(word)}
              title={`Delete "${word.text}" from your words`}
              aria-label={`Delete ${word.text}`}
              className="btn btn-quiet min-h-10 px-3 py-1.5 text-xs font-semibold text-muted hover:text-bad hover:bg-bad/10 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <TrashIcon size={14} />
              <span>Delete</span>
            </button>
          </div>
        ) : null}
      </div>

      {/* Saved subtitle context preview */}
      {word.sentence ? (
        <p dir="auto" className="rounded-xl border border-line/70 bg-black/[0.02] dark:bg-white/[0.03] px-3.5 py-2 text-xs sm:text-sm text-muted italic break-words">
          Context: &ldquo;{word.sentence}&rdquo;
        </p>
      ) : null}

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
          <div className="space-y-1.5">
            <p className="text-sm font-bold text-bad-ink">Not quite — here&apos;s what it means:</p>
            {question.definition ? (
              <p className="text-sm text-ink leading-relaxed break-words">
                <strong>Definition:</strong> {question.definition}
              </p>
            ) : null}
            {word.translation ? (
              <p dir="auto" className="text-sm font-semibold text-ink break-words">
                <span className="text-muted font-medium">Meaning: </span>
                {word.translation}
              </p>
            ) : null}
            <p className="text-xs sm:text-sm text-muted leading-relaxed break-words">{question.explanation}</p>
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
          <div className="space-y-1.5">
            <p className="text-sm font-bold text-ok">Correct! You understand this word.</p>
            {question.definition ? (
              <p className="text-sm text-ink leading-relaxed break-words">
                <strong>Definition:</strong> {question.definition}
              </p>
            ) : null}
            {word.translation ? (
              <p dir="auto" className="text-sm font-semibold text-ink break-words">
                <span className="text-muted font-medium">Meaning: </span>
                {word.translation}
              </p>
            ) : null}
            <p className="text-xs sm:text-sm text-muted leading-relaxed break-words">{question.explanation}</p>
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

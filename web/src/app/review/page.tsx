"use client";

import { useMemo, useState } from "react";
import { fetchWords } from "@/lib/api";
import { useLoad } from "@/hooks/useLoad";
import { isReviewEligible } from "@/lib/review-scheduler";
import { RequireAuth } from "@/components/RequireAuth";
import { ErrorState, LoadingState } from "@/components/StateViews";
import { InteractiveLearningSession } from "@/components/learn/InteractiveLearningSession";
import { ReviewSession } from "@/components/review/ReviewSession";
import type { Word } from "@/lib/schemas";

const LANG_NAMES: Record<string, string> = {
  en: "English",
  de: "German",
  fr: "French",
  es: "Spanish",
  it: "Italian",
  pt: "Portuguese",
  tr: "Turkish",
  ru: "Russian",
  ar: "Arabic",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese",
  auto: "Other",
};

export default function ReviewPage() {
  return (
    <RequireAuth>
      <ReviewLoader />
    </RequireAuth>
  );
}

function ReviewLoader() {
  const { state, reload } = useLoad(fetchWords);
  const [selectedLang, setSelectedLang] = useState<string | null>(null);
  const [reviewBatchKey, setReviewBatchKey] = useState(0);
  const [hardPracticeWords, setHardPracticeWords] = useState<Word[] | null>(null);

  const eligibleWords = useMemo(() => {
    if (state.status !== "ready") return [];
    return state.data.filter(isReviewEligible);
  }, [state]);

  const languages = useMemo(() => {
    const counts = new Map<string, number>();
    for (const w of eligibleWords) {
      const code = (w.src_lang || "auto").toLowerCase();
      if (code === "ar") continue;
      counts.set(code, (counts.get(code) || 0) + 1);
    }
    return Array.from(counts.entries()).map(([code, count]) => ({
      id: code,
      name: LANG_NAMES[code] || code.toUpperCase(),
      count,
    }));
  }, [eligibleWords]);

  if (state.status === "loading") {
    return <LoadingState label="Preparing your quick review…" />;
  }
  if (state.status === "error") {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <ErrorState message={state.message} onRetry={reload} />
      </div>
    );
  }

  if (languages.length > 1 && selectedLang === null) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-4 py-12 pt-safe pb-safe">
        <div className="apple-card p-6 sm:p-8 grid gap-5">
          <div className="space-y-1.5">
            <h1 className="text-xl sm:text-2xl font-extrabold text-ink">
              Choose language to review
            </h1>
            <p className="text-xs sm:text-sm text-muted">
              Start your 5-word Easy review (Multiple Choice → Connect Words → Listen &amp; Spell → Write Translation):
            </p>
          </div>
          <div className="grid gap-2.5">
            {languages.map((lang) => (
              <button
                key={lang.id}
                type="button"
                onClick={() => setSelectedLang(lang.id)}
                className="w-full min-h-12 rounded-2xl border border-line bg-surface px-4 py-3 flex items-center justify-between gap-3 text-sm sm:text-base font-bold text-ink hover:border-subtitle hover:bg-subtitle/10 transition-all cursor-pointer"
              >
                <span>{lang.name}</span>
                <span className="rounded-full bg-black/5 dark:bg-white/10 px-2.5 py-0.5 text-xs font-semibold text-muted tabular-nums">
                  {lang.count} {lang.count === 1 ? "word" : "words"}
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSelectedLang("all")}
              className="w-full min-h-11 rounded-2xl px-4 py-2.5 flex items-center justify-between gap-3 text-sm font-bold text-muted hover:text-ink hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-all cursor-pointer"
            >
              <span>All languages mixed</span>
              <span className="text-xs font-semibold tabular-nums">
                {eligibleWords.length} total
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const filteredWords =
    selectedLang && selectedLang !== "all"
      ? state.data.filter((w) => (w.src_lang || "auto").toLowerCase() === selectedLang)
      : state.data;

  if (hardPracticeWords && hardPracticeWords.length > 0) {
    return (
      <InteractiveLearningSession
        key={`review-hard-${hardPracticeWords.map((w) => w.id).join(",")}`}
        words={hardPracticeWords}
        newLimit={hardPracticeWords.length}
        mode="learn"
        onReload={() => {
          setHardPracticeWords(null);
          reload();
        }}
      />
    );
  }

  return (
    <ReviewSession
      key={`review-easy-${reviewBatchKey}-${selectedLang || "all"}`}
      words={filteredWords}
      allDeckWords={filteredWords}
      sessionSize={5}
      includeDictation={true}
      promptMode="translation"
      onPracticeHard={(hardWords) => setHardPracticeWords(hardWords)}
      onReload={() => {
        setReviewBatchKey((k) => k + 1);
        reload();
      }}
    />
  );
}

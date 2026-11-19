"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchStats, fetchWords } from "@/lib/api";
import { useLoad } from "@/hooks/useLoad";
import { RequireAuth } from "@/components/RequireAuth";
import { ErrorState, LoadingState } from "@/components/StateViews";
import { InteractiveLearningSession } from "@/components/learn/InteractiveLearningSession";
import { PracticeSession } from "@/components/practice/PracticeSession";
import { SAMPLE_WORDS } from "@/lib/sampleWords";
import { getStoredSettings } from "@/lib/settings";
import type { Stats, Word } from "@/lib/schemas";

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

type PracticeData = { words: Word[]; stats: Stats };

async function loadPracticeData(): Promise<PracticeData> {
  const [words, stats] = await Promise.all([fetchWords(), fetchStats()]);
  return { words, stats };
}

export default function PracticePage() {
  return (
    <RequireAuth>
      <Suspense fallback={<LoadingState label="Preparing your learning session…" />}>
        <PracticeLoader />
      </Suspense>
    </RequireAuth>
  );
}

function PracticeLoader() {
  const { state, reload } = useLoad(loadPracticeData);
  const searchParams = useSearchParams();
  const urlLang = searchParams.get("lang");
  const urlMode = searchParams.get("mode");
  const urlWordId = searchParams.get("wordId");
  const urlPractice = searchParams.get("practice");
  const urlIds = searchParams.get("ids");
  const useClassic = searchParams.get("classic") === "1" || urlPractice === "dictation";

  const [selectedLang, setSelectedLang] = useState<string | null>(urlLang);
  const [trySampleSession, setTrySampleSession] = useState(false);

  const words = state.status === "ready" ? state.data.words : null;
  const stats = state.status === "ready" ? state.data.stats : null;
  const stored = getStoredSettings();

  const dailyNewLimit = stats?.daily_new_words_goal ?? stored.dailyNewWordsGoal ?? 5;
  const dailyReviewLimit = stats?.daily_reviews_goal ?? stored.dailyReviewsGoal ?? 20;

  const languages = useMemo(() => {
    if (!words) return [];
    const counts = new Map<string, number>();
    const sourcePool =
      urlMode === "missed"
        ? words.filter((w) => (w.wrong_count || 0) > 0)
        : words;

    for (const w of sourcePool) {
      const code = (w.src_lang || "auto").toLowerCase();
      if (code === "ar") continue;
      counts.set(code, (counts.get(code) || 0) + 1);
    }
    return Array.from(counts.entries()).map(([code, count]) => ({
      id: code,
      name: LANG_NAMES[code] || code.toUpperCase(),
      count,
    }));
  }, [words, urlMode]);

  if (state.status === "loading") {
    return <LoadingState label="Preparing your learning session…" />;
  }
  if (state.status === "error") {
    return (
      <div className="px-4 py-16">
        <ErrorState message={state.message} onRetry={reload} />
      </div>
    );
  }

  // Empty vocabulary state + interactive 4-stage demo
  if (state.data.words.length === 0) {
    if (trySampleSession) {
      return (
        <div className="space-y-2">
          <div className="mx-auto max-w-3xl px-3.5 sm:px-5 pt-3">
            <div className="px-4 py-2 bg-subtitle/15 border border-subtitle/30 rounded-xl text-xs font-semibold text-ink flex flex-wrap items-center justify-between gap-2">
              <span>Demo Mode: Experiencing the 4-Stage Learning System on sample words.</span>
              <button
                type="button"
                onClick={() => setTrySampleSession(false)}
                className="text-muted hover:text-ink underline text-[11px] shrink-0 cursor-pointer"
              >
                Exit demo
              </button>
            </div>
          </div>
          <InteractiveLearningSession
            words={SAMPLE_WORDS}
            newLimit={4}
            reviewLimit={0}
            mode="learn"
            onReload={() => setTrySampleSession(false)}
          />
        </div>
      );
    }

    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-3.5 sm:px-4 py-8 sm:py-12 pt-safe pb-safe">
        <div className="apple-card p-5 sm:p-8 space-y-5 sm:space-y-6 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-subtitle/20 border border-subtitle/30 flex items-center justify-center text-2xl">
            🎬
          </div>
          <div className="space-y-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-ink">No words to learn yet</h1>
            <p className="text-xs sm:text-sm text-muted leading-relaxed">
              Save words from YouTube subtitles or the Dashboard translator to unlock the 4-stage interactive learning flow: Understanding, Real Videos, Sentence Creation, and Spaced Repetition.
            </p>
          </div>

          <div className="flex flex-col gap-2.5 sm:gap-3 pt-2">
            <Link href="/decks" className="btn btn-primary font-bold py-3 text-center justify-center">
              🎬 Browse Curated Show &amp; Career Decks
            </Link>
            <Link href="/dashboard" className="btn btn-quiet border border-line font-semibold py-2.5 text-center justify-center">
              Translate &amp; add your own word
            </Link>
            <button
              type="button"
              onClick={() => setTrySampleSession(true)}
              className="btn btn-quiet text-xs font-semibold py-2 cursor-pointer text-muted hover:text-ink"
            >
              Try a 4-stage interactive sample session
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Direct single-word 4-stage focus mode (e.g. clicking "Learn" on a word in /words)
  if (urlWordId) {
    return (
      <InteractiveLearningSession
        key={`focus-${urlWordId}`}
        words={state.data.words}
        focusWordId={urlWordId}
        onReload={reload}
      />
    );
  }

  // Language picker when multiple foreign languages exist and none explicitly chosen
  if (!selectedLang && !urlLang && languages.length > 1) {
    const totalCount =
      urlMode === "missed"
        ? state.data.words.filter((w) => (w.wrong_count || 0) > 0).length
        : state.data.words.length;

    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-3.5 sm:px-4 py-8 sm:py-12 pt-safe pb-safe">
        <div className="grid gap-5 sm:gap-6 rounded-3xl border border-line bg-surface p-5 sm:p-8 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink">Choose language to learn</h1>
            <p className="mt-1 text-sm text-muted">
              Start your 4-stage interactive session (Understanding → Video Context → Your Sentence → Spaced Repetition):
            </p>
          </div>
          <div className="grid gap-3">
            {languages.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setSelectedLang(l.id)}
                className="btn justify-between py-3.5 text-base cursor-pointer hover:border-subtitle"
              >
                <span className="font-semibold">{l.name}</span>
                <span className="rounded-full bg-line px-2.5 py-0.5 text-xs text-muted">
                  {l.count} {l.count === 1 ? "word" : "words"}
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSelectedLang("all")}
              className="btn btn-quiet justify-between text-base cursor-pointer hover:border-subtitle"
            >
              <span>All languages mixed</span>
              <span className="text-xs text-muted">{totalCount} total</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  let filteredWords =
    selectedLang && selectedLang !== "all"
      ? state.data.words.filter(
          (w) => (w.src_lang || "auto").toLowerCase() === selectedLang.toLowerCase(),
        )
      : state.data.words;

  if (urlIds) {
    const idSet = new Set(urlIds.split(",").map((s) => s.trim()).filter(Boolean));
    const subset = filteredWords.filter((w) => idSet.has(w.id));
    if (subset.length > 0) filteredWords = subset;
  }

  // Optional legacy dictation mode when explicitly requested
  if (useClassic) {
    return (
      <PracticeSession
        key={`classic-${urlIds || ""}-${urlMode || ""}-${urlPractice || ""}-${selectedLang || ""}`}
        words={filteredWords}
        onAgain={reload}
        onChangeLang={languages.length > 1 ? () => setSelectedLang(null) : undefined}
        modeOverride={urlPractice === "dictation" ? "dictation" : undefined}
      />
    );
  }

  const sessionMode: "learn" | "review" | "missed" =
    urlMode === "review" || urlMode === "missed" ? urlMode : "learn";

  return (
    <InteractiveLearningSession
      key={`learn-${sessionMode}-${urlIds || ""}-${selectedLang || "all"}-${dailyNewLimit}-${dailyReviewLimit}`}
      words={filteredWords}
      newLimit={dailyNewLimit}
      reviewLimit={dailyReviewLimit}
      langFilter={selectedLang || "all"}
      mode={sessionMode}
      onReload={reload}
    />
  );
}

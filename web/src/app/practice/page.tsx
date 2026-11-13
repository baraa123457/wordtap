"use client";

import Link from "next/link";
import { fetchWords } from "@/lib/api";
import { useLoad } from "@/hooks/useLoad";
import { RequireAuth } from "@/components/RequireAuth";
import { ErrorState, LoadingState } from "@/components/StateViews";
import { PracticeSession } from "@/components/practice/PracticeSession";
import { SAMPLE_WORDS } from "@/lib/sampleWords";

import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";

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

export default function PracticePage() {
  return (
    <RequireAuth>
      <Suspense fallback={<LoadingState label="Getting your words ready…" />}>
        <PracticeLoader />
      </Suspense>
    </RequireAuth>
  );
}

function PracticeLoader() {
  const { state, reload } = useLoad(fetchWords);
  const searchParams = useSearchParams();
  const urlLang = searchParams.get("lang");
  const urlMode = searchParams.get("mode");
  const [selectedLang, setSelectedLang] = useState<string | null>(urlLang);
  const [trySampleSession, setTrySampleSession] = useState(false);

  const words = state.status === "ready" ? state.data : null;

  const languages = useMemo(() => {
    if (!words) return [];
    const counts = new Map<string, number>();
    for (const w of words) {
      const code = (w.src_lang || "auto").toLowerCase();
      if (code === "ar") continue;
      counts.set(code, (counts.get(code) || 0) + 1);
    }
    return Array.from(counts.entries()).map(([code, count]) => ({
      id: code,
      name: LANG_NAMES[code] || code.toUpperCase(),
      count,
    }));
  }, [words]);

  if (state.status === "loading") return <LoadingState label="Getting your words ready…" />;
  if (state.status === "error") {
    return (
      <div className="px-4 py-16">
        <ErrorState message={state.message} onRetry={reload} />
      </div>
    );
  }
  if (state.data.length === 0) {
    if (trySampleSession) {
      return (
        <div className="space-y-4">
          <div className="mx-auto max-w-lg mt-4 px-4 py-2 bg-subtitle/15 border border-subtitle/30 rounded-xl text-xs font-semibold text-ink flex items-center justify-between">
            <span>Demo Mode: Practicing 4 sample words (these will not be saved to your account).</span>
            <button
              type="button"
              onClick={() => setTrySampleSession(false)}
              className="text-muted hover:text-ink underline text-[11px]"
            >
              Exit demo
            </button>
          </div>
          <PracticeSession words={SAMPLE_WORDS} onAgain={() => setTrySampleSession(false)} />
        </div>
      );
    }

    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-4 py-12">
        <div className="apple-card p-6 sm:p-8 space-y-6 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-subtitle/20 border border-subtitle/30 flex items-center justify-center text-2xl">
            🎬
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold text-ink">No words to practice yet</h1>
            <p className="text-xs sm:text-sm text-muted leading-relaxed">
              Words you tap in YouTube or Netflix subtitles appear here automatically. Once saved, you can review them with spaced repetition.
            </p>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <Link href="/extension" className="btn btn-primary font-bold py-3">
              Install Chrome Extension
            </Link>
            <button
              type="button"
              onClick={() => setTrySampleSession(true)}
              className="btn btn-quiet text-xs font-semibold"
            >
              Or try a 4-question sample session
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If user has multiple languages and hasn't picked one yet (skip picker when drilling missed words):
  if (!selectedLang && languages.length > 1 && urlMode !== "missed") {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-4 py-12">
        <div className="grid gap-6 rounded-3xl border border-line bg-surface p-6 shadow-sm sm:p-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Choose what to practice</h1>
            <p className="mt-1 text-sm text-muted">
              You have words saved in multiple languages. Select one to focus on:
            </p>
          </div>
          <div className="grid gap-3">
            {languages.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setSelectedLang(l.id)}
                className="btn justify-between py-3.5 text-base"
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
              className="btn btn-quiet justify-between text-base"
            >
              <span>Practice all languages mixed</span>
              <span className="text-xs text-muted">{state.data.length} total</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const urlPractice = searchParams.get("practice");
  const urlIds = searchParams.get("ids");
  const modeOverride =
    urlPractice === "dictation" || urlPractice === "typing" || urlPractice === "choice" || urlPractice === "mixed"
      ? urlPractice
      : undefined;

  let filteredWords =
    selectedLang && selectedLang !== "all"
      ? state.data.filter((w) => (w.src_lang || "auto").toLowerCase() === selectedLang.toLowerCase())
      : state.data;

  if (urlIds) {
    const idSet = new Set(urlIds.split(",").map((s) => s.trim()).filter(Boolean));
    const subset = filteredWords.filter((w) => idSet.has(w.id));
    if (subset.length > 0) filteredWords = subset;
  } else if (urlMode === "missed") {
    const trouble = [...filteredWords]
      .filter((w) => w.wrong_count > 0)
      .sort((a, b) => b.wrong_count - a.wrong_count);
    if (trouble.length > 0) {
      filteredWords = trouble;
    }
  }

  // "Practice again" reloads the words, so the next session uses fresh schedules.
  return <PracticeSession words={filteredWords} onAgain={reload} modeOverride={modeOverride} />;
}

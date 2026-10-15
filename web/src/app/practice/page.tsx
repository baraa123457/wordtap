"use client";

import Link from "next/link";
import { fetchWords } from "@/lib/api";
import { useLoad } from "@/hooks/useLoad";
import { RequireAuth } from "@/components/RequireAuth";
import { EmptyState, ErrorState, LoadingState } from "@/components/StateViews";
import { PracticeSession } from "@/components/practice/PracticeSession";

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
  const [selectedLang, setSelectedLang] = useState<string | null>(urlLang);

  const words = state.status === "ready" ? state.data : null;

  const languages = useMemo(() => {
    if (!words) return [];
    const counts = new Map<string, number>();
    for (const w of words) {
      const code = (w.src_lang || "auto").toLowerCase();
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
    return (
      <EmptyState
        title="Nothing to practice yet"
        action={
          <Link href="/extension" className="btn btn-primary">
            Set up the extension
          </Link>
        }
      >
        Save a few words from subtitles first, then come back.
      </EmptyState>
    );
  }

  // If user has multiple languages and hasn't picked one yet:
  if (!selectedLang && languages.length > 1) {
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

  const filteredWords =
    selectedLang && selectedLang !== "all"
      ? state.data.filter((w) => (w.src_lang || "auto").toLowerCase() === selectedLang.toLowerCase())
      : state.data;

  // "Practice again" reloads the words, so the next session uses fresh schedules.
  return <PracticeSession words={filteredWords} onAgain={reload} />;
}

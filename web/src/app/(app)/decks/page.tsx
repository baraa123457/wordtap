"use client";

import { useMemo, useState } from "react";
import {
  deckWordsToPracticeWords,
  getCuratedDecks,
  importDeckToUserVocabulary,
  type CuratedDeck,
  type CuratedDeckCategory,
} from "@/lib/curated-decks";
import { InteractiveLearningSession } from "@/components/learn/InteractiveLearningSession";
import { useAuth } from "@/context/AuthContext";

export default function DecksPage() {
  const { state: authState } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<CuratedDeckCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [inspectingDeck, setInspectingDeck] = useState<CuratedDeck | null>(null);
  const [practicingDeck, setPracticingDeck] = useState<CuratedDeck | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<{ id: string; text: string; isError?: boolean } | null>(null);

  const filteredDecks = useMemo(() => {
    let list = getCuratedDecks(selectedCategory);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.subtitle.toLowerCase().includes(q) ||
          d.description.toLowerCase().includes(q) ||
          d.words.some((w) => w.text.toLowerCase().includes(q) || w.translation.includes(q)),
      );
    }
    return list;
  }, [selectedCategory, searchQuery]);

  const handleImport = async (deck: CuratedDeck) => {
    if (authState.status !== "signed-in") {
      setImportMessage({
        id: deck.id,
        text: "Please sign in or create an account to save decks to your library.",
        isError: true,
      });
      return;
    }

    setImportingId(deck.id);
    setImportMessage(null);
    const res = await importDeckToUserVocabulary(deck.id);
    setImportingId(null);
    if (res.success) {
      setImportMessage({
        id: deck.id,
        text: `✓ Added all ${res.count} words from "${deck.title}" to your library!`,
        isError: false,
      });
    } else {
      setImportMessage({
        id: deck.id,
        text: res.error || "Could not add deck to your library.",
        isError: true,
      });
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      {/* Hero Header */}
      <div className="flex flex-col gap-3 text-center sm:text-left">
        <div className="inline-flex items-center gap-2 self-center sm:self-start rounded-full bg-subtitle/20 border border-subtitle/30 px-3 py-1 text-xs font-bold text-ink">
          <span>🎬 Authentic Entertainment Vocabulary</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-ink">
          Curated Show &amp; Career Decks
        </h1>
        <p className="max-w-2xl text-sm sm:text-base text-muted">
          Skip the blank screen. Practice native expressions and high-frequency idioms from your favorite shows and career fields with the 4-stage smart method.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {[
            { id: "all", label: "All Decks" },
            { id: "tv_shows", label: "🎬 TV Shows" },
            { id: "career_tech", label: "🚀 Career & Tech" },
            { id: "ielts_academic", label: "🎓 IELTS & Exam" },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id as CuratedDeckCategory)}
              className={`rounded-full px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition-colors cursor-pointer shrink-0 ${
                selectedCategory === cat.id
                  ? "bg-subtitle text-white shadow-xs"
                  : "bg-surface border border-line text-muted hover:text-ink hover:bg-black/5 dark:hover:bg-white/5"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search words or shows…"
            className="field w-full py-1.5 ps-9 text-xs sm:text-sm"
          />
          <span className="absolute start-3 top-1/2 -translate-y-1/2 text-muted text-xs pointer-events-none">
            🔍
          </span>
        </div>
      </div>

      {/* Decks Grid */}
      <div className="grid gap-5 md:grid-cols-2">
        {filteredDecks.map((deck) => (
          <div
            key={deck.id}
            className="apple-card relative flex flex-col justify-between overflow-hidden p-5 sm:p-6 transition-all hover:border-subtitle/50 shadow-xs"
          >
            {/* Top decorative gradient glow */}
            <div
              className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${deck.gradient} pointer-events-none opacity-50`}
            />

            <div className="relative z-10 flex flex-col gap-3">
              {/* Header tags */}
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-muted">
                  <span className="text-lg">{deck.emoji}</span>
                  <span>{deck.categoryLabel}</span>
                </span>
                <span className="rounded-full bg-subtitle/15 border border-subtitle/30 px-2.5 py-0.5 text-[11px] font-bold text-amber-900 dark:text-subtitle">
                  {deck.badge}
                </span>
              </div>

              {/* Title & Description */}
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-ink">{deck.title}</h2>
                <p className="text-xs font-medium text-subtitle">{deck.subtitle}</p>
                <p className="mt-1.5 text-xs sm:text-sm text-muted line-clamp-2 leading-relaxed">
                  {deck.description}
                </p>
              </div>

              {/* Sample word preview chips */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {deck.words.slice(0, 4).map((w, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface/80 px-2 py-0.5 text-xs font-semibold text-ink"
                  >
                    <span>{w.text}</span>
                    <span className="text-[10px] text-muted font-normal">({w.translation})</span>
                  </span>
                ))}
                {deck.words.length > 4 ? (
                  <button
                    type="button"
                    onClick={() => setInspectingDeck(deck)}
                    className="text-[11px] font-bold text-subtitle hover:underline cursor-pointer ps-1"
                  >
                    +{deck.words.length - 4} more
                  </button>
                ) : null}
              </div>

              {/* Import status message */}
              {importMessage?.id === deck.id ? (
                <p
                  className={`text-xs font-medium rounded-lg px-2.5 py-1.5 ${
                    importMessage.isError
                      ? "bg-bad-soft text-bad-ink"
                      : "bg-ok/15 text-ok-ink"
                  }`}
                >
                  {importMessage.text}
                </p>
              ) : null}
            </div>

            {/* Actions Footer */}
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-2.5 border-t border-line/60 pt-4 mt-4">
              <button
                type="button"
                onClick={() => setInspectingDeck(deck)}
                className="btn btn-quiet min-h-9 px-3 text-xs font-semibold cursor-pointer"
              >
                👁 Preview Words
              </button>

              <div className="flex items-center gap-2 ms-auto">
                <button
                  type="button"
                  disabled={importingId === deck.id}
                  onClick={() => void handleImport(deck)}
                  className="btn btn-quiet border border-line min-h-9 px-3 text-xs font-semibold cursor-pointer hover:border-subtitle/40"
                  title="Save all words into your personal library"
                >
                  {importingId === deck.id ? "Adding…" : "📥 Add to Words"}
                </button>
                <button
                  type="button"
                  onClick={() => setPracticingDeck(deck)}
                  className="btn btn-primary min-h-9 px-4 text-xs font-bold cursor-pointer inline-flex items-center gap-1.5"
                >
                  <span>▶ Practice</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Inspect Deck Modal */}
      {inspectingDeck ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in"
          onClick={() => setInspectingDeck(null)}
        >
          <div
            className="apple-card relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden p-5 sm:p-7 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 border-b border-line pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{inspectingDeck.emoji}</span>
                  <h2 className="text-xl font-extrabold text-ink">{inspectingDeck.title}</h2>
                </div>
                <p className="text-xs sm:text-sm text-muted">{inspectingDeck.subtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setInspectingDeck(null)}
                className="rounded-full p-1.5 text-muted hover:bg-black/5 dark:hover:bg-white/10 hover:text-ink cursor-pointer text-lg leading-none"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            {/* Word List Scrollable */}
            <div className="overflow-y-auto py-4 space-y-3 divide-y divide-line/40">
              {inspectingDeck.words.map((w, idx) => (
                <div key={idx} className="pt-3 first:pt-0 flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-ink text-base">{w.text}</span>
                      <span className="text-xs font-bold text-subtitle bg-subtitle/15 px-2 py-0.5 rounded-full">
                        {w.part_of_speech}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-ink" dir="rtl">
                      {w.translation}
                    </span>
                  </div>
                  <p className="text-xs text-muted leading-relaxed">{w.definition}</p>
                  <p className="text-xs italic text-ink/80 bg-black/[0.02] dark:bg-white/[0.03] p-2 rounded-lg border border-line/40">
                    &ldquo;{w.sentence}&rdquo;{" "}
                    <span className="text-[10px] text-muted not-italic">({w.source_title})</span>
                  </p>
                </div>
              ))}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 border-t border-line pt-4">
              <button
                type="button"
                onClick={() => setInspectingDeck(null)}
                className="btn btn-quiet min-h-10 px-4 text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = inspectingDeck;
                  setInspectingDeck(null);
                  setPracticingDeck(target);
                }}
                className="btn btn-primary min-h-10 px-5 text-xs font-bold cursor-pointer"
              >
                ▶ Start Practice ({inspectingDeck.words.length} Words)
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Quick Interactive Practice Modal */}
      {practicingDeck ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-2 sm:p-4 backdrop-blur-sm overflow-y-auto"
        >
          <div className="relative w-full max-w-4xl max-h-[96vh] overflow-y-auto">
            <InteractiveLearningSession
              words={deckWordsToPracticeWords(practicingDeck)}
              onReload={() => setPracticingDeck(null)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

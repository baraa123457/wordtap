"use client";

import { useEffect, useMemo, useState } from "react";
import {
  deckWordsToPracticeWords,
  getCuratedDecks,
  importDeckToUserVocabulary,
  type CuratedDeck,
  type CuratedDeckCategory,
} from "@/lib/curated-decks";
import {
  groupWordsIntoMediaDecks,
  type MediaDeck,
} from "@/lib/media-decks";
import { fetchWords } from "@/lib/api";
import type { Word } from "@/lib/schemas";
import { canSpeak, speak } from "@/lib/speech";
import { InteractiveLearningSession } from "@/components/learn/InteractiveLearningSession";
import { useAuth } from "@/context/AuthContext";
import { SegmentedControl } from "@/components/SegmentedControl";
import {
  CheckIcon,
  DownloadIcon,
  FilmIcon,
  PlayIcon,
  SearchIcon,
  SpeakerIcon,
} from "@/components/Icons";

export default function DecksPage() {
  const { state: authState } = useAuth();

  // User's own words and auto-grouped media decks
  const [userWords, setUserWords] = useState<Word[]>([]);
  const [loadingWords, setLoadingWords] = useState(true);

  // View state: "media" (user's shows/sources) or "curated" (Friends, Suits, etc.)
  const [deckView, setDeckView] = useState<"media" | "curated">("media");
  const [mediaCategory, setMediaCategory] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<CuratedDeckCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Inspect modal & practice modal (supports both MediaDeck and CuratedDeck)
  const [inspectingDeck, setInspectingDeck] = useState<CuratedDeck | MediaDeck | null>(null);
  const [practicingDeck, setPracticingDeck] = useState<CuratedDeck | MediaDeck | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<{ id: string; text: string; isError?: boolean } | null>(null);

  // Fetch user words on mount
  useEffect(() => {
    let active = true;
    setLoadingWords(true);
    fetchWords()
      .then((words) => {
        if (!active) return;
        setUserWords(words || []);
        setLoadingWords(false);
        // If user already has words, show their media decks first!
        if (words && words.length > 0) {
          setDeckView("media");
        } else {
          setDeckView("curated");
        }
      })
      .catch(() => {
        if (active) setLoadingWords(false);
      });

    return () => {
      active = false;
    };
  }, []);

  // Group user words into show/media decks
  const userMediaDecks = useMemo(() => {
    return groupWordsIntoMediaDecks(userWords);
  }, [userWords]);

  // Filter user media decks by platform & search
  const filteredMediaDecks = useMemo(() => {
    let list = userMediaDecks;
    if (mediaCategory !== "all") {
      list = list.filter((d) => d.sourceType === mediaCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.subtitle.toLowerCase().includes(q) ||
          d.categoryLabel.toLowerCase().includes(q) ||
          d.words.some(
            (w) =>
              w.text.toLowerCase().includes(q) ||
              (w.translation || "").toLowerCase().includes(q),
          ),
      );
    }
    return list;
  }, [userMediaDecks, mediaCategory, searchQuery]);

  // Filter curated decks
  const filteredCuratedDecks = useMemo(() => {
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
      // Refresh user words to update media decks
      fetchWords().then((w) => setUserWords(w || [])).catch(() => {});
    } else {
      setImportMessage({
        id: deck.id,
        text: res.error || "Could not add deck to your library.",
        isError: true,
      });
    }
  };

  // Extract practice words from either MediaDeck or CuratedDeck
  const wordsForPractice = useMemo(() => {
    if (!practicingDeck) return [];
    if ("wordCount" in practicingDeck) {
      // It's a MediaDeck (words are already full Word objects)
      return practicingDeck.words;
    }
    // It's a CuratedDeck
    return deckWordsToPracticeWords(practicingDeck);
  }, [practicingDeck]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      {/* Hero Header */}
      <div className="flex flex-col gap-3 text-center sm:text-left">
        <div className="inline-flex items-center gap-2 self-center sm:self-start rounded-full bg-subtitle/20 border border-subtitle/30 px-3 py-1 text-xs font-bold text-ink">
          <FilmIcon size={14} className="text-amber-800 dark:text-subtitle" />
          <span>Authentic Entertainment Vocabulary</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-ink">
          Vocabulary Decks by Show &amp; Media
        </h1>
        <p className="max-w-2xl text-sm sm:text-base text-muted">
          Organize and practice the words you tapped while watching your favorite shows, movies, and YouTube videos.
        </p>
      </div>

      {/* Main Deck Mode Switcher Tabs */}
      <div className="w-full max-w-md mx-0">
        <SegmentedControl
          ariaLabel="Main deck mode"
          fill
          value={deckView}
          onChange={(val) => {
            setDeckView(val as "media" | "curated");
            setSearchQuery("");
          }}
          options={[
            {
              value: "media",
              label: (
                <span className="inline-flex items-center justify-center gap-1.5 min-w-0 truncate">
                  <span className="sm:hidden truncate">My Decks</span>
                  <span className="hidden sm:inline truncate">🎬 My Show &amp; Media Decks</span>
                  {userMediaDecks.length > 0 ? (
                    <span className="rounded-full bg-subtitle/20 px-1.5 py-0.2 text-[length:var(--text-label)] font-bold text-amber-900 dark:text-subtitle shrink-0">
                      {userMediaDecks.length}
                    </span>
                  ) : null}
                </span>
              ),
            },
            {
              value: "curated",
              label: (
                <span className="inline-flex items-center justify-center gap-1.5 min-w-0 truncate">
                  <span className="sm:hidden truncate">Curated</span>
                  <span className="hidden sm:inline truncate">🌟 Curated Show Decks</span>
                </span>
              ),
            },
          ]}
        />
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {deckView === "media" ? (
          /* Media Category Pills */
          <SegmentedControl
            ariaLabel="Filter media decks"
            value={mediaCategory}
            onChange={setMediaCategory}
            options={[
              { value: "all", label: `All Shows (${userMediaDecks.length})` },
              { value: "netflix", label: "🎬 Netflix" },
              { value: "youtube", label: "▶️ YouTube" },
              { value: "vlc", label: "🍿 VLC Player" },
              { value: "web", label: "🌐 Web" },
            ]}
          />
        ) : (
          /* Curated Category Pills */
          <SegmentedControl
            ariaLabel="Filter curated decks"
            value={selectedCategory}
            onChange={(val) => setSelectedCategory(val as CuratedDeckCategory)}
            options={[
              { value: "all", label: "All Decks" },
              { value: "tv_shows", label: "TV Shows" },
              { value: "career_tech", label: "Career & Tech" },
              { value: "ielts_academic", label: "IELTS & Academic" },
            ]}
          />
        )}

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={deckView === "media" ? "Search shows or words…" : "Search words or shows…"}
            className="field w-full py-1.5 ps-9 text-xs sm:text-sm"
          />
          <span className="absolute start-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
            <SearchIcon size={14} />
          </span>
        </div>
      </div>

      {/* CONTENT: MY MEDIA DECKS */}
      {deckView === "media" ? (
        filteredMediaDecks.length > 0 ? (
          <div className="grid gap-5 md:grid-cols-2">
            {filteredMediaDecks.map((deck) => (
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
                    <span className="rounded-full bg-subtitle/15 border border-subtitle/30 px-2.5 py-0.5 text-[length:var(--text-label)] font-bold text-amber-900 dark:text-subtitle">
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

                  {/* Sample word preview chips with Arabic translations */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {deck.words.slice(0, 4).map((w, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface/80 px-2 py-0.5 text-xs font-semibold text-ink"
                      >
                        <span>{w.text}</span>
                        {w.translation ? (
                          <span className="text-[length:var(--text-label)] text-muted font-normal" dir="rtl">
                            ({w.translation})
                          </span>
                        ) : null}
                      </span>
                    ))}
                    {deck.words.length > 4 ? (
                      <button
                        type="button"
                        onClick={() => setInspectingDeck(deck)}
                        className="text-[length:var(--text-control)] font-bold text-subtitle hover:underline cursor-pointer ps-1 py-1 min-h-11 inline-flex items-center"
                      >
                        +{deck.words.length - 4} more
                      </button>
                    ) : null}
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="relative z-10 flex flex-wrap items-center justify-between gap-2.5 border-t border-line/60 pt-4 mt-4">
                  <button
                    type="button"
                    onClick={() => setInspectingDeck(deck)}
                    className="btn btn-quiet min-h-11 px-3.5 text-[length:var(--text-control)] font-semibold cursor-pointer"
                  >
                    Preview Words
                  </button>

                  <button
                    type="button"
                    onClick={() => setPracticingDeck(deck)}
                    className="btn btn-primary min-h-11 px-4 text-[length:var(--text-control)] font-bold cursor-pointer inline-flex items-center gap-1.5 ms-auto"
                  >
                    <PlayIcon size={11} />
                    <span>Practice</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Empty State for Media Decks */
          <div className="apple-card flex flex-col items-center justify-center p-8 sm:p-12 text-center">
            <span className="text-4xl mb-3">🍿</span>
            <h3 className="text-lg sm:text-xl font-bold text-ink">
              {loadingWords ? "Loading your show decks…" : "No words saved from shows yet"}
            </h3>
            <p className="max-w-md text-xs sm:text-sm text-muted mt-1.5 mb-5 leading-relaxed">
              When you watch videos in <strong>WordTap VLC Player</strong>, Netflix, or YouTube and click on words in subtitles, custom show decks will automatically appear right here!
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setDeckView("curated")}
                className="btn btn-primary min-h-11 px-4 text-[length:var(--text-control)] font-bold cursor-pointer"
              >
                Browse Curated Decks →
              </button>
            </div>
          </div>
        )
      ) : (
        /* CONTENT: CURATED SHOW DECKS */
        <div className="grid gap-5 md:grid-cols-2">
          {filteredCuratedDecks.map((deck) => (
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
                  <span className="rounded-full bg-subtitle/15 border border-subtitle/30 px-2.5 py-0.5 text-[length:var(--text-label)] font-bold text-amber-900 dark:text-subtitle">
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
                      <span className="text-[length:var(--text-label)] text-muted font-normal">({w.translation})</span>
                    </span>
                  ))}
                  {deck.words.length > 4 ? (
                    <button
                      type="button"
                      onClick={() => setInspectingDeck(deck)}
                      className="text-[length:var(--text-control)] font-bold text-subtitle hover:underline cursor-pointer ps-1 py-1 min-h-11 inline-flex items-center"
                    >
                      +{deck.words.length - 4} more
                    </button>
                  ) : null}
                </div>

                {/* Import status message */}
                {importMessage?.id === deck.id ? (
                  <p
                    className={`text-xs font-medium rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 ${
                      importMessage.isError
                        ? "bg-bad-soft text-bad-ink"
                        : "bg-ok/15 text-ok-ink"
                    }`}
                  >
                    {!importMessage.isError ? <CheckIcon size={13} className="shrink-0 text-ok" /> : null}
                    <span>{importMessage.text}</span>
                  </p>
                ) : null}
              </div>

              {/* Actions Footer */}
              <div className="relative z-10 flex flex-wrap items-center justify-between gap-2.5 border-t border-line/60 pt-4 mt-4">
                <button
                  type="button"
                  onClick={() => setInspectingDeck(deck)}
                  className="btn btn-quiet min-h-11 px-3.5 text-[length:var(--text-control)] font-semibold cursor-pointer"
                >
                  Preview Words
                </button>

                <div className="flex items-center gap-2 ms-auto">
                  <button
                    type="button"
                    disabled={importingId === deck.id}
                    onClick={() => void handleImport(deck)}
                    className="btn btn-quiet border border-line min-h-11 px-3.5 text-[length:var(--text-control)] font-semibold cursor-pointer hover:border-subtitle/40 inline-flex items-center gap-1.5"
                    title="Save all words into your personal library"
                  >
                    <DownloadIcon size={13} />
                    <span>{importingId === deck.id ? "Adding…" : "Add to Words"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPracticingDeck(deck)}
                    className="btn btn-primary min-h-11 px-4 text-[length:var(--text-control)] font-bold cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <PlayIcon size={11} />
                    <span>Practice</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Inspect Deck Modal (Supports both MediaDeck and CuratedDeck) */}
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
                      {canSpeak() ? (
                        <button
                          type="button"
                          onClick={() => speak(w.text, ("src_lang" in w ? (w.src_lang as string) : "en") || "en")}
                          className="text-muted hover:text-ink p-1 cursor-pointer transition-colors"
                          title="Pronounce"
                        >
                          <SpeakerIcon size={14} />
                        </button>
                      ) : null}
                      {w.part_of_speech ? (
                        <span className="text-[length:var(--text-label)] font-bold text-subtitle bg-subtitle/15 px-2 py-0.5 rounded-full">
                          {w.part_of_speech}
                        </span>
                      ) : null}
                    </div>
                    <span className="text-sm font-bold text-ink" dir="rtl">
                      {w.translation}
                    </span>
                  </div>
                  {w.definition ? (
                    <p className="text-xs text-muted leading-relaxed">{w.definition}</p>
                  ) : null}
                  {w.sentence ? (
                    <p className="text-xs italic text-ink/80 bg-black/[0.02] dark:bg-white/[0.03] p-2 rounded-lg border border-line/40">
                      &ldquo;{w.sentence}&rdquo;{" "}
                      {w.source_title ? (
                        <span className="text-[length:var(--text-label)] text-muted not-italic">({w.source_title})</span>
                      ) : null}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 border-t border-line pt-4">
              <button
                type="button"
                onClick={() => setInspectingDeck(null)}
                className="btn btn-quiet min-h-11 px-4 text-[length:var(--text-control)] font-semibold cursor-pointer"
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
                className="btn btn-primary min-h-11 px-5 text-[length:var(--text-control)] font-bold cursor-pointer"
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
              words={wordsForPractice}
              onReload={() => setPracticingDeck(null)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

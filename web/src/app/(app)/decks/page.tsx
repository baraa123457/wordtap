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
import { deleteWord, fetchWords, updateWordDetails } from "@/lib/api";
import type { Word } from "@/lib/schemas";
import { canSpeak, speak } from "@/lib/speech";
import { InteractiveLearningSession } from "@/components/learn/InteractiveLearningSession";
import { ReviewSession } from "@/components/review/ReviewSession";
import { useAuth } from "@/context/AuthContext";
import { SegmentedControl } from "@/components/SegmentedControl";
import {
  AcademicIcon,
  BookOpenIcon,
  BriefcaseIcon,
  CheckIcon,
  CloseIcon,
  DownloadIcon,
  FilmIcon,
  GlobeIcon,
  LayersIcon,
  PlayIcon,
  SearchIcon,
  SpeakerIcon,
  SparklesIcon,
  TrashIcon,
  TvIcon,
  YoutubeIcon,
} from "@/components/Icons";

function getDeckCategoryIcon(category: string, sourceType?: string) {
  if (sourceType === "netflix" || category === "tv_shows") {
    return <TvIcon size={14} className="shrink-0 text-amber-700 dark:text-subtitle" />;
  }
  if (sourceType === "youtube") {
    return <YoutubeIcon size={14} className="shrink-0 text-red-500" />;
  }
  if (sourceType === "pdf") {
    return <BookOpenIcon size={14} className="shrink-0 text-amber-600 dark:text-amber-400" />;
  }
  if (sourceType === "vlc") {
    return <FilmIcon size={14} className="shrink-0 text-amber-600 dark:text-amber-400" />;
  }
  if (sourceType === "web") {
    return <GlobeIcon size={14} className="shrink-0 text-sky-500" />;
  }
  if (category === "career_tech") {
    return <BriefcaseIcon size={14} className="shrink-0 text-blue-500" />;
  }
  if (category === "ielts_academic") {
    return <AcademicIcon size={14} className="shrink-0 text-amber-700 dark:text-subtitle" />;
  }
  return <LayersIcon size={14} className="shrink-0 text-amber-700 dark:text-subtitle" />;
}

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

  // Inspect modal, practice setup modal & active practice queue
  const [inspectingDeck, setInspectingDeck] = useState<CuratedDeck | MediaDeck | null>(null);
  const [configuringDeck, setConfiguringDeck] = useState<CuratedDeck | MediaDeck | null>(null);
  const [primaryMode, setPrimaryMode] = useState<"easy" | "hard">("hard");
  const [overrideKeys, setOverrideKeys] = useState<Set<string>>(() => new Set());
  const [practiceQueue, setPracticeQueue] = useState<
    Array<{ mode: "easy" | "hard"; words: Word[]; allDeckWords?: Word[] }>
  >([]);
  const [practicingDeck, setPracticingDeck] = useState<CuratedDeck | MediaDeck | null>(null);
  const [editingWordId, setEditingWordId] = useState<string | null>(null);
  const [editWordText, setEditWordText] = useState("");
  const [editWordTranslation, setEditWordTranslation] = useState("");
  const [wordActionBusyId, setWordActionBusyId] = useState<string | null>(null);
  const [wordActionError, setWordActionError] = useState<string | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<{ id: string; text: string; isError?: boolean } | null>(null);
  const [speakingWord, setSpeakingWord] = useState<string | null>(null);

  // Lock background scroll when inspecting or practicing modal is open (Apple HIG Modality)
  useEffect(() => {
    if (inspectingDeck || practicingDeck || configuringDeck || practiceQueue.length > 0) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [inspectingDeck, practicingDeck, configuringDeck, practiceQueue.length]);

  // Handle Escape key to close modal (Apple HIG Keyboard Navigation)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (configuringDeck) {
          setConfiguringDeck(null);
        } else if (inspectingDeck) {
          setInspectingDeck(null);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [inspectingDeck, configuringDeck]);

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

  const handleSpeak = (text: string, lang = "en") => {
    if (!canSpeak()) return;
    setSpeakingWord(text);
    speak(text, lang);
    setTimeout(() => {
      setSpeakingWord((curr) => (curr === text ? null : curr));
    }, 1200);
  };

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
          d.words.some((w) => w.text.toLowerCase().includes(q) || (w.translation || "").includes(q)),
      );
    }
    return list;
  }, [selectedCategory, searchQuery]);

  function getDeckWordKey(w: Word | CuratedDeck["words"][number], idx: number) {
    return "id" in w && typeof w.id === "string" ? w.id : `${w.text}-${idx}`;
  }

  function openPracticeSetup(deck: CuratedDeck | MediaDeck) {
    setOverrideKeys(new Set());
    setConfiguringDeck(deck);
  }

  function toggleWordOverride(key: string) {
    setOverrideKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function startConfiguredPractice() {
    if (!configuringDeck) return;
    const allWords: Word[] =
      "wordCount" in configuringDeck
        ? configuringDeck.words
        : deckWordsToPracticeWords(configuringDeck);

    const oppositeMode: "easy" | "hard" = primaryMode === "easy" ? "hard" : "easy";
    const primaryWords: Word[] = [];
    const oppositeWords: Word[] = [];

    configuringDeck.words.forEach((rawWord, idx) => {
      const key = getDeckWordKey(rawWord, idx);
      const practiceWord = allWords[idx];
      if (!practiceWord) return;
      if (overrideKeys.has(key)) {
        oppositeWords.push(practiceWord);
      } else {
        primaryWords.push(practiceWord);
      }
    });

    const queue: Array<{ mode: "easy" | "hard"; words: Word[]; allDeckWords?: Word[] }> = [];
    const enqueueSegment = (mode: "easy" | "hard", segmentWords: Word[]) => {
      if (segmentWords.length === 0) return;
      if (mode === "easy") {
        // Easy mode runs in 5-word batches: Multiple Choice -> Connect Words -> Write Translation
        for (let i = 0; i < segmentWords.length; i += 5) {
          queue.push({
            mode: "easy",
            words: segmentWords.slice(i, i + 5),
            allDeckWords: allWords,
          });
        }
      } else {
        queue.push({ mode: "hard", words: segmentWords, allDeckWords: allWords });
      }
    };

    enqueueSegment(primaryMode, primaryWords);
    enqueueSegment(oppositeMode, oppositeWords);
    if (queue.length === 0) return;

    setConfiguringDeck(null);
    setPracticeQueue(queue);
  }

  function advancePracticeQueue() {
    setPracticeQueue((prev) => {
      const next = prev.slice(1);
      if (next.length === 0) {
        fetchWords().then(setUserWords).catch(() => {});
      }
      return next;
    });
  }

  function handlePracticeSingleWord(w: Word | CuratedDeck["words"][number]) {
    if (!inspectingDeck) return;
    if ("wordCount" in inspectingDeck) {
      const wordObj = w as Word;
      const singleDeck: MediaDeck = {
        ...inspectingDeck,
        words: [wordObj],
        wordCount: 1,
        subtitle: "1 word selected",
      };
      setInspectingDeck(null);
      setPracticingDeck(singleDeck);
    } else {
      const curatedWord = w as CuratedDeck["words"][number];
      const singleCurated: CuratedDeck = {
        ...inspectingDeck,
        words: [curatedWord],
      };
      setInspectingDeck(null);
      setPracticingDeck(singleCurated);
    }
  }

  async function handleSaveInspectWord(w: Word) {
    const cleanText = editWordText.trim();
    const cleanTrans = editWordTranslation.trim();
    if (!cleanText || !cleanTrans) return;
    setWordActionBusyId(w.id);
    setWordActionError(null);
    try {
      await updateWordDetails(w.id, { text: cleanText, translation: cleanTrans }, w);
      setUserWords((prev) =>
        prev.map((item) =>
          item.id === w.id ? { ...item, text: cleanText, translation: cleanTrans } : item,
        ),
      );
      setInspectingDeck((prev) => {
        if (!prev || !("wordCount" in prev)) return prev;
        return {
          ...prev,
          words: prev.words.map((item) =>
            item.id === w.id ? { ...item, text: cleanText, translation: cleanTrans } : item,
          ),
        };
      });
      setEditingWordId(null);
    } catch (e: unknown) {
      setWordActionError(e instanceof Error ? e.message : "Could not update word.");
    } finally {
      setWordActionBusyId(null);
    }
  }

  async function handleDeleteInspectWord(w: Word) {
    setWordActionBusyId(w.id);
    setWordActionError(null);
    try {
      await deleteWord(w.id);
      setUserWords((prev) => prev.filter((item) => item.id !== w.id));
      setInspectingDeck((prev) => {
        if (!prev || !("wordCount" in prev)) return prev;
        const nextWords = prev.words.filter((item) => item.id !== w.id);
        if (nextWords.length === 0) return null;
        return {
          ...prev,
          words: nextWords,
          wordCount: nextWords.length,
          subtitle: `${nextWords.length} ${nextWords.length === 1 ? "word" : "words"} collected while watching`,
        };
      });
      if (editingWordId === w.id) setEditingWordId(null);
    } catch (e: unknown) {
      setWordActionError(e instanceof Error ? e.message : "Could not delete word.");
    } finally {
      setWordActionBusyId(null);
    }
  }

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
        <div className="inline-flex items-center gap-2 self-center sm:self-start rounded-full bg-subtitle/15 border border-subtitle/30 px-3 py-1 text-xs font-bold text-amber-800 dark:text-subtitle">
          <FilmIcon size={14} className="shrink-0" />
          <span>Authentic Entertainment Vocabulary</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-ink">
          Vocabulary Decks by Show &amp; Media
        </h1>
        <p className="max-w-2xl text-sm sm:text-base text-muted leading-relaxed">
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
                <span className="inline-flex items-center justify-center gap-2 min-w-0 truncate">
                  <FilmIcon size={14} className="shrink-0 text-amber-700 dark:text-subtitle" />
                  <span className="sm:hidden truncate">My Decks</span>
                  <span className="hidden sm:inline truncate">My Show Decks</span>
                  {userMediaDecks.length > 0 ? (
                    <span className="rounded-full bg-subtitle/20 px-1.5 py-0.5 text-[length:var(--text-label)] font-bold text-amber-900 dark:text-subtitle shrink-0">
                      {userMediaDecks.length}
                    </span>
                  ) : null}
                </span>
              ),
            },
            {
              value: "curated",
              label: (
                <span className="inline-flex items-center justify-center gap-2 min-w-0 truncate">
                  <SparklesIcon size={14} className="shrink-0 text-amber-700 dark:text-subtitle" />
                  <span className="sm:hidden truncate">Curated</span>
                  <span className="hidden sm:inline truncate">Curated Decks</span>
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
              {
                value: "netflix",
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <TvIcon size={13} className="shrink-0" />
                    <span>Netflix</span>
                  </span>
                ),
              },
              {
                value: "youtube",
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <YoutubeIcon size={13} className="shrink-0" />
                    <span>YouTube</span>
                  </span>
                ),
              },
              {
                value: "vlc",
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <FilmIcon size={13} className="shrink-0" />
                    <span>VLC Player</span>
                  </span>
                ),
              },
              {
                value: "web",
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <GlobeIcon size={13} className="shrink-0" />
                    <span>Web</span>
                  </span>
                ),
              },
            ]}
          />
        ) : (
          /* Curated Category Pills */
          <SegmentedControl
            ariaLabel="Filter curated decks"
            value={selectedCategory}
            onChange={(val) => setSelectedCategory(val as CuratedDeckCategory)}
            options={[
              { value: "all", label: "All Categories" },
              {
                value: "tv_shows",
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <TvIcon size={13} className="shrink-0" />
                    <span>TV Shows</span>
                  </span>
                ),
              },
              {
                value: "career_tech",
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <BriefcaseIcon size={13} className="shrink-0" />
                    <span>Career & Tech</span>
                  </span>
                ),
              },
              {
                value: "ielts_academic",
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <AcademicIcon size={13} className="shrink-0" />
                    <span>IELTS & Academic</span>
                  </span>
                ),
              },
            ]}
          />
        )}

        {/* Search Input with Clear Button */}
        <div className="relative w-full sm:w-72">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={deckView === "media" ? "Search shows or words…" : "Search words or shows…"}
            className="field w-full py-2 ps-9 pe-8 text-xs sm:text-sm rounded-xl border border-line bg-surface/70 focus:bg-surface transition-all"
            aria-label="Search decks"
          />
          <span className="absolute start-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
            <SearchIcon size={14} />
          </span>
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute end-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink p-1 rounded-full cursor-pointer transition-colors"
              aria-label="Clear search"
            >
              <CloseIcon />
            </button>
          ) : null}
        </div>
      </div>

      {/* SKELETON LOADING STATE (Eliminates Cumulative Layout Shift) */}
      {loadingWords && deckView === "media" ? (
        <div className="grid gap-5 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="apple-card p-5 sm:p-6 flex flex-col justify-between gap-4 animate-pulse border border-line/60"
            >
              <div className="flex items-center justify-between">
                <div className="h-4 w-28 bg-line/60 rounded-full" />
                <div className="h-5 w-20 bg-line/50 rounded-full" />
              </div>
              <div className="space-y-2">
                <div className="h-6 w-3/4 bg-line/70 rounded-lg" />
                <div className="h-4 w-1/2 bg-line/50 rounded-lg" />
                <div className="h-4 w-full bg-line/40 rounded-lg" />
              </div>
              <div className="flex gap-2 pt-1">
                <div className="h-6 w-20 bg-line/50 rounded-md" />
                <div className="h-6 w-24 bg-line/50 rounded-md" />
                <div className="h-6 w-16 bg-line/50 rounded-md" />
              </div>
              <div className="flex justify-between items-center pt-4 border-t border-line/40">
                <div className="h-9 w-28 bg-line/50 rounded-lg" />
                <div className="h-9 w-24 bg-line/60 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : deckView === "media" ? (
        /* CONTENT: MY MEDIA DECKS */
        filteredMediaDecks.length > 0 ? (
          <div className="grid gap-5 md:grid-cols-2">
            {filteredMediaDecks.map((deck) => (
              <div
                key={deck.id}
                className="apple-card relative flex flex-col justify-between overflow-hidden p-5 sm:p-6 transition-all hover:border-subtitle/50 shadow-xs"
              >
                {/* Top decorative gradient glow */}
                <div
                  className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${deck.gradient} pointer-events-none opacity-40`}
                />

                <div className="relative z-10 flex flex-col gap-3">
                  {/* Header tags */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-muted">
                      {getDeckCategoryIcon("", deck.sourceType)}
                      <span>{deck.categoryLabel}</span>
                    </span>
                    <span className="rounded-full bg-subtitle/15 border border-subtitle/30 px-2.5 py-0.5 text-[length:var(--text-label)] font-bold text-amber-900 dark:text-subtitle">
                      {deck.badge}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-ink">{deck.title}</h2>
                    <p className="text-xs font-semibold text-amber-700 dark:text-subtitle">{deck.subtitle}</p>
                    <p className="mt-1.5 text-xs sm:text-sm text-muted line-clamp-2 leading-relaxed">
                      {deck.description}
                    </p>
                  </div>

                  {/* Sample word preview chips with interactive pronunciation */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {deck.words.slice(0, 4).map((w, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSpeak(w.text, ("src_lang" in w ? (w.src_lang as string) : "en") || "en");
                        }}
                        className={`inline-flex items-center gap-1.5 rounded-lg border border-line/80 bg-surface/90 hover:bg-surface-elevated hover:border-subtitle/50 px-2.5 py-1 text-xs font-semibold text-ink cursor-pointer transition-all active:scale-95 ${
                          speakingWord === w.text ? "ring-2 ring-subtitle/60 border-subtitle bg-subtitle/10" : ""
                        }`}
                        title={`Click to listen: "${w.text}"`}
                      >
                        <span>{w.text}</span>
                        {w.translation ? (
                          <span className="text-[length:var(--text-label)] text-muted font-normal" dir="rtl">
                            ({w.translation})
                          </span>
                        ) : null}
                      </button>
                    ))}
                    {deck.words.length > 4 ? (
                      <button
                        type="button"
                        onClick={() => setInspectingDeck(deck)}
                        className="text-xs font-bold text-amber-700 dark:text-subtitle hover:underline cursor-pointer ps-1.5 py-1 inline-flex items-center"
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
                    onClick={() => openPracticeSetup(deck)}
                    className="btn btn-primary min-h-11 px-4 text-[length:var(--text-control)] font-bold cursor-pointer inline-flex items-center gap-1.5 ms-auto"
                  >
                    <PlayIcon size={11} />
                    <span>Practice</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : searchQuery.trim() ? (
          /* Empty Search Results */
          <div className="apple-card flex flex-col items-center justify-center p-10 text-center">
            <SearchIcon size={28} className="text-muted mb-2 opacity-60" />
            <h3 className="font-bold text-ink text-base">No show decks matching &ldquo;{searchQuery}&rdquo;</h3>
            <p className="text-xs text-muted mt-1 mb-4">Try searching for another word or clear your search query.</p>
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="btn btn-quiet border border-line text-xs font-semibold px-4 py-2 cursor-pointer"
            >
              Clear search
            </button>
          </div>
        ) : (
          /* Empty State for Media Decks */
          <div className="apple-card flex flex-col items-center justify-center p-8 sm:p-14 text-center">
            <div className="w-14 h-14 rounded-2xl bg-subtitle/15 border border-subtitle/30 flex items-center justify-center text-amber-700 dark:text-subtitle mb-4 shadow-sm">
              <FilmIcon size={28} />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-ink">
              No words saved from shows yet
            </h3>
            <p className="max-w-md text-xs sm:text-sm text-muted mt-2 mb-6 leading-relaxed">
              When you watch videos in <strong>WordTap VLC Player</strong>, Netflix, or YouTube and click on subtitle words, custom show decks will automatically appear right here!
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setDeckView("curated")}
                className="btn btn-primary min-h-11 px-5 text-[length:var(--text-control)] font-bold cursor-pointer inline-flex items-center gap-2"
              >
                <SparklesIcon size={14} />
                <span>Browse Curated Decks</span>
              </button>
            </div>
          </div>
        )
      ) : (
        /* CONTENT: CURATED SHOW DECKS */
        filteredCuratedDecks.length > 0 ? (
          <div className="grid gap-5 md:grid-cols-2">
            {filteredCuratedDecks.map((deck) => (
              <div
                key={deck.id}
                className="apple-card relative flex flex-col justify-between overflow-hidden p-5 sm:p-6 transition-all hover:border-subtitle/50 shadow-xs"
              >
                {/* Top decorative gradient glow */}
                <div
                  className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${deck.gradient} pointer-events-none opacity-40`}
                />

                <div className="relative z-10 flex flex-col gap-3">
                  {/* Header tags */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-muted">
                      {getDeckCategoryIcon(deck.category)}
                      <span>{deck.categoryLabel.replace(/^[^\w\s]+\s*/, "")}</span>
                    </span>
                    <span className="rounded-full bg-subtitle/15 border border-subtitle/30 px-2.5 py-0.5 text-[length:var(--text-label)] font-bold text-amber-900 dark:text-subtitle">
                      {deck.badge}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-ink">{deck.title}</h2>
                    <p className="text-xs font-semibold text-amber-700 dark:text-subtitle">{deck.subtitle}</p>
                    <p className="mt-1.5 text-xs sm:text-sm text-muted line-clamp-2 leading-relaxed">
                      {deck.description}
                    </p>
                  </div>

                  {/* Sample word preview chips with interactive pronunciation */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {deck.words.slice(0, 4).map((w, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSpeak(w.text, "en");
                        }}
                        className={`inline-flex items-center gap-1.5 rounded-lg border border-line/80 bg-surface/90 hover:bg-surface-elevated hover:border-subtitle/50 px-2.5 py-1 text-xs font-semibold text-ink cursor-pointer transition-all active:scale-95 ${
                          speakingWord === w.text ? "ring-2 ring-subtitle/60 border-subtitle bg-subtitle/10" : ""
                        }`}
                        title={`Click to listen: "${w.text}"`}
                      >
                        <span>{w.text}</span>
                        <span className="text-[length:var(--text-label)] text-muted font-normal" dir="rtl">
                          ({w.translation})
                        </span>
                      </button>
                    ))}
                    {deck.words.length > 4 ? (
                      <button
                        type="button"
                        onClick={() => setInspectingDeck(deck)}
                        className="text-xs font-bold text-amber-700 dark:text-subtitle hover:underline cursor-pointer ps-1.5 py-1 inline-flex items-center"
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
                      onClick={() => openPracticeSetup(deck)}
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
        ) : (
          /* Empty Search Results for Curated */
          <div className="apple-card flex flex-col items-center justify-center p-10 text-center">
            <SearchIcon size={28} className="text-muted mb-2 opacity-60" />
            <h3 className="font-bold text-ink text-base">No curated decks matching &ldquo;{searchQuery}&rdquo;</h3>
            <p className="text-xs text-muted mt-1 mb-4">Try searching for another word or topic.</p>
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="btn btn-quiet border border-line text-xs font-semibold px-4 py-2 cursor-pointer"
            >
              Clear search
            </button>
          </div>
        )
      )}

      {/* Inspect Deck Modal (Apple Design Liquid Glass & Accessible Modality) */}
      {inspectingDeck ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-deck-title"
          aria-describedby="modal-deck-subtitle"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setInspectingDeck(null)}
        >
          <div
            className="apple-card relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden p-5 sm:p-7 shadow-2xl border border-line/80 dark:border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 border-b border-line pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-subtitle/15 text-amber-700 dark:text-subtitle">
                    {getDeckCategoryIcon("category" in inspectingDeck ? inspectingDeck.category : "", "sourceType" in inspectingDeck ? inspectingDeck.sourceType : undefined)}
                  </span>
                  <h2 id="modal-deck-title" className="text-xl font-extrabold text-ink tracking-tight">
                    {inspectingDeck.title}
                  </h2>
                </div>
                <p id="modal-deck-subtitle" className="text-xs sm:text-sm font-semibold text-amber-700 dark:text-subtitle">
                  {inspectingDeck.subtitle}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectingDeck(null)}
                className="rounded-full p-2 text-muted hover:bg-black/5 dark:hover:bg-white/10 hover:text-ink cursor-pointer transition-colors"
                aria-label="Close modal"
              >
                <CloseIcon />
              </button>
            </div>

            {/* Word List Scrollable */}
            {wordActionError ? (
              <div className="mt-3 rounded-xl border border-bad/40 bg-bad-soft px-3 py-2 text-xs text-bad-ink">
                {wordActionError}
              </div>
            ) : null}
            <div className="overflow-y-auto py-4 space-y-3 divide-y divide-line/40 focus:outline-none">
              {inspectingDeck.words.map((w, idx) => {
                const isUserWord = "id" in w && typeof w.id === "string";
                const wordId = isUserWord ? (w as Word).id : `${idx}`;
                const isEditing = isUserWord && editingWordId === wordId;
                const isBusy = isUserWord && wordActionBusyId === wordId;

                return (
                  <div key={wordId} className="pt-3.5 first:pt-0 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-extrabold text-ink text-base tracking-tight truncate">{w.text}</span>
                        {canSpeak() ? (
                          <button
                            type="button"
                            onClick={() => handleSpeak(w.text, ("src_lang" in w ? (w.src_lang as string) : "en") || "en")}
                            className={`p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-muted hover:text-ink cursor-pointer transition-colors ${
                              speakingWord === w.text ? "text-amber-700 dark:text-subtitle bg-subtitle/15" : ""
                            }`}
                            title="Listen pronunciation"
                          >
                            <SpeakerIcon size={14} />
                          </button>
                        ) : null}
                        {w.part_of_speech ? (
                          <span className="text-[length:var(--text-label)] font-bold text-amber-800 dark:text-subtitle bg-subtitle/15 px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                            {w.part_of_speech}
                          </span>
                        ) : null}
                      </div>
                      <span className="text-sm font-bold text-ink shrink-0" dir="rtl">
                        {w.translation}
                      </span>
                    </div>

                    {w.definition ? (
                      <p className="text-xs text-muted leading-relaxed">{w.definition}</p>
                    ) : null}

                    {w.sentence ? (
                      <div className="text-xs italic text-ink/80 bg-black/[0.02] dark:bg-white/[0.03] p-2.5 rounded-xl border border-line/50 leading-relaxed">
                        &ldquo;{w.sentence}&rdquo;{" "}
                        {w.source_title ? (
                          <span className="text-[length:var(--text-label)] text-muted not-italic font-medium">({w.source_title})</span>
                        ) : null}
                      </div>
                    ) : null}

                    {/* Per-Word Actions: Practice (Primary), Edit (Quiet), Remove (Destructive Quiet) */}
                    <div className="flex flex-wrap items-center justify-end gap-1.5 pt-1">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handlePracticeSingleWord(w)}
                        className="btn btn-primary min-h-11 px-3.5 py-1 text-[length:var(--text-control)] font-bold rounded-lg transition-all cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
                        title={`Practice "${w.text}"`}
                      >
                        <PlayIcon size={11} />
                        <span>Practice</span>
                      </button>
                      {isUserWord ? (
                        <>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => {
                              if (isEditing) {
                                setEditingWordId(null);
                              } else {
                                setEditingWordId(wordId);
                                setEditWordText(w.text);
                                setEditWordTranslation(w.translation || "");
                              }
                            }}
                            className={`btn min-h-11 px-3.5 py-1 text-[length:var(--text-control)] font-medium rounded-lg transition-all cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50 ${
                              isEditing
                                ? "bg-subtitle text-subtitle-ink font-semibold shadow-xs"
                                : "btn-quiet text-muted hover:text-ink hover:bg-black/5 dark:hover:bg-white/10"
                            }`}
                            title={`Edit “${w.text}”`}
                            aria-label={`Edit “${w.text}”`}
                          >
                            <svg className="w-3.5 h-3.5 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                            </svg>
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleDeleteInspectWord(w as Word)}
                            className="btn btn-quiet min-h-11 min-w-11 px-3 py-1 text-[length:var(--text-control)] font-medium text-muted hover:text-bad hover:bg-bad/10 rounded-lg transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                            title={`Remove “${w.text}”`}
                            aria-label={`Delete “${w.text}”`}
                          >
                            <TrashIcon size={14} />
                            <span>Remove</span>
                          </button>
                        </>
                      ) : null}
                    </div>

                    {/* Inline Edit Form */}
                    {isEditing ? (
                      <div className="mt-1 rounded-xl border border-subtitle/40 bg-black/[0.03] dark:bg-white/[0.04] p-3 grid gap-2.5">
                        <div className="grid gap-2.5 sm:grid-cols-2">
                          <div>
                            <label className="block text-[length:var(--text-label)] font-semibold text-muted mb-1">
                              Word
                            </label>
                            <input
                              type="text"
                              value={editWordText}
                              onChange={(e) => setEditWordText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  void handleSaveInspectWord(w as Word);
                                } else if (e.key === "Escape") {
                                  setEditingWordId(null);
                                }
                              }}
                              className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink focus:border-subtitle focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[length:var(--text-label)] font-semibold text-muted mb-1">
                              Translation
                            </label>
                            <input
                              type="text"
                              dir="auto"
                              value={editWordTranslation}
                              onChange={(e) => setEditWordTranslation(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  void handleSaveInspectWord(w as Word);
                                } else if (e.key === "Escape") {
                                  setEditingWordId(null);
                                }
                              }}
                              className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink focus:border-subtitle focus:outline-none"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingWordId(null)}
                            className="btn btn-quiet px-3 py-1 text-xs font-semibold cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={isBusy || !editWordText.trim() || !editWordTranslation.trim()}
                            onClick={() => void handleSaveInspectWord(w as Word)}
                            className="btn btn-primary px-3 py-1 text-xs font-bold cursor-pointer disabled:opacity-50"
                          >
                            {isBusy ? "Saving..." : "Save"}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
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
                  openPracticeSetup(target);
                }}
                className="btn btn-primary min-h-11 px-5 text-[length:var(--text-control)] font-bold cursor-pointer inline-flex items-center gap-2"
              >
                <PlayIcon size={12} />
                <span>Start Practice ({inspectingDeck.words.length} Words)</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Practice Mode Picker Modal (Easy vs Hard + Per-Word Override Selection) */}
      {configuringDeck ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-practice-setup-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setConfiguringDeck(null)}
        >
          <div
            className="apple-card relative flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden p-5 sm:p-7 shadow-2xl border border-line/80 dark:border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-line pb-4">
              <div className="space-y-1">
                <h2 id="modal-practice-setup-title" className="text-xl font-extrabold text-ink tracking-tight">
                  Choose Practice Mode
                </h2>
                <p className="text-xs sm:text-sm text-muted">
                  {configuringDeck.title} · {configuringDeck.words.length}{" "}
                  {configuringDeck.words.length === 1 ? "word" : "words"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfiguringDeck(null)}
                className="rounded-full p-2 text-muted hover:bg-black/5 dark:hover:bg-white/10 hover:text-ink cursor-pointer transition-colors"
                aria-label="Close modal"
              >
                <CloseIcon />
              </button>
            </div>

            {/* Mode Cards: Easy vs Hard */}
            <div className="grid gap-3 sm:grid-cols-2 pt-4">
              <button
                type="button"
                onClick={() => {
                  setPrimaryMode("easy");
                  setOverrideKeys(new Set());
                }}
                className={`flex flex-col items-start gap-1.5 p-4 rounded-2xl border text-start transition-all cursor-pointer ${
                  primaryMode === "easy"
                    ? "border-subtitle bg-subtitle/10 ring-2 ring-subtitle shadow-xs"
                    : "border-line bg-surface hover:border-subtitle/40"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-bold text-ink text-sm">Easy (Quick Review)</span>
                  <span
                    className={`w-4 h-4 rounded-full border flex items-center justify-center text-[length:var(--text-label)] font-bold ${
                      primaryMode === "easy" ? "bg-subtitle text-subtitle-ink border-subtitle" : "border-line"
                    }`}
                  >
                    {primaryMode === "easy" ? "✓" : ""}
                  </span>
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  Fast 3-round quiz: Multiple Choice, Matching, and Typing.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPrimaryMode("hard");
                  setOverrideKeys(new Set());
                }}
                className={`flex flex-col items-start gap-1.5 p-4 rounded-2xl border text-start transition-all cursor-pointer ${
                  primaryMode === "hard"
                    ? "border-subtitle bg-subtitle/10 ring-2 ring-subtitle shadow-xs"
                    : "border-line bg-surface hover:border-subtitle/40"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-bold text-ink text-sm">Hard (Deep Learning)</span>
                  <span
                    className={`w-4 h-4 rounded-full border flex items-center justify-center text-[length:var(--text-label)] font-bold ${
                      primaryMode === "hard" ? "bg-subtitle text-subtitle-ink border-subtitle" : "border-line"
                    }`}
                  >
                    {primaryMode === "hard" ? "✓" : ""}
                  </span>
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  Full 4-stage flow: Understanding, Video Context, Your Sentence, and Schedule.
                </p>
              </button>
            </div>

            {/* Per-word Cross-Mode Override Selector */}
            <div className="pt-4 flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-muted">
                {primaryMode === "easy"
                  ? "Select any words you want to practice in Hard mode instead:"
                  : "Select any words you want to practice in Easy mode instead:"}
              </div>
              {overrideKeys.size > 0 ? (
                <button
                  type="button"
                  onClick={() => setOverrideKeys(new Set())}
                  className="text-xs font-semibold text-amber-700 dark:text-subtitle hover:underline cursor-pointer shrink-0"
                >
                  Reset ({overrideKeys.size})
                </button>
              ) : null}
            </div>

            <div className="mt-2 overflow-y-auto flex-1 divide-y divide-line/40 rounded-2xl border border-line bg-surface/60 px-3">
              {configuringDeck.words.map((w, idx) => {
                const key = getDeckWordKey(w, idx);
                const isOverridden = overrideKeys.has(key);
                const effectiveMode = isOverridden
                  ? primaryMode === "easy"
                    ? "hard"
                    : "easy"
                  : primaryMode;

                return (
                  <label
                    key={key}
                    className="flex items-center justify-between gap-3 py-2.5 cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={isOverridden}
                        onChange={() => toggleWordOverride(key)}
                        className="h-4 w-4 rounded border-line accent-[#facc3b] cursor-pointer shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="font-bold text-ink text-sm truncate">{w.text}</div>
                        {w.translation ? (
                          <div className="text-xs text-muted truncate" dir="rtl">
                            {w.translation}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[length:var(--text-label)] font-bold uppercase tracking-wider shrink-0 ${
                        effectiveMode === "hard"
                          ? "bg-subtitle/20 text-amber-900 dark:text-subtitle border border-subtitle/40"
                          : "bg-black/5 dark:bg-white/10 text-muted border border-line"
                      }`}
                    >
                      {effectiveMode}
                    </span>
                  </label>
                );
              })}
            </div>

            {/* Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 mt-4">
              <div className="text-xs text-muted">
                {(() => {
                  const total = configuringDeck.words.length;
                  const oppCount = overrideKeys.size;
                  const primCount = total - oppCount;
                  if (oppCount === 0) {
                    return `All ${total} ${total === 1 ? "word" : "words"} in ${primaryMode === "easy" ? "Easy" : "Hard"} mode`;
                  }
                  return primaryMode === "easy"
                    ? `${primCount} Easy · ${oppCount} Hard`
                    : `${primCount} Hard · ${oppCount} Easy`;
                })()}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfiguringDeck(null)}
                  className="btn btn-quiet min-h-11 px-4 text-[length:var(--text-control)] font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={startConfiguredPractice}
                  className="btn btn-primary min-h-11 px-5 text-[length:var(--text-control)] font-bold cursor-pointer inline-flex items-center gap-2"
                >
                  <PlayIcon size={12} />
                  <span>Start Practice</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Queued Easy / Hard Practice Session Modal */}
      {practiceQueue.length > 0 ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPracticeQueue([]);
          }}
        >
          <div className="relative w-full max-w-4xl max-h-[94vh] overflow-y-auto rounded-3xl border border-line bg-bg shadow-2xl">
            {practiceQueue.length > 1 ? (
              <div className="px-5 pt-4 pb-1 flex items-center justify-between gap-2 text-xs font-semibold text-amber-800 dark:text-subtitle">
                <span>
                  Step 1 of {practiceQueue.length}:{" "}
                  {practiceQueue[0].mode === "easy" ? "Easy (Quick Review)" : "Hard (Deep Learning)"} ·{" "}
                  {practiceQueue[0].words.length} {practiceQueue[0].words.length === 1 ? "word" : "words"}
                </span>
                <span className="text-muted">
                  Next: {practiceQueue[1].mode === "easy" ? "Easy" : "Hard"} ({practiceQueue[1].words.length})
                </span>
              </div>
            ) : null}
            {practiceQueue[0].mode === "easy" ? (
              <ReviewSession
                key={`easy-${practiceQueue.length}-${practiceQueue[0].words.map((w) => w.id).join(",")}`}
                words={practiceQueue[0].words}
                allDeckWords={practiceQueue[0].allDeckWords}
                sessionSize={practiceQueue[0].words.length}
                ignoreEligibility={true}
                includeDictation={true}
                promptMode="translation"
                onClose={() => setPracticeQueue([])}
                onPracticeHard={(hardWords) => {
                  setPracticeQueue((prev) => [
                    {
                      mode: "hard",
                      words: hardWords,
                      allDeckWords: prev[0]?.allDeckWords,
                    },
                    ...prev.slice(1),
                  ]);
                }}
                onReload={advancePracticeQueue}
              />
            ) : (
              <InteractiveLearningSession
                key={`hard-${practiceQueue.length}-${practiceQueue[0].words.length}`}
                words={practiceQueue[0].words}
                onReload={advancePracticeQueue}
              />
            )}
          </div>
        </div>
      ) : null}

      {/* Quick Interactive Practice Modal (Single-Word Direct) */}
      {practicingDeck ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPracticingDeck(null);
          }}
        >
          <div className="relative w-full max-w-4xl max-h-[94vh] overflow-y-auto rounded-3xl border border-line bg-bg shadow-2xl">
            <InteractiveLearningSession
              words={wordsForPractice}
              onReload={() => {
                setPracticingDeck(null);
                fetchWords().then(setUserWords).catch(() => {});
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

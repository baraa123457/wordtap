"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { addCustomWord, deleteWord, fetchWords, updateWordLanguage } from "@/lib/api";
import { formatDueIn, wordStatus, type WordStatus } from "@/lib/format";
import type { Word } from "@/lib/schemas";
import { canSpeak, speak } from "@/lib/speech";
import { useLoad } from "@/hooks/useLoad";
import { EmptyState, ErrorState, LoadingState } from "@/components/StateViews";
import { MasteryDots } from "@/components/MasteryDots";
import { SpeakerIcon } from "@/components/Icons";

type Filter = "all" | WordStatus;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "due", label: "Ready to review" },
  { id: "learning", label: "Learning" },
  { id: "mastered", label: "Mastered" },
];

const LANG_LABELS: Record<string, string> = {
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

export default function WordsPage() {
  const { state, reload, setData } = useLoad(fetchWords);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [langFilter, setLangFilter] = useState<string>("all");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newText, setNewText] = useState("");
  const [newTranslation, setNewTranslation] = useState("");
  const [newLang, setNewLang] = useState("de");
  const [addBusy, setAddBusy] = useState(false);

  const words = state.status === "ready" ? state.data : null;

  const languageTabs = useMemo(() => {
    if (!words) return [];
    const counts = new Map<string, number>();
    for (const w of words) {
      const code = (w.src_lang || "auto").toLowerCase();
      counts.set(code, (counts.get(code) || 0) + 1);
    }
    return Array.from(counts.entries()).map(([code, count]) => ({
      id: code,
      label: LANG_LABELS[code] || code.toUpperCase(),
      count,
    }));
  }, [words]);

  const visible = useMemo(() => {
    if (!words) return [];
    const q = query.trim().toLowerCase();
    const now = new Date();
    return words.filter((w) => {
      if (langFilter !== "all" && (w.src_lang || "auto").toLowerCase() !== langFilter) return false;
      if (filter !== "all" && wordStatus(w.box, w.next_review, now) !== filter) return false;
      return q === "" || w.text.toLowerCase().includes(q) || w.translation.toLowerCase().includes(q);
    });
  }, [words, query, filter, langFilter]);

  if (state.status === "loading") return <LoadingState label="Loading your words…" />;
  if (state.status === "error") return <ErrorState message={state.message} onRetry={reload} />;

  const all = state.data;

  if (all.length === 0) {
    return (
      <EmptyState
        title="No words yet"
        action={
          <Link href="/extension" className="btn btn-primary">
            Set up the extension
          </Link>
        }
      >
        Words you tap in subtitles appear here automatically.
      </EmptyState>
    );
  }

  async function remove(word: Word) {
    setBusyId(word.id);
    setActionError(null);
    try {
      await deleteWord(word.id);
      setData(all.filter((w) => w.id !== word.id));
      setConfirmId(null);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not delete the word.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleLanguageChange(word: Word, newLang: string) {
    if (!words) return;
    setBusyId(word.id);
    setActionError(null);
    const prevWords = all;
    setData(all.map((item) => (item.id === word.id ? { ...item, src_lang: newLang } : item)));
    try {
      await updateWordLanguage(word.id, newLang, word);
      await reload();
    } catch (e) {
      setData(prevWords);
      setActionError(e instanceof Error ? e.message : "Could not update word language.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleAddWord(e: React.FormEvent) {
    e.preventDefault();
    if (!newText.trim() || !newTranslation.trim()) return;
    setAddBusy(true);
    setActionError(null);
    try {
      await addCustomWord(newText.trim(), newTranslation.trim(), newLang);
      setNewText("");
      setNewTranslation("");
      setShowAddForm(false);
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not add word.");
    } finally {
      setAddBusy(false);
    }
  }

  const now = new Date();

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">
          My words ({visible.length}
          {langFilter !== "all" ? ` · ${LANG_LABELS[langFilter] || langFilter}` : ""})
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="btn"
          >
            {showAddForm ? "Cancel" : "+ Add word"}
          </button>
          <Link
            href={langFilter !== "all" ? `/practice?lang=${langFilter}` : "/practice"}
            className="btn btn-primary"
          >
            {langFilter !== "all" ? `Practice ${LANG_LABELS[langFilter] || langFilter}` : "Start practice"}
          </Link>
        </div>
      </div>

      {showAddForm ? (
        <form onSubmit={handleAddWord} className="grid gap-3 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-[1fr_1fr_auto_auto]">
          <input
            className="field"
            type="text"
            placeholder="Word (e.g. was)"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            required
          />
          <input
            className="field"
            type="text"
            placeholder="Translation (e.g. كان or ماذا)"
            value={newTranslation}
            onChange={(e) => setNewTranslation(e.target.value)}
            required
          />
          <select
            className="field"
            value={newLang}
            onChange={(e) => setNewLang(e.target.value)}
          >
            <option value="de">German (DE)</option>
            <option value="en">English (EN)</option>
            <option value="fr">French (FR)</option>
            <option value="es">Spanish (ES)</option>
            <option value="it">Italian (IT)</option>
            <option value="tr">Turkish (TR)</option>
            <option value="ru">Russian (RU)</option>
            <option value="ar">Arabic (AR)</option>
          </select>
          <button type="submit" className="btn btn-primary" disabled={addBusy}>
            {addBusy ? "Adding…" : "Save word"}
          </button>
        </form>
      ) : null}

      {languageTabs.length > 1 ? (
        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-line bg-surface p-2">
          <span className="px-2 text-xs font-bold uppercase tracking-wider text-muted">Language:</span>
          <button
            type="button"
            aria-pressed={langFilter === "all"}
            onClick={() => setLangFilter("all")}
            className={`rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors ${
              langFilter === "all" ? "bg-subtitle text-subtitle-ink" : "text-muted hover:text-ink"
            }`}
          >
            All ({words?.length || 0})
          </button>
          {languageTabs.map((l) => (
            <button
              key={l.id}
              type="button"
              aria-pressed={langFilter === l.id}
              onClick={() => setLangFilter(l.id)}
              className={`rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors ${
                langFilter === l.id ? "bg-subtitle text-subtitle-ink" : "text-muted hover:text-ink"
              }`}
            >
              {l.label} ({l.count})
            </button>
          ))}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
        <input
          className="field"
          type="search"
          placeholder="Search words or translations"
          aria-label="Search words"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div role="group" aria-label="Filter" className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-xl px-3 py-2 text-sm font-medium ${
                filter === f.id ? "bg-subtitle text-subtitle-ink" : "text-muted hover:text-ink"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {actionError ? (
        <p role="alert" className="rounded-xl bg-bad-soft px-4 py-3 text-bad">
          {actionError}
        </p>
      ) : null}

      {visible.length === 0 ? (
        <EmptyState title="No matches">Try a different search or filter.</EmptyState>
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {visible.map((w) => {
            const status = wordStatus(w.box, w.next_review, now);
            return (
              <li
                key={w.id}
                className="grid gap-2 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_14rem] sm:items-center sm:gap-6"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <div className="relative shrink-0">
                    <select
                      value={(w.src_lang || "auto").toLowerCase()}
                      title="Click to change language"
                      aria-label={`Language for ${w.text}`}
                      onChange={(e) => void handleLanguageChange(w, e.target.value)}
                      disabled={busyId === w.id}
                      className="cursor-pointer appearance-none rounded-md border border-line bg-surface px-2 py-0.5 pr-4 text-xs font-bold uppercase tracking-wider text-muted transition-colors hover:border-muted hover:text-ink focus:outline-none focus:ring-1 focus:ring-focus disabled:opacity-50"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 24 24' fill='none' stroke='%235a6082' stroke-width='3'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                        backgroundRepeat: "no-repeat",
                        backgroundPosition: "right 3px center",
                      }}
                    >
                      <option value="de">DE</option>
                      <option value="en">EN</option>
                      <option value="fr">FR</option>
                      <option value="es">ES</option>
                      <option value="it">IT</option>
                      <option value="pt">PT</option>
                      <option value="tr">TR</option>
                      <option value="ru">RU</option>
                      <option value="ar">AR</option>
                      <option value="ja">JA</option>
                      <option value="ko">KO</option>
                      <option value="zh">ZH</option>
                      <option value="auto">AUTO</option>
                    </select>
                  </div>
                  <bdi className="min-w-0 break-words text-lg font-semibold">{w.text}</bdi>
                  {canSpeak() && w.src_lang !== "auto" ? (
                    <button
                      type="button"
                      className="btn btn-quiet min-h-8 shrink-0 px-2 py-0.5"
                      aria-label={`Hear “${w.text}”`}
                      onClick={() => speak(w.text, w.src_lang)}
                    >
                      <SpeakerIcon />
                    </button>
                  ) : null}
                </div>
                <div className="min-w-0">
                  <p className="break-words text-lg">
                    <bdi>{w.translation}</bdi>
                  </p>
                  <p className="mt-0.5 truncate text-sm text-muted">
                    {w.source_title ? `From ${w.source_title}` : "No source saved"}
                    {w.times_seen > 1 ? ` · tapped ${w.times_seen} times` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
                  <span className="grid justify-items-start gap-1 text-sm text-muted sm:justify-items-end">
                    <MasteryDots box={w.box} />
                    <span>
                      {status === "due"
                        ? "Ready to review"
                        : status === "mastered"
                          ? "Mastered"
                          : `Review ${formatDueIn(w.next_review, now)}`}
                    </span>
                  </span>
                  {confirmId === w.id ? (
                    <span className="flex items-center gap-1">
                      <button
                        type="button"
                        className="btn btn-bad min-h-9 px-3 py-1 text-sm"
                        disabled={busyId === w.id}
                        onClick={() => void remove(w)}
                      >
                        {busyId === w.id ? "Deleting…" : "Delete"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-quiet min-h-9 px-3 py-1 text-sm"
                        onClick={() => setConfirmId(null)}
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-quiet min-h-9 px-3 py-1 text-sm"
                      aria-label={`Delete “${w.text}”`}
                      onClick={() => setConfirmId(w.id)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

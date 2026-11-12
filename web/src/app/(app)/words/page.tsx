"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  addCustomWord,
  deleteWord,
  deleteWordByText,
  fetchWords,
  updateWordDetails,
  updateWordLanguage,
  updateWordTranslation,
} from "@/lib/api";
import { formatDueIn, wordStatus, type WordStatus } from "@/lib/format";
import type { Word } from "@/lib/schemas";
import { canSpeak, speak } from "@/lib/speech";
import { useLoad } from "@/hooks/useLoad";
import { EmptyState, ErrorState, LoadingState } from "@/components/StateViews";
import { MasteryDots } from "@/components/MasteryDots";
import { SpeakerIcon } from "@/components/Icons";
import { POS_BADGES } from "@/components/TranslatorCard";

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

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editTranslation, setEditTranslation] = useState("");

  const [showAddForm, setShowAddForm] = useState(false);
  const [newText, setNewText] = useState("");
  const [newTranslation, setNewTranslation] = useState("");
  const [newLang, setNewLang] = useState("en");
  const [detectedPos, setDetectedPos] = useState<string | null>(null);
  const [addBusy, setAddBusy] = useState(false);

  // Auto-detect translation and part-of-speech when typing in Add Word form
  useEffect(() => {
    if (!showAddForm || !newText.trim() || newText.trim().length < 2) {
      setDetectedPos(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/translate?text=${encodeURIComponent(newText.trim())}&src=${newLang}&target=ar`,
        );
        if (res.ok) {
          const data = await res.json();
          if (data.primaryPartOfSpeech) {
            setDetectedPos(data.primaryPartOfSpeech);
          }
          if (data.translation && !newTranslation) {
            setNewTranslation(data.translation);
          }
        }
      } catch {
        // ignore auto-detect error
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [newText, newLang, showAddForm, newTranslation]);

  const words = state.status === "ready" ? state.data : null;

  // Broadcast all saved words to active extension scripts & local cache
  useEffect(() => {
    if (words && Array.isArray(words)) {
      const payload = words.map((w) => ({
        text: w.text,
        translation: w.translation,
        src: w.src_lang,
        target: w.target_lang,
      }));
      try {
        localStorage.setItem("wordtap_cached_words", JSON.stringify(payload));
      } catch (_) {}
      if (typeof window !== "undefined") {
        window.postMessage({ type: "wordtap:words-synced", words: payload }, "*");
        window.dispatchEvent(new CustomEvent("wordtap_words_synced", { detail: { words: payload } }));
      }
    }
  }, [words]);

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
      await deleteWordByText(word.text, word.src_lang).catch(() => {});
      setData(all.filter((w) => w.id !== word.id));
      setConfirmId(null);

      // Record tombstone in localStorage so the extension immediately purges it
      try {
        const raw = localStorage.getItem("wordtap_deleted_words");
        const list = raw ? JSON.parse(raw) : [];
        if (Array.isArray(list)) {
          list.push({ text: word.text, srcLang: word.src_lang });
          if (list.length > 200) list.shift();
          localStorage.setItem("wordtap_deleted_words", JSON.stringify(list));
        }
      } catch (_) {}

      // Broadcast to any active extension scripts
      if (typeof window !== "undefined") {
        window.postMessage(
          {
            type: "wordtap:word-deleted",
            text: word.text,
            srcLang: word.src_lang,
          },
          "*",
        );
        window.dispatchEvent(
          new CustomEvent("wordtap_word_deleted", {
            detail: { text: word.text, srcLang: word.src_lang },
          }),
        );
      }
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

  async function handleSaveWordDetails(word: Word) {
    const cleanT = editText.trim();
    const cleanTr = editTranslation.trim();
    if (!cleanT || !cleanTr) return;

    if (cleanT === word.text && cleanTr === word.translation) {
      setEditingId(null);
      return;
    }
    setBusyId(word.id);
    setActionError(null);
    const prevWords = all;
    setData(
      all.map((item) =>
        item.id === word.id ? { ...item, text: cleanT, translation: cleanTr } : item
      )
    );
    try {
      await updateWordDetails(word.id, { text: cleanT, translation: cleanTr }, word);
      setEditingId(null);
    } catch (e) {
      setData(prevWords);
      setActionError(e instanceof Error ? e.message : "Could not update word.");
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
        <form onSubmit={handleAddWord} className="grid gap-3 rounded-2xl border border-line bg-surface p-4 shadow-sm animate-in fade-in">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto]">
            <input
              className="field"
              type="text"
              placeholder="Word (e.g. breadth or inherit)"
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              required
            />
            <input
              className="field"
              type="text"
              placeholder="Translation (e.g. اتساع or يرث)"
              value={newTranslation}
              onChange={(e) => setNewTranslation(e.target.value)}
              required
            />
            <select
              className="field"
              value={newLang}
              onChange={(e) => setNewLang(e.target.value)}
            >
              <option value="en">English (EN)</option>
              <option value="de">German (DE)</option>
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
          </div>
          {detectedPos ? (
            <div className="flex items-center gap-2 text-xs text-muted pt-1 border-t border-line/40">
              <span className="font-medium">Detected Word Type / نوع الكلمة:</span>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                  POS_BADGES[detectedPos.toLowerCase()]?.badge ||
                  "bg-subtitle/15 text-subtitle-edge dark:text-subtitle border-subtitle/30"
                }`}
              >
                <span>{POS_BADGES[detectedPos.toLowerCase()]?.en || detectedPos}</span>
                <span className="opacity-75 font-normal text-[10px]">
                  · {POS_BADGES[detectedPos.toLowerCase()]?.ar || detectedPos}
                </span>
              </span>
            </div>
          ) : null}
        </form>
      ) : null}

      {languageTabs.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted">Language:</span>
          <div className="apple-segmented-container">
            <button
              type="button"
              aria-pressed={langFilter === "all"}
              onClick={() => setLangFilter("all")}
              data-active={langFilter === "all" ? "true" : undefined}
              className="apple-segmented-item"
            >
              All ({words?.length || 0})
            </button>
            {languageTabs.map((l) => (
              <button
                key={l.id}
                type="button"
                aria-pressed={langFilter === l.id}
                onClick={() => setLangFilter(l.id)}
                data-active={langFilter === l.id ? "true" : undefined}
                className="apple-segmented-item"
              >
                {l.label} ({l.count})
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="relative">
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            className="field pl-10"
            type="search"
            placeholder="Search words or translations..."
            aria-label="Search words"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div role="group" aria-label="Filter" className="overflow-x-auto py-1">
          <div className="apple-segmented-container">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
                data-active={filter === f.id ? "true" : undefined}
                className="apple-segmented-item whitespace-nowrap"
              >
                {f.label}
              </button>
            ))}
          </div>
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
        <ul className="apple-card divide-y divide-line/50 overflow-hidden">
          {visible.map((w) => {
            const status = wordStatus(w.box, w.next_review, now);
            return (
              <li
                key={w.id}
                className="grid gap-2 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_14rem] sm:items-center sm:gap-6 hover:bg-black/[0.015] dark:hover:bg-white/[0.015] transition-colors"
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
                        className="btn btn-bad min-h-9 px-3 py-1 text-sm font-semibold cursor-pointer"
                        disabled={busyId === w.id}
                        onClick={() => void remove(w)}
                      >
                        {busyId === w.id ? "Deleting…" : "Delete"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-quiet min-h-9 px-3 py-1 text-sm cursor-pointer"
                        onClick={() => setConfirmId(null)}
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        className={`btn min-h-8 px-2.5 py-1 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                          editingId === w.id
                            ? "bg-subtitle text-black font-semibold shadow-xs"
                            : "btn-quiet text-muted hover:text-ink hover:bg-black/5 dark:hover:bg-white/10"
                        }`}
                        title={`Edit “${w.text}”`}
                        aria-label={`Edit “${w.text}”`}
                        onClick={() => {
                          if (editingId === w.id) {
                            setEditingId(null);
                          } else {
                            setEditingId(w.id);
                            setEditText(w.text);
                            setEditTranslation(w.translation);
                          }
                        }}
                      >
                        <svg className="w-3.5 h-3.5 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-quiet min-h-8 px-2.5 py-1 text-xs font-medium text-muted hover:text-bad hover:bg-bad/10 rounded-lg cursor-pointer"
                        aria-label={`Delete “${w.text}”`}
                        onClick={() => setConfirmId(w.id)}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>

                {/* Inline Edit Panel when user clicks Edit */}
                {editingId === w.id ? (
                  <div className="col-span-full mt-2 p-3.5 rounded-2xl bg-surface-elevated/90 border border-subtitle/40 shadow-md space-y-3 animate-in fade-in">
                    <div className="flex items-center justify-between text-xs font-bold text-subtitle border-b border-line/30 pb-2">
                      <div className="flex items-center gap-1.5">
                        <span>✏️ Edit Word & Translation</span>
                        <span className="text-muted font-normal">(تعديل الكلمة والترجمة أو الملاحظات)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="text-muted hover:text-ink p-1 cursor-pointer"
                        title="Close"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-muted mb-1">
                          Word (الكلمة الأصلية):
                        </label>
                        <input
                          type="text"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="field py-1.5 px-3 text-sm w-full font-medium"
                          placeholder="e.g. Humble"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void handleSaveWordDetails(w);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-muted mb-1">
                          Translation & Notes (الترجمة والملاحظات):
                        </label>
                        <input
                          type="text"
                          dir="auto"
                          value={editTranslation}
                          onChange={(e) => setEditTranslation(e.target.value)}
                          className="field py-1.5 px-3 text-sm w-full font-medium"
                          placeholder="e.g. متواضع (ملاحظة...)"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void handleSaveWordDetails(w);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        className="btn btn-quiet min-h-8 px-3 py-1 text-xs cursor-pointer"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary min-h-8 px-4 py-1 text-xs font-bold cursor-pointer"
                        disabled={busyId === w.id || !editText.trim() || !editTranslation.trim()}
                        onClick={() => void handleSaveWordDetails(w)}
                      >
                        {busyId === w.id ? "Saving…" : "Save Changes"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

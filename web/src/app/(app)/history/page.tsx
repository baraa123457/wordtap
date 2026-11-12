"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  clearHistory,
  getHistory,
  markHistoryItemSaved,
  removeHistoryItem,
  type HistoryItem,
  type HistorySource,
} from "@/lib/history";
import { addCustomWord, fetchWords } from "@/lib/api";
import { canSpeak, speak } from "@/lib/speech";
import { SpeakerIcon } from "@/components/Icons";

const SOURCE_LABELS: Record<HistorySource, { label: string }> = {
  translator: { label: "Translator" },
  subtitle: { label: "Subtitles" },
  selection: { label: "Selected text" },
};

function formatRelativeTime(dateStr: string): string {
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return "Just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | HistorySource>("all");
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});
  const [savedSuccessIds, setSavedSuccessIds] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [savedWordKeys, setSavedWordKeys] = useState<Set<string>>(new Set());

  // Load history & sync with saved words
  useEffect(() => {
    function load() {
      setHistory(getHistory());
    }
    load();

    fetchWords()
      .then((words) => {
        const keys = new Set(
          words.map((w) => `${w.text.toLowerCase().trim()}|${(w.src_lang || "auto").toLowerCase()}`)
        );
        setSavedWordKeys(keys);
      })
      .catch(() => {});

    window.addEventListener("wordtap_history_updated", load);
    return () => window.removeEventListener("wordtap_history_updated", load);
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return history.filter((item) => {
      if (sourceFilter !== "all" && item.source !== sourceFilter) return false;
      if (!q) return true;
      return (
        item.text.toLowerCase().includes(q) ||
        item.translation.toLowerCase().includes(q)
      );
    });
  }, [history, query, sourceFilter]);

  async function handleSave(item: HistoryItem) {
    if (savingIds[item.id]) return;
    setSavingIds((prev) => ({ ...prev, [item.id]: true }));
    try {
      await addCustomWord(
        item.text,
        item.translation,
        item.src_lang || "auto",
        item.target_lang || "ar"
      );
      markHistoryItemSaved(item.text, item.src_lang, item.target_lang);
      setSavedWordKeys((prev) => {
        const next = new Set(prev);
        next.add(`${item.text.toLowerCase().trim()}|${(item.src_lang || "auto").toLowerCase()}`);
        return next;
      });
      setSavedSuccessIds((prev) => ({ ...prev, [item.id]: true }));
    } catch (err) {
      console.error("Failed to save from history:", err);
    } finally {
      setSavingIds((prev) => ({ ...prev, [item.id]: false }));
    }
  }

  function handleDelete(id: string) {
    const target = history.find((item) => item.id === id);
    removeHistoryItem(id);
    setHistory((prev) => prev.filter((item) => item.id !== id));
    if (typeof window !== "undefined") {
      window.postMessage(
        {
          type: "wordtap:history-deleted",
          id,
          text: target?.text,
          srcLang: target?.src_lang,
          targetLang: target?.target_lang,
        },
        "*",
      );
    }
  }

  function handleClearAll() {
    clearHistory();
    setHistory([]);
    setConfirmClear(false);
    if (typeof window !== "undefined") {
      window.postMessage({ type: "wordtap:history-cleared" }, "*");
    }
  }

  async function handleCopy(item: HistoryItem) {
    try {
      await navigator.clipboard.writeText(`${item.text} - ${item.translation}`);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {}
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-line/60">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
            <span>Translation History</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-muted">
              {history.length}
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-muted mt-0.5">
            All words you translated or tapped in subtitles. Save any word to your practice list with one click.
          </p>
        </div>

        {history.length > 0 ? (
          <div>
            {confirmClear ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted">Clear all?</span>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="btn btn-bad min-h-8 px-3 py-1 text-xs font-semibold rounded-lg"
                >
                  Yes, clear
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="btn btn-quiet min-h-8 px-3 py-1 text-xs font-medium rounded-lg"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="btn btn-quiet min-h-8 px-3 py-1 text-xs font-medium text-muted hover:text-bad rounded-lg"
              >
                Clear history
              </button>
            )}
          </div>
        ) : null}
      </div>

      {/* Search & Source Filter Tabs */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
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
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search translated words or definitions..."
            className="field pl-10"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-3 top-2.5 text-muted hover:text-ink text-sm p-1"
            >
              ✕
            </button>
          ) : null}
        </div>

        <div className="overflow-x-auto py-1">
          <div className="apple-segmented-container">
            {(["all", "translator", "subtitle", "selection"] as const).map((src) => {
              const active = sourceFilter === src;
              const count =
                src === "all"
                  ? history.length
                  : history.filter((h) => h.source === src).length;
              const label =
                src === "all"
                  ? "All"
                  : SOURCE_LABELS[src]?.label || src;
              return (
                <button
                  key={src}
                  type="button"
                  onClick={() => setSourceFilter(src)}
                  data-active={active ? "true" : undefined}
                  className="apple-segmented-item whitespace-nowrap"
                >
                  <span>{label}</span>
                  <span className="ms-1 text-[11px] opacity-70">({count})</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* History Items List */}
      {visible.length === 0 ? (
        <div className="apple-card p-12 text-center space-y-3">
          <h2 className="text-base font-semibold text-ink">
            {query ? "No matching words found" : "Your translation history is empty"}
          </h2>
          <p className="text-xs sm:text-sm text-muted max-w-md mx-auto">
            {query
              ? `No words matched "${query}". Try searching for something else.`
              : "Translate words in the dashboard or click subtitle words while watching to build your history."}
          </p>
          {!query ? (
            <div className="pt-2">
              <Link
                href="/dashboard"
                className="btn btn-primary min-h-9 px-4 py-1.5 text-xs font-semibold"
              >
                Go to Translator
              </Link>
            </div>
          ) : null}
        </div>
      ) : (
        <ul className="apple-card divide-y divide-line/50 overflow-hidden">
          {visible.map((item) => {
            const isSaved =
              item.saved ||
              savedSuccessIds[item.id] ||
              savedWordKeys.has(
                `${item.text.toLowerCase().trim()}|${(item.src_lang || "auto").toLowerCase()}`
              );
            const isSaving = Boolean(savingIds[item.id]);
            const isCopied = copiedId === item.id;
            const sourceInfo = SOURCE_LABELS[item.source] || {
              label: item.source,
            };

            return (
              <li
                key={item.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-black/[0.015] dark:hover:bg-white/[0.015] transition-colors"
              >
                {/* Word & Translation Info */}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base sm:text-lg font-bold text-ink tracking-tight">
                      {item.text}
                    </span>

                    {/* Listen Speaker Button */}
                    {canSpeak() ? (
                      <button
                        type="button"
                        onClick={() => speak(item.text, item.src_lang)}
                        title="Listen pronunciation"
                        className="p-1 rounded-md text-muted hover:text-ink hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                      >
                        <SpeakerIcon size={16} />
                      </button>
                    ) : null}

                    {/* Language Badge */}
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-black/5 dark:bg-white/10 text-muted uppercase">
                      {item.src_lang} → {item.target_lang}
                    </span>

                    {/* Source Badge */}
                    <span
                      title={`Captured via ${sourceInfo.label}`}
                      className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-black/5 dark:bg-white/10 text-muted"
                    >
                      {sourceInfo.label}
                    </span>

                    {/* Timestamp */}
                    <span className="text-xs text-muted/60 ms-auto sm:ms-0">
                      {formatRelativeTime(item.timestamp)}
                    </span>
                  </div>

                  {/* Translation Text */}
                  <div
                    dir="auto"
                    className="text-sm sm:text-base font-medium text-ink"
                  >
                    {item.translation}
                  </div>
                </div>

                {/* Actions Toolbar */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {/* Copy Button */}
                  <button
                    type="button"
                    onClick={() => handleCopy(item)}
                    title={isCopied ? "Copied!" : "Copy translation"}
                    className="p-2 rounded-lg border border-line bg-surface hover:bg-black/5 dark:hover:bg-white/10 text-muted hover:text-ink transition-all text-xs"
                  >
                    {isCopied ? (
                      <span className="font-bold text-subtitle">✓</span>
                    ) : (
                      <svg
                        className="w-4 h-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                      </svg>
                    )}
                  </button>

                  {/* Save to My Words Button / Icon */}
                  {isSaved ? (
                    <div
                      title="Already saved to your practice list"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span>Saved</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSave(item)}
                      disabled={isSaving}
                      title="Save this word to your vocabulary practice list"
                      className="btn btn-primary min-h-8 px-3 py-1 text-xs rounded-xl"
                    >
                      {isSaving ? (
                        <>
                          <span className="h-3 w-3 rounded-full border-2 border-black border-t-transparent animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                          </svg>
                          <span>Save word</span>
                        </>
                      )}
                    </button>
                  )}

                  {/* Delete Item Button */}
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    title="Remove from history"
                    className="p-2 rounded-lg text-muted hover:text-bad hover:bg-bad/10 transition-colors"
                  >
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

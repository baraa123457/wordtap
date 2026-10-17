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

const SOURCE_LABELS: Record<HistorySource, { label: string; icon: string }> = {
  translator: { label: "Translator", icon: "??" },
  subtitle: { label: "Subtitles", icon: "??" },
  selection: { label: "Selected text", icon: "???" },
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

    // Check existing words from DB to mark items as saved if they are in words list
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
        item.target_lang,
        item.src_lang
      );
      markHistoryItemSaved(item.text, item.src_lang, item.target_lang);
      setSavedWordKeys((prev) => {
        const next = new Set(prev);
        next.add(`${item.text.toLowerCase().trim()}|${(item.src_lang || "auto").toLowerCase()}`);
        return next;
      });
      setSavedSuccessIds((prev) => ({ ...prev, [item.id]: true }));
      setTimeout(() => {
        setSavedSuccessIds((prev) => {
          const next = { ...prev };
          delete next[item.id];
          return next;
        });
      }, 3000);
    } catch (err) {
      console.error("Failed to save from history:", err);
    } finally {
      setSavingIds((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
    }
  }

  function handleCopy(item: HistoryItem) {
    try {
      navigator.clipboard.writeText(item.translation);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch (_) {}
  }

  function handleClearAll() {
    clearHistory();
    setHistory([]);
    setConfirmClear(false);
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Translation History</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-subtitle/20 text-subtitle border border-subtitle/30">
              {history.length}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">
            All words translated, clicked in subtitles, or selected. Save any word to your practice list with one click.
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
                  className="px-3 py-1.5 text-xs font-bold rounded-xl bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-500/30 transition-all"
                >
                  Yes, clear
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-surface border border-line text-muted hover:text-ink transition-all"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-surface border border-line hover:border-red-500/50 hover:text-red-400 text-muted transition-all flex items-center gap-1.5"
              >
                <span>???</span>
                <span>Clear history</span>
              </button>
            )}
          </div>
        ) : null}
      </div>

      {/* Search & Source Filter Tabs */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search translated words or definitions..."
            className="w-full h-10 px-4 rounded-xl bg-surface border border-line text-sm text-ink placeholder:text-muted/60 focus:outline-none focus:border-subtitle"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-3 top-2.5 text-muted hover:text-ink text-sm"
            >
              ?
            </button>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(["all", "translator", "subtitle", "selection"] as const).map((src) => {
            const active = sourceFilter === src;
            const count =
              src === "all"
                ? history.length
                : history.filter((h) => h.source === src).length;
            const label =
              src === "all"
                ? "All"
                : `${SOURCE_LABELS[src]?.icon} ${SOURCE_LABELS[src]?.label}`;
            return (
              <button
                key={src}
                type="button"
                onClick={() => setSourceFilter(src)}
                className={`h-10 px-3.5 text-xs sm:text-sm font-semibold rounded-xl whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  active
                    ? "bg-subtitle text-black font-bold shadow-sm"
                    : "bg-surface border border-line text-muted hover:text-ink hover:border-subtitle/40"
                }`}
              >
                <span>{label}</span>
                <span className={`text-xs opacity-70`}>({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* History Items List */}
      {visible.length === 0 ? (
        <div className="rounded-3xl border border-line bg-surface p-12 text-center space-y-4">
          <div className="text-4xl">??</div>
          <h2 className="text-lg font-bold text-ink">
            {query ? "No matching words found" : "Your translation history is empty"}
          </h2>
          <p className="text-sm text-muted max-w-md mx-auto">
            {query
              ? `No words matched "${query}". Try searching for something else.`
              : "Translate words in the dashboard or click subtitle words while watching to build your history."}
          </p>
          {!query ? (
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-subtitle text-black font-bold text-sm hover:bg-[#e6b825] transition-all shadow-sm"
            >
              <span>Go to Translator</span>
              <span>?</span>
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-3 sm:gap-4">
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
              icon: "??",
            };

            return (
              <div
                key={item.id}
                className="group relative rounded-2xl border border-line bg-surface p-4 sm:p-5 hover:border-subtitle/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm"
              >
                {/* Word & Translation Info */}
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg sm:text-xl font-bold text-ink tracking-tight">
                      {item.text}
                    </span>

                    {/* Listen Speaker Button */}
                    {canSpeak() ? (
                      <button
                        type="button"
                        onClick={() => speak(item.text, item.src_lang)}
                        title="Listen pronunciation"
                        className="p-1 rounded-lg text-muted hover:text-subtitle hover:bg-white/10 transition-colors"
                      >
                        <SpeakerIcon size={16} />
                      </button>
                    ) : null}

                    {/* Language Badge */}
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-line/60 text-muted uppercase">
                      {item.src_lang} ? {item.target_lang}
                    </span>

                    {/* Source Badge */}
                    <span
                      title={`Captured via ${sourceInfo.label}`}
                      className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-line/40 text-muted/80 flex items-center gap-1"
                    >
                      <span>{sourceInfo.icon}</span>
                      <span>{sourceInfo.label}</span>
                    </span>

                    {/* Timestamp */}
                    <span className="text-xs text-muted/60 ms-auto sm:ms-0">
                      {formatRelativeTime(item.timestamp)}
                    </span>
                  </div>

                  {/* Translation Text */}
                  <div
                    dir="auto"
                    className="text-base sm:text-lg font-semibold text-subtitle leading-snug"
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
                    className="p-2 rounded-xl border border-line bg-surface hover:border-subtitle/50 text-muted hover:text-ink transition-all text-xs"
                  >
                    {isCopied ? (
                      <span className="font-bold text-subtitle">?</span>
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
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-green-600/20 text-green-500 border border-green-500/30"
                    >
                      <span>? In My Words</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSave(item)}
                      disabled={isSaving}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-subtitle text-black hover:bg-[#e6b825] active:scale-95 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                      title="Save to My Words list for practice"
                    >
                      {isSaving ? (
                        <>
                          <span className="h-3 w-3 rounded-full border-2 border-black border-t-transparent animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <span>?</span>
                          <span>+ Save to My Words</span>
                        </>
                      )}
                    </button>
                  )}

                  {/* Delete from History */}
                  <button
                    type="button"
                    onClick={() => removeHistoryItem(item.id)}
                    title="Remove from history"
                    className="p-2 rounded-xl text-muted/60 hover:text-red-400 hover:bg-white/10 transition-colors"
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
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

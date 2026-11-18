"use client";

import { useEffect, useState } from "react";
import { addCustomWord } from "@/lib/api";
import { getStoredSettings } from "@/lib/settings";
import { canSpeak, speak } from "@/lib/speech";
import { CloseIcon, SpeakerIcon } from "@/components/Icons";

type LookupResult = {
  text: string;
  translation: string;
  detectedSrcLang?: string;
  sourcePronunciation?: string;
  primaryPartOfSpeech?: string | null;
  definitions?: Array<{ partOfSpeech?: string; terms?: string[] }>;
  sourceDefinitions?: Array<{
    partOfSpeech?: string;
    entries?: Array<{ gloss?: string; example?: string }>;
  }>;
};

/** Strips leading/trailing punctuation and possessive "'s" so lookup queries clean words. */
export function normalizeLookupWord(rawToken: string): string {
  return rawToken
    .replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "")
    .replace(/(?:['’]s)$/i, "")
    .trim();
}

export function WordLookupPopover({
  word,
  srcLang,
  targetLang,
  contextSentence,
  sourceTitle,
  sourceUrl,
  alreadySaved,
  onSaved,
  onClose,
}: {
  word: string;
  srcLang: string;
  targetLang?: string;
  contextSentence: string;
  sourceTitle?: string;
  sourceUrl?: string;
  alreadySaved: boolean;
  onSaved: (savedWord: string) => void;
  onClose: () => void;
}) {
  const effectiveTarget = targetLang || getStoredSettings().targetLang || "ar";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<LookupResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(alreadySaved);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setSaved(alreadySaved);
  }, [alreadySaved, word]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setData(null);
    setSaveError(null);

    const params = new URLSearchParams({
      text: word,
      src: srcLang || "en",
      target: effectiveTarget,
    });

    fetch(`/api/translate?${params.toString()}`)
      .then(async (res) => {
        const json = (await res.json()) as LookupResult & { error?: string };
        if (!res.ok) throw new Error(json.error || "Could not look up this word.");
        return json;
      })
      .then((res) => {
        if (active) setData(res);
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Could not load translation.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [word, srcLang, effectiveTarget]);

  const englishGloss =
    data?.sourceDefinitions
      ?.flatMap((d) => d.entries || [])
      .map((e) => e.gloss?.trim())
      .find((g) => Boolean(g)) || null;

  const altTranslations =
    data?.definitions
      ?.flatMap((d) => d.terms || [])
      .filter((t) => t && t.trim().toLowerCase() !== (data.translation || "").trim().toLowerCase())
      .slice(0, 3) || [];

  const handleSave = async () => {
    if (!data || saving || saved) return;
    setSaving(true);
    setSaveError(null);
    try {
      await addCustomWord(
        word,
        data.translation || word,
        data.detectedSrcLang || srcLang || "en",
        effectiveTarget,
        sourceTitle || "Stage 2 Video Context",
        sourceUrl || "",
        contextSentence,
      );
      setSaved(true);
      onSaved(word.toLowerCase());
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Sign in to save words to your vocabulary list.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-label={`Meaning of ${word}`}
      data-testid="wordtap-inline-popup"
      className="rounded-2xl border border-subtitle/50 bg-surface shadow-lg p-3.5 sm:p-4 grid gap-3 animate-in fade-in slide-in-from-top-1 duration-150"
    >
      {/* Popup Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-ink text-[10px] font-black text-subtitle shrink-0">
            W
          </span>
          <span className="text-base sm:text-lg font-extrabold text-ink break-words">{word}</span>
          {data?.primaryPartOfSpeech ? (
            <span className="rounded-full bg-black/5 dark:bg-white/10 px-2 py-0.5 text-[11px] font-semibold capitalize text-muted">
              {data.primaryPartOfSpeech}
            </span>
          ) : null}
          {data?.sourcePronunciation ? (
            <span className="text-xs font-mono text-muted">/{data.sourcePronunciation}/</span>
          ) : null}
          {canSpeak() ? (
            <button
              type="button"
              onClick={() => speak(word, srcLang || "en")}
              aria-label={`Pronounce ${word}`}
              title="Listen to pronunciation"
              className="btn btn-quiet min-h-7 h-7 w-7 p-0 inline-flex items-center justify-center rounded-full cursor-pointer"
            >
              <SpeakerIcon size={14} />
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close word popup"
          className="btn btn-quiet min-h-7 h-7 w-7 p-0 inline-flex items-center justify-center rounded-full text-muted hover:text-ink cursor-pointer shrink-0"
        >
          <CloseIcon />
        </button>
      </div>

      {/* Translation & Meaning Body */}
      {loading ? (
        <div className="flex items-center gap-2 py-1 text-xs text-muted">
          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-subtitle border-t-transparent" />
          <span>Looking up meaning…</span>
        </div>
      ) : error ? (
        <p className="text-xs text-bad font-medium">{error}</p>
      ) : data ? (
        <div className="grid gap-2">
          <p
            dir="auto"
            className="text-base sm:text-lg font-bold text-ink leading-snug"
          >
            {data.translation}
          </p>

          {altTranslations.length > 0 ? (
            <div dir="auto" className="flex flex-wrap gap-1.5">
              {altTranslations.map((alt) => (
                <span
                  key={alt}
                  className="rounded-lg bg-black/[0.04] dark:bg-white/[0.06] px-2 py-0.5 text-xs text-muted"
                >
                  {alt}
                </span>
              ))}
            </div>
          ) : null}

          {englishGloss ? (
            <p className="text-xs sm:text-sm text-muted leading-relaxed border-t border-line/60 pt-2">
              {englishGloss}
            </p>
          ) : null}

          {saveError ? (
            <p role="alert" className="text-xs text-bad font-medium">
              {saveError}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <span className="text-[11px] text-muted">
              Click any other word in the sentence to look it up
            </span>
            {saved ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-ok/15 border border-ok/30 px-3 py-1 text-xs font-bold text-ok">
                ✓ Saved to My Words
              </span>
            ) : (
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="btn btn-primary min-h-8 px-3.5 py-1 text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {saving ? "Saving…" : "+ Save word"}
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { addHistoryItem, markHistoryItemSaved } from "@/lib/history";
import { addCustomWord } from "@/lib/api";
import { getStoredSettings, type UserSettings } from "@/lib/settings";

// A fixed sample line for the landing page, so visitors can try the idea before signing up.
const DEMO_WORDS = [
  { word: "I", translation: "أنا" },
  { word: "never", translation: "أبدًا" },
  { word: "thought", translation: "ظننتُ" },
  { word: "you'd", translation: "أنك سوف" },
  { word: "come", translation: "تأتي" },
  { word: "back", translation: "تعود" },
] as const;

export function SubtitleDemo() {
  const [picked, setPicked] = useState<number | null>(null);
  const [settings, setSettings] = useState<UserSettings>(getStoredSettings);
  const [savedWords, setSavedWords] = useState<Set<string>>(new Set());
  const [savingWord, setSavingWord] = useState(false);

  useEffect(() => {
    setSettings(getStoredSettings());
  }, []);

  const current = picked === null ? null : DEMO_WORDS[picked];
  const isManual = (settings.translateSaveMode || "manual") === "manual";
  const isCurrentSaved = current ? savedWords.has(current.word.toLowerCase()) : false;

  function handleWordClick(index: number) {
    setPicked(index);
    const item = DEMO_WORDS[index];
    if (!item) return;

    const isAuto = (settings.translateSaveMode || "manual") === "auto";

    // Record into translation history
    addHistoryItem({
      text: item.word,
      translation: item.translation,
      src_lang: "en",
      target_lang: "ar",
      source: "subtitle",
      saved: isAuto || savedWords.has(item.word.toLowerCase()),
    });

    // If auto save mode, save immediately
    if (isAuto && !savedWords.has(item.word.toLowerCase())) {
      addCustomWord(item.word, item.translation, "ar", "en").catch(() => {});
      setSavedWords((prev) => new Set(prev).add(item.word.toLowerCase()));
      markHistoryItemSaved(item.word, "en", "ar");
    }
  }

  async function handleManualSave() {
    if (!current || savingWord || isCurrentSaved) return;
    setSavingWord(true);
    try {
      await addCustomWord(current.word, current.translation, "ar", "en");
      setSavedWords((prev) => new Set(prev).add(current.word.toLowerCase()));
      markHistoryItemSaved(current.word, "en", "ar");
    } catch (_) {
      // Even if network/signed-out, treat as saved locally in demo
      setSavedWords((prev) => new Set(prev).add(current.word.toLowerCase()));
      markHistoryItemSaved(current.word, "en", "ar");
    } finally {
      setSavingWord(false);
    }
  }

  return (
    <figure className="frame" aria-label="Interactive demo of tapping a subtitle word">
      <div className="frame-bar">
        <span>Demo: tap a word in the subtitle</span>
        <span className="text-xs opacity-75 font-mono">
          {isManual ? "Mode: Manual save ✍️" : "Mode: Auto-save ⚡"}
        </span>
      </div>
      <div className="frame-stage" style={{ minHeight: "13rem" }}>
        <p className="sub flex max-w-xl flex-wrap justify-center gap-x-[0.35em] text-3xl sm:text-4xl">
          {DEMO_WORDS.map((item, i) => (
            <button
              key={item.word}
              type="button"
              onClick={() => handleWordClick(i)}
              aria-pressed={picked === i}
              className="sub-word font-[inherit]"
            >
              {item.word}
            </button>
          ))}
        </p>
      </div>
      <div className="frame-bar flex-wrap gap-2 items-center justify-between" aria-live="polite" style={{ minHeight: "3rem" }}>
        {current ? (
          <>
            <span className="text-base text-white flex items-center gap-2">
              <span className="opacity-70">{current.word}</span>
              <span className="opacity-40">=</span>
              <span dir="rtl" className="font-semibold text-[var(--subtitle)]">
                {current.translation}
              </span>
            </span>

            {isManual ? (
              isCurrentSaved ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-green-400 bg-green-500/10 px-2.5 py-1 rounded-lg border border-green-500/20">
                  <span>✓ In your words</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleManualSave}
                  disabled={savingWord}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-[#facc3b] text-black hover:bg-[#e6b825] active:scale-95 transition-all shadow-sm cursor-pointer"
                  title="Save word to your WordTap vocabulary"
                >
                  {savingWord ? (
                    <span>Saving...</span>
                  ) : (
                    <>
                      <span>⭐</span>
                      <span>+ Save to My Words</span>
                    </>
                  )}
                </button>
              )
            ) : (
              <span className="text-xs font-medium text-green-400">⚡ Saved to your word list</span>
            )}
          </>
        ) : (
          <span>Tap any word to see it translated and saved.</span>
        )}
      </div>
    </figure>
  );
}

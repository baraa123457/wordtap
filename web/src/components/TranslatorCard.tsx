"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useCallback } from "react";
import { speak } from "@/lib/speech";
import { addCustomWord } from "@/lib/api";
import { getStoredSettings, type UserSettings } from "@/lib/settings";
import type { Word } from "@/lib/schemas";
import { SpeakerIcon, CloseIcon } from "@/components/Icons";

const POPULAR_LANGS = [
  { code: "en", name: "English", native: "English" },
  { code: "ar", name: "Arabic", native: "العربية" },
  { code: "es", name: "Spanish", native: "Español" },
  { code: "fr", name: "French", native: "Français" },
  { code: "de", name: "German", native: "Deutsch" },
  { code: "it", name: "Italian", native: "Italiano" },
  { code: "tr", name: "Turkish", native: "Türkçe" },
  { code: "ru", name: "Russian", native: "Русский" },
];

const ALL_LANGS = [
  ...POPULAR_LANGS,
  { code: "pt", name: "Portuguese", native: "Português" },
  { code: "ja", name: "Japanese", native: "日本語" },
  { code: "ko", name: "Korean", native: "한국어" },
  { code: "zh", name: "Chinese", native: "中文" },
  { code: "nl", name: "Dutch", native: "Nederlands" },
  { code: "pl", name: "Polish", native: "Polski" },
  { code: "sv", name: "Swedish", native: "Svenska" },
];

type Definition = {
  partOfSpeech: string;
  meanings: string[];
};

type TranslationResult = {
  text: string;
  translation: string;
  detectedSrcLang: string;
  sourcePronunciation?: string;
  targetPronunciation?: string;
  definitions?: Definition[];
};

function getInitialTopLangs(
  existingWords: Word[],
  role: "src" | "target",
  defaultPair: [string, string],
): string[] {
  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem(
        role === "src" ? "wordtap_top_src" : "wordtap_top_target",
      );
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.slice(0, 2);
        }
      }
    } catch {}
  }

  const counts = new Map<string, number>();
  for (const w of existingWords) {
    const l = (role === "src" ? w.src_lang : w.target_lang) || "";
    if (l && l !== "auto") {
      counts.set(l, (counts.get(l) || 0) + 1);
    }
  }

  const sorted = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([l]) => l);

  for (const d of defaultPair) {
    if (!sorted.includes(d)) sorted.push(d);
  }

  return sorted.slice(0, 2);
}

function LanguageDropdown({
  current,
  onSelect,
  align = "left",
}: {
  current: string;
  onSelect: (code: string) => void;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        title="More languages"
        aria-label="More languages"
        className={`h-8 px-2.5 rounded-xl flex items-center justify-center gap-1 text-xs font-semibold transition-all cursor-pointer select-none ${
          open
            ? "bg-subtitle/20 text-subtitle border border-subtitle/40"
            : "text-muted hover:text-ink hover:bg-line/40"
        }`}
      >
        <span className="text-xs">More</span>
        <svg
          className={`w-3.5 h-3.5 transition-transform duration-200 ${
            open ? "rotate-180 text-subtitle" : "opacity-70"
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute top-full mt-2 z-50 min-w-[210px] max-h-64 overflow-y-auto rounded-2xl border border-line bg-surface p-1.5 shadow-2xl backdrop-blur-md ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          <div className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-muted/70 border-b border-line/40 mb-1">
            All Languages
          </div>
          {ALL_LANGS.map((lang) => {
            const isSelected = current === lang.code;
            return (
              <button
                key={lang.code}
                type="button"
                role="menuitem"
                onClick={() => {
                  onSelect(lang.code);
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                  isSelected
                    ? "bg-subtitle text-black font-bold shadow-sm"
                    : "text-muted hover:text-ink hover:bg-white/10"
                }`}
              >
                <span>{lang.native}</span>
                <span className={`text-xs ${isSelected ? "text-black/70" : "text-muted/60"}`}>
                  {lang.name}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function TranslatorCard({
  existingWords = [],
  onWordSaved,
}: {
  existingWords?: Word[];
  onWordSaved?: (newWord?: Word) => void;
}) {
  const [settings] = useState<UserSettings>(() => getStoredSettings());
  const [srcLang, setSrcLang] = useState<string>("auto");
  const [targetLang, setTargetLang] = useState<string>("ar");
  const [topSrcLangs, setTopSrcLangs] = useState<string[]>(() =>
    getInitialTopLangs(existingWords, "src", ["en", "ar"]),
  );
  const [topTargetLangs, setTopTargetLangs] = useState<string[]>(() =>
    getInitialTopLangs(existingWords, "target", ["ar", "en"]),
  );

  function selectSrcLang(code: string) {
    setSrcLang(code);
    if (code !== "auto") {
      setTopSrcLangs((prev) => {
        const next = [code, ...prev.filter((c) => c !== code)].slice(0, 2);
        try {
          localStorage.setItem("wordtap_top_src", JSON.stringify(next));
        } catch {}
        return next;
      });
    }
  }

  function selectTargetLang(code: string) {
    setTargetLang(code);
    setTopTargetLangs((prev) => {
      const next = [code, ...prev.filter((c) => c !== code)].slice(0, 2);
      try {
        localStorage.setItem("wordtap_top_target", JSON.stringify(next));
      } catch {}
      return next;
    });
  }
  const [inputText, setInputText] = useState<string>("");
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [copiedSrc, setCopiedSrc] = useState<boolean>(false);
  const [copiedTarget, setCopiedTarget] = useState<boolean>(false);
  const [savingWord, setSavingWord] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);
  const savedWordsInSession = useRef<Set<string>>(new Set());
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Check if current translated pair is already saved
  const isAlreadySaved = Boolean(
    result?.translation &&
      result?.text &&
      (savedWordsInSession.current.has(result.text.trim().toLowerCase()) ||
        existingWords.some(
          (w) =>
            w.text.trim().toLowerCase() === result.text.trim().toLowerCase() ||
            w.translation.trim().toLowerCase() === result.translation.trim().toLowerCase(),
        )),
  );

  const performAutoSave = useCallback(
    async (data: TranslationResult, src: string, target: string) => {
      const cleanWord = data.text?.trim();
      const cleanTrans = data.translation?.trim();
      if (!cleanWord || !cleanTrans || cleanWord.length < 2) return;

      setSavingWord(true);
      try {
        const finalSrcLang =
          src === "auto" ? data.detectedSrcLang || "en" : src;
        await addCustomWord(
          cleanWord,
          cleanTrans,
          finalSrcLang,
          target,
        );
        savedWordsInSession.current.add(cleanWord.toLowerCase());
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);

        if (onWordSaved) {
          onWordSaved({
            id: `temp-${Date.now()}`,
            text: cleanWord,
            translation: cleanTrans,
            src_lang: finalSrcLang,
            target_lang: target,
            box: 1,
            times_seen: 1,
            next_review: new Date().toISOString(),
            correct_count: 0,
            wrong_count: 0,
            last_practiced: null,
            created_at: new Date().toISOString(),
            source_title: "Translator",
            source_url: "",
          });
        }
      } catch (err) {
        console.warn("Auto-save word error:", err);
      } finally {
        setSavingWord(false);
      }
    },
    [onWordSaved],
  );

  const fetchTranslation = useCallback(
    async (text: string, src: string, target: string) => {
      const q = text.trim();
      if (!q) {
        setResult(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const res = await fetch(
          `/api/translate?text=${encodeURIComponent(q)}&src=${encodeURIComponent(src)}&target=${encodeURIComponent(target)}`,
        );
        if (!res.ok) throw new Error("Translation failed");
        const data: TranslationResult = await res.json();
        setResult(data);
      } catch (err) {
        console.warn("Translation request error:", err);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Debounced translation as user types
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (!inputText.trim()) {
      setResult(null);
      setLoading(false);
      return;
    }

    debounceTimer.current = setTimeout(() => {
      void fetchTranslation(inputText, srcLang, targetLang);
    }, 320);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [inputText, srcLang, targetLang, fetchTranslation]);

  // Auto-Save Effect: only saves after 1.8 seconds of complete typing pause!
  useEffect(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);

    const curSettings = getStoredSettings();
    if (curSettings.translateSaveMode !== "auto") return;
    if (!result || !result.text || !result.translation) return;

    const cleanText = result.text.trim();
    if (cleanText.length < 2) return; // Don't save 1-letter fragments!

    const cleanLower = cleanText.toLowerCase();
    if (savedWordsInSession.current.has(cleanLower)) return;

    const alreadyInList = existingWords.some(
      (w) =>
        w.text.trim().toLowerCase() === cleanLower ||
        w.translation.trim().toLowerCase() === result.translation.trim().toLowerCase(),
    );
    if (alreadyInList) return;

    // Wait 1800ms of idle time after the user stops typing
    autoSaveTimer.current = setTimeout(() => {
      // Ensure current text still matches what was translated
      if (
        textareaRef.current &&
        textareaRef.current.value.trim().toLowerCase() === cleanLower
      ) {
        void performAutoSave(result, srcLang, targetLang);
      }
    }, 1800);

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [result, srcLang, targetLang, existingWords, performAutoSave]);

  // Immediate save on Enter key or textarea blur
  const handleImmediateAutoSave = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);

    const curSettings = getStoredSettings();
    if (curSettings.translateSaveMode !== "auto") return;
    if (!result || !result.text || !result.translation) return;

    const cleanText = result.text.trim();
    if (cleanText.length < 2) return;

    const cleanLower = cleanText.toLowerCase();
    if (savedWordsInSession.current.has(cleanLower)) return;

    const alreadyInList = existingWords.some(
      (w) =>
        w.text.trim().toLowerCase() === cleanLower ||
        w.translation.trim().toLowerCase() === result.translation.trim().toLowerCase(),
    );
    if (alreadyInList) return;

    void performAutoSave(result, srcLang, targetLang);
  }, [result, srcLang, targetLang, existingWords, performAutoSave]);

  // Swap Languages
  function handleSwap() {
    const currentDetected = result?.detectedSrcLang || "en";
    const nextSrc = srcLang === "auto" ? targetLang : targetLang;
    const nextTarget = srcLang === "auto" ? currentDetected : srcLang;

    selectSrcLang(nextSrc);
    selectTargetLang(nextTarget);

    if (result?.translation) {
      const prevTrans = result.translation;
      setInputText(prevTrans);
      void fetchTranslation(prevTrans, nextSrc, nextTarget);
    }
  }

  // Copy to clipboard
  async function handleCopy(text: string, which: "src" | "target") {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      if (which === "src") {
        setCopiedSrc(true);
        setTimeout(() => setCopiedSrc(false), 1800);
      } else {
        setCopiedTarget(true);
        setTimeout(() => setCopiedTarget(false), 1800);
      }
    } catch {
      // ignore
    }
  }

  // Read aloud (Speech Synthesis)
  function handleSpeak(text: string, lang: string) {
    if (!text) return;
    speak(text, lang);
  }

  // Save word to WordTap vocabulary
  async function handleSaveWord() {
    if (!result || !result.text || !result.translation || isAlreadySaved || savingWord) return;

    setSavingWord(true);
    try {
      const finalSrcLang =
        srcLang === "auto" ? result.detectedSrcLang || "en" : srcLang;

      await addCustomWord(
        result.text.trim(),
        result.translation.trim(),
        finalSrcLang,
        targetLang,
      );

      savedWordsInSession.current.add(result.text.trim().toLowerCase());
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);

      if (onWordSaved) {
        onWordSaved({
          id: `temp-${Date.now()}`,
          text: result.text.trim(),
          translation: result.translation.trim(),
          src_lang: finalSrcLang,
          target_lang: targetLang,
          box: 1,
          times_seen: 1,
          next_review: new Date().toISOString(),
          correct_count: 0,
          wrong_count: 0,
          last_practiced: null,
          created_at: new Date().toISOString(),
          source_title: "Translator",
          source_url: "",
        });
      }
    } catch (err: any) {
      console.error("Failed to save word:", err);
    } finally {
      setSavingWord(false);
    }
  }

  const isRTL =
    /[\u0600-\u06FF\u0590-\u05FF\u0750-\u077F]/.test(inputText) ||
    (srcLang === "ar" && !inputText);

  const detectedLabel =
    srcLang === "auto" && result?.detectedSrcLang
      ? `(${ALL_LANGS.find((l) => l.code === result.detectedSrcLang)?.native || result.detectedSrcLang})`
      : "";

  return (
    <section
      aria-label="Google Translate tool"
      className="rounded-3xl border border-line bg-surface shadow-xl overflow-hidden transition-all min-w-0"
    >
      {/* Top Header / Language Switcher Bar - Perfectly Centered & Symmetrical */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center border-b border-line/70 bg-surface/50 px-4 py-2.5 gap-3 sm:gap-4">
        {/* Source Language Tabs (Left Column) */}
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            type="button"
            onClick={() => selectSrcLang("auto")}
            className={`h-8 px-3.5 text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              srcLang === "auto"
                ? "bg-subtitle text-black font-bold shadow-sm"
                : "text-muted hover:text-ink hover:bg-line/40"
            }`}
          >
            Detect language {detectedLabel}
          </button>
          {topSrcLangs.map((code) => {
            const lang = ALL_LANGS.find((l) => l.code === code) || { code, native: code };
            const isActive = srcLang === code;
            return (
              <button
                key={`src-${code}`}
                type="button"
                onClick={() => selectSrcLang(code)}
                className={`h-8 px-3.5 text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  isActive
                    ? "bg-subtitle text-black font-bold shadow-sm"
                    : "text-muted hover:text-ink hover:bg-line/40"
                }`}
              >
                {lang.native}
              </button>
            );
          })}
          <LanguageDropdown
            current={srcLang}
            onSelect={selectSrcLang}
            align="left"
          />
        </div>

        {/* Swap Button ⇄ (Center Column - EXACTLY in the middle with ample padding!) */}
        <div className="flex items-center justify-center shrink-0 px-2">
          <button
            type="button"
            onClick={handleSwap}
            title="Swap languages"
            aria-label="Swap languages"
            className="w-8 h-8 rounded-full border border-line bg-surface hover:border-subtitle hover:bg-subtitle/15 text-muted hover:text-ink hover:scale-110 active:scale-95 transition-all flex items-center justify-center shadow-sm cursor-pointer"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M8 7h12m0 0l-4-4m4 4l-4 4m-4 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </button>
        </div>

        {/* Target Language Tabs & Save Mode (Right Column) */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            {topTargetLangs.map((code) => {
              const lang = ALL_LANGS.find((l) => l.code === code) || { code, native: code };
              const isActive = targetLang === code;
              return (
                <button
                  key={`target-${code}`}
                  type="button"
                  onClick={() => selectTargetLang(code)}
                  className={`h-8 px-3.5 text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    isActive
                      ? "bg-subtitle text-black font-bold shadow-sm"
                      : "text-muted hover:text-ink hover:bg-line/40"
                  }`}
                >
                  {lang.native}
                </button>
              );
            })}
            <LanguageDropdown
              current={targetLang}
              onSelect={selectTargetLang}
              align="left"
            />
          </div>

          {/* Save mode indicator / link to Settings */}
          <Link
            href="/settings"
            title="Configure Word Saving in Settings (Auto-save / Manual)"
            className="h-8 inline-flex items-center gap-1.5 px-2.5 text-xs font-semibold rounded-xl border border-line bg-surface hover:border-subtitle/50 text-muted hover:text-ink transition-all shrink-0 ms-auto"
          >
            {(settings.translateSaveMode || "manual") === "auto" ? (
              <>
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="font-semibold text-ink">Auto-save: ON ⚡</span>
              </>
            ) : (
              <>
                <span>✍️ Manual save</span>
              </>
            )}
          </Link>
        </div>
      </div>

      {/* Two Column Layout (Input on Left, Translation on Right) */}
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-line min-h-[220px]">
        {/* Source Text Box */}
        <div className="flex flex-col justify-between p-4 sm:p-5 relative bg-transparent">
          <div className="relative">
            <textarea
              ref={textareaRef}
              rows={4}
              value={inputText}
              onChange={(e) => {
                if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
                setInputText(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleImmediateAutoSave();
                }
              }}
              onBlur={() => {
                handleImmediateAutoSave();
              }}
              placeholder="Enter text to translate..."
              dir={isRTL ? "rtl" : "ltr"}
              className={`w-full bg-transparent resize-none text-lg sm:text-2xl font-medium text-ink placeholder:text-muted/50 focus:outline-none border-0 py-0 leading-relaxed ${
                isRTL ? "pl-11 pr-2 text-right" : "pr-11 pl-2 text-left"
              }`}
            />

            {/* Clear Button (X) - Dynamically positioned on the opposite side of text origin */}
            {inputText ? (
              <button
                type="button"
                onClick={() => {
                  setInputText("");
                  setResult(null);
                  textareaRef.current?.focus();
                }}
                className={`absolute top-0.5 ${
                  isRTL ? "left-0" : "right-0"
                } p-1.5 text-muted hover:text-ink rounded-lg hover:bg-white/10 transition-colors z-10`}
                title="Clear text"
                aria-label="Clear text"
              >
                <CloseIcon />
              </button>
            ) : null}

            {/* Source Pronunciation / Phonetics */}
            {result?.sourcePronunciation ? (
              <p
                className={`mt-2 text-xs sm:text-sm font-mono text-muted/80 select-all ${
                  isRTL ? "text-right" : "text-left"
                }`}
              >
                {result.sourcePronunciation}
              </p>
            ) : null}
          </div>

          {/* Bottom Toolbar for Source */}
          <div className="flex items-center justify-between pt-4 mt-2 border-t border-line/40">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  handleSpeak(
                    inputText,
                    srcLang === "auto" ? result?.detectedSrcLang || "en" : srcLang,
                  )
                }
                disabled={!inputText}
                title="Listen"
                className="p-2 rounded-xl text-muted hover:text-ink hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <SpeakerIcon size={19} />
              </button>
              <button
                type="button"
                onClick={() => handleCopy(inputText, "src")}
                disabled={!inputText}
                title={copiedSrc ? "Copied!" : "Copy text"}
                className="p-2 rounded-xl text-muted hover:text-ink hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all relative"
              >
                {copiedSrc ? (
                  <span className="text-xs font-bold text-subtitle">✓</span>
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
            </div>

            <span className="text-xs text-muted/60 font-mono">
              {inputText.length} / 5000
            </span>
          </div>
        </div>

        {/* Target Translation Box */}
        <div className="flex flex-col justify-between p-4 sm:p-5 bg-surface-elevated/40 relative">
          <div>
            {loading ? (
              <div className="flex items-center gap-2 text-muted animate-pulse py-4">
                <span className="h-4 w-4 rounded-full border-2 border-subtitle border-t-transparent animate-spin" />
                <span className="text-sm">Translating...</span>
              </div>
            ) : result?.translation ? (
              <div className="space-y-2">
                <div
                  dir="auto"
                  className="text-xl sm:text-2xl font-bold text-ink leading-relaxed select-all"
                >
                  {result.translation}
                </div>

                {/* Target Pronunciation / Phonetics */}
                {result.targetPronunciation ? (
                  <p className="text-xs sm:text-sm font-mono text-muted/80 select-all">
                    {result.targetPronunciation}
                  </p>
                ) : null}

                {/* Dictionary Definitions (like in user screenshot) */}
                {result.definitions && result.definitions.length > 0 ? (
                  <div className="mt-4 pt-3 border-t border-line/50 space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                      Dictionary / معاني الكلمة:
                    </span>
                    <div className="space-y-1.5">
                      {result.definitions.map((def, idx) => (
                        <div
                          key={`def-${idx}`}
                          className="flex flex-wrap items-baseline gap-2 text-xs sm:text-sm"
                        >
                          <span className="inline-block px-1.5 py-0.5 rounded bg-subtitle/15 text-subtitle font-bold text-[11px]">
                            {def.partOfSpeech}
                          </span>
                          <span dir="auto" className="text-muted leading-relaxed">
                            {def.meanings.join(" • ")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="text-lg sm:text-2xl font-medium text-muted/40 py-2">
                Translation
              </div>
            )}
          </div>

          {/* Bottom Toolbar for Target */}
          <div className="flex items-center justify-between pt-4 mt-4 border-t border-line/40 gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleSpeak(result?.translation || "", targetLang)}
                disabled={!result?.translation}
                title="Listen translation"
                className="p-2 rounded-xl text-muted hover:text-ink hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <SpeakerIcon size={19} />
              </button>
              <button
                type="button"
                onClick={() => handleCopy(result?.translation || "", "target")}
                disabled={!result?.translation}
                title={copiedTarget ? "Copied!" : "Copy translation"}
                className="p-2 rounded-xl text-muted hover:text-ink hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all relative"
              >
                {copiedTarget ? (
                  <span className="text-xs font-bold text-subtitle">✓</span>
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
            </div>

            {/* Save to My Words Button or Auto-Save Status */}
            {result?.translation ? (
              (settings.translateSaveMode || "manual") === "auto" ? (
                <div
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold border transition-all ${
                    savingWord
                      ? "bg-subtitle/20 text-subtitle border-subtitle/30"
                      : "bg-green-600/20 text-green-500 border-green-500/30"
                  }`}
                >
                  {savingWord ? (
                    <>
                      <span className="h-3.5 w-3.5 rounded-full border-2 border-subtitle border-t-transparent animate-spin" />
                      <span>Auto-saving word...</span>
                    </>
                  ) : (
                    <>
                      <span>⚡ Auto-saved to words ✓</span>
                    </>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleSaveWord}
                  disabled={isAlreadySaved || savingWord}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm ${
                    isAlreadySaved || saveSuccess
                      ? "bg-green-600/20 text-green-500 border border-green-500/30 cursor-default"
                      : "bg-subtitle text-black hover:bg-[#e6b825] active:scale-95 cursor-pointer"
                  }`}
                >
                  {savingWord ? (
                    <>
                      <span className="h-3.5 w-3.5 rounded-full border-2 border-black border-t-transparent animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : isAlreadySaved || saveSuccess ? (
                    <>
                      <span>✓ In your words</span>
                    </>
                  ) : (
                    <>
                      <span>⭐ + Save to My Words</span>
                    </>
                  )}
                </button>
              )
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

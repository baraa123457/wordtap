"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { speak } from "@/lib/speech";
import { addCustomWord } from "@/lib/api";
import { getStoredSettings, type UserSettings } from "@/lib/settings";
import type { Word } from "@/lib/schemas";
import { SpeakerIcon, CloseIcon } from "@/components/Icons";
import { addHistoryItem, markHistoryItemSaved } from "@/lib/history";

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

export type SpellCorrection = {
  correctedText: string;
  originalText: string;
  autoCorrected: boolean;
};

type TranslationResult = {
  text: string;
  translation: string;
  detectedSrcLang: string;
  sourcePronunciation?: string;
  targetPronunciation?: string;
  definitions?: Definition[];
  correction?: SpellCorrection | null;
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
        className={`h-7 px-2.5 rounded-lg flex items-center justify-center gap-1 text-xs font-medium transition-all cursor-pointer select-none ${
          open
            ? "bg-black/10 dark:bg-white/15 text-ink"
            : "text-muted hover:text-ink hover:bg-black/5 dark:hover:bg-white/10"
        }`}
      >
        <span>More</span>
        <svg
          className={`w-3.5 h-3.5 transition-transform duration-200 ${
            open ? "rotate-180" : "opacity-70"
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
          className={`absolute top-full mt-2 z-50 min-w-[220px] max-h-64 overflow-y-auto rounded-2xl border border-line bg-surface/95 p-1.5 shadow-2xl backdrop-blur-xl ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted border-b border-line/40 mb-1">
            Languages
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
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                  isSelected
                    ? "bg-black/5 dark:bg-white/10 text-ink font-semibold"
                    : "text-muted hover:text-ink hover:bg-black/5 dark:hover:bg-white/5"
                }`}
              >
                <span>{lang.native}</span>
                <span className={`text-xs ${isSelected ? "text-ink font-semibold" : "text-muted"}`}>
                  {lang.name} {isSelected && "✓"}
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

  // Custom Meaning & Comment States
  const [customTranslation, setCustomTranslation] = useState<string>("");
  const [customNote, setCustomNote] = useState<string>("");
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editMeaning, setEditMeaning] = useState<string>("");
  const [editNote, setEditNote] = useState<string>("");

  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);
  const savedWordsInSession = useRef<Set<string>>(new Set());
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const baseTranslation = customTranslation.trim() || result?.translation || "";
  const effectiveTranslation = customNote.trim()
    ? `${baseTranslation} (${customNote.trim()})`
    : baseTranslation;

  // Check if current translated pair is already saved
  const isAlreadySaved = Boolean(
    result?.translation &&
      result?.text &&
      (() => {
        const checkText = (
          result.correction?.autoCorrected
            ? result.correction.correctedText
            : result.text
        )
          .trim()
          .toLowerCase();
        const currentTrans = effectiveTranslation.trim().toLowerCase();
        const sessionKey = `${checkText}:::${currentTrans}`;
        return (
          savedWordsInSession.current.has(sessionKey) ||
          existingWords.some(
            (w) =>
              w.text.trim().toLowerCase() === checkText &&
              w.translation.trim().toLowerCase() === currentTrans,
          )
        );
      })(),
  );

  const performAutoSave = useCallback(
    async (data: TranslationResult, src: string, target: string, overrideTrans?: string) => {
      const cleanWord = (
        data.correction?.autoCorrected ? data.correction.correctedText : data.text
      )?.trim();
      const cleanTrans = (overrideTrans || data.translation)?.trim();
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
        savedWordsInSession.current.add(`${cleanWord.toLowerCase()}:::${cleanTrans.toLowerCase()}`);
        markHistoryItemSaved(cleanWord, finalSrcLang, target);
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
    async (text: string, src: string, target: string, forceExact = false) => {
      const q = text.trim();
      if (!q) {
        setResult(null);
        setCustomTranslation("");
        setCustomNote("");
        setIsEditing(false);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const url = `/api/translate?text=${encodeURIComponent(q)}&src=${encodeURIComponent(
          src,
        )}&target=${encodeURIComponent(target)}${
          forceExact ? "&forceExact=true" : ""
        }`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Translation failed");
        const data: TranslationResult = await res.json();
        setResult(data);
        setCustomTranslation("");
        setCustomNote("");
        setIsEditing(false);
        if (data?.text && data?.translation) {
          const effectiveText = data.correction?.autoCorrected
            ? data.correction.correctedText
            : data.text;
          addHistoryItem({
            text: effectiveText,
            translation: data.translation,
            src_lang: data.detectedSrcLang || src,
            target_lang: target,
            source: "translator",
          });
        }
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
      setCustomTranslation("");
      setCustomNote("");
      setIsEditing(false);
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
    if (isEditing) return; // Do not auto-save while user is customizing meaning/note

    const cleanText = (
      result.correction?.autoCorrected
        ? result.correction.correctedText
        : result.text
    ).trim();
    if (cleanText.length < 2) return; // Don't save 1-letter fragments!

    const currentTrans = effectiveTranslation.trim();
    const sessionKey = `${cleanText.toLowerCase()}:::${currentTrans.toLowerCase()}`;
    if (savedWordsInSession.current.has(sessionKey)) return;

    const alreadyInList = existingWords.some(
      (w) =>
        w.text.trim().toLowerCase() === cleanText.toLowerCase() &&
        w.translation.trim().toLowerCase() === currentTrans.toLowerCase(),
    );
    if (alreadyInList) return;

    // Wait 1800ms of idle time after the user stops typing
    autoSaveTimer.current = setTimeout(() => {
      // Ensure current text still matches what was translated
      if (
        textareaRef.current &&
        textareaRef.current.value.trim().toLowerCase() === (result.text || "").trim().toLowerCase()
      ) {
        void performAutoSave(result, srcLang, targetLang, currentTrans);
      }
    }, 1800);

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [result, srcLang, targetLang, existingWords, performAutoSave, isEditing, effectiveTranslation]);

  // Immediate save on Enter key or textarea blur
  const handleImmediateAutoSave = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);

    const curSettings = getStoredSettings();
    if (curSettings.translateSaveMode !== "auto") return;
    if (!result || !result.text || !result.translation) return;
    if (isEditing) return;

    const cleanText = (
      result.correction?.autoCorrected
        ? result.correction.correctedText
        : result.text
    ).trim();
    if (cleanText.length < 2) return;

    const currentTrans = effectiveTranslation.trim();
    const sessionKey = `${cleanText.toLowerCase()}:::${currentTrans.toLowerCase()}`;
    if (savedWordsInSession.current.has(sessionKey)) return;

    const alreadyInList = existingWords.some(
      (w) =>
        w.text.trim().toLowerCase() === cleanText.toLowerCase() &&
        w.translation.trim().toLowerCase() === currentTrans.toLowerCase(),
    );
    if (alreadyInList) return;

    void performAutoSave(result, srcLang, targetLang, currentTrans);
  }, [result, srcLang, targetLang, existingWords, performAutoSave, isEditing, effectiveTranslation]);

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
      const cleanWord = (
        result.correction?.autoCorrected
          ? result.correction.correctedText
          : result.text
      ).trim();
      const cleanTrans = effectiveTranslation.trim();

      await addCustomWord(
        cleanWord,
        cleanTrans,
        finalSrcLang,
        targetLang,
      );

      savedWordsInSession.current.add(`${cleanWord.toLowerCase()}:::${cleanTrans.toLowerCase()}`);
      markHistoryItemSaved(cleanWord, finalSrcLang, targetLang);
      addHistoryItem({
        text: cleanWord,
        translation: cleanTrans,
        src_lang: finalSrcLang,
        target_lang: targetLang,
        source: "translator",
        saved: true,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);

      if (onWordSaved) {
        onWordSaved({
          id: `temp-${Date.now()}`,
          text: cleanWord,
          translation: cleanTrans,
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
      className="apple-card rounded-3xl overflow-hidden transition-all min-w-0"
    >
      {/* Top Header / Language Switcher Bar */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center border-b border-line/60 bg-surface px-4 py-2.5 gap-3">
        {/* Source Language Segmented Control (Left Column) */}
        <div className="flex items-center min-w-0">
          <div className="apple-segmented-container">
            <button
              type="button"
              onClick={() => selectSrcLang("auto")}
              data-active={srcLang === "auto" ? "true" : undefined}
              className="apple-segmented-item whitespace-nowrap"
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
                  data-active={isActive ? "true" : undefined}
                  className="apple-segmented-item whitespace-nowrap"
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
        </div>

        {/* Swap Button ⇄ (Center Column) */}
        <div className="flex items-center justify-center shrink-0 px-2">
          <button
            type="button"
            onClick={handleSwap}
            title="Swap languages"
            aria-label="Swap languages"
            className="w-8 h-8 rounded-full border border-line bg-black/[0.03] dark:bg-white/[0.06] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-muted hover:text-ink active:scale-90 transition-all flex items-center justify-center cursor-pointer"
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

        {/* Target Language Segmented Control & Save Mode (Right Column) */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="apple-segmented-container min-w-0">
            {topTargetLangs.map((code) => {
              const lang = ALL_LANGS.find((l) => l.code === code) || { code, native: code };
              const isActive = targetLang === code;
              return (
                <button
                  key={`target-${code}`}
                  type="button"
                  onClick={() => selectTargetLang(code)}
                  data-active={isActive ? "true" : undefined}
                  className="apple-segmented-item whitespace-nowrap"
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
            className="h-7 inline-flex items-center gap-1.5 px-2.5 text-xs font-medium rounded-full bg-black/[0.03] dark:bg-white/[0.06] border border-line text-muted hover:text-ink transition-all shrink-0 ms-auto"
          >
            {(settings.translateSaveMode || "manual") === "auto" ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[11px] font-semibold text-ink">Auto-save</span>
              </>
            ) : (
              <span className="text-[11px]">Manual save</span>
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

            {/* Google-style Spell Correction Banner */}
            {result?.correction ? (
              <div
                className={`mt-3 p-3 rounded-2xl bg-subtitle/10 border border-subtitle/25 text-xs sm:text-sm space-y-1.5 ${
                  isRTL ? "text-right" : "text-left"
                }`}
              >
                {result.correction.autoCorrected ? (
                  <>
                    <div className="flex items-center gap-1.5 flex-wrap text-ink font-medium">
                      <span className="text-subtitle font-bold text-sm">✨</span>
                      <span>Showing translation for</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (result?.correction) {
                            setInputText(result.correction.correctedText);
                            void fetchTranslation(result.correction.correctedText, srcLang, targetLang);
                          }
                        }}
                        className="font-bold text-subtitle hover:underline italic cursor-pointer"
                      >
                        {result.correction.correctedText}
                      </button>
                      <span className="text-muted text-[11px]">
                        (عرض الترجمة لـ <strong className="text-subtitle font-semibold">{result.correction.correctedText}</strong>)
                      </span>
                    </div>
                    <div className="text-xs text-muted flex items-center gap-1.5 flex-wrap">
                      <span>Translate</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (result?.correction) {
                            void fetchTranslation(result.correction.originalText, srcLang, targetLang, true);
                          }
                        }}
                        className="text-subtitle hover:underline font-medium cursor-pointer"
                      >
                        {result.correction.originalText}
                      </button>
                      <span>instead</span>
                      <span className="text-muted/70 text-[11px]">
                        (ترجمة {result.correction.originalText} بدلاً من ذلك)
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-1.5 flex-wrap text-ink font-medium">
                    <span className="text-subtitle font-bold text-sm">✨</span>
                    <span>Did you mean:</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (result?.correction) {
                          setInputText(result.correction.correctedText);
                          void fetchTranslation(result.correction.correctedText, srcLang, targetLang);
                        }
                      }}
                      className="font-bold text-subtitle hover:underline italic cursor-pointer"
                    >
                      {result.correction.correctedText}
                    </button>
                    <span className="text-muted text-[11px]">
                      (هل تقصد: <strong className="text-subtitle font-semibold">{result.correction.correctedText}</strong>؟)
                    </span>
                  </div>
                )}
              </div>
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
              <div className="space-y-3">
                {/* Header: Translated text + Edit/Customize button */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div
                      dir="auto"
                      className="text-xl sm:text-2xl font-bold text-ink leading-relaxed select-all"
                    >
                      {baseTranslation}
                    </div>

                    {/* Target Pronunciation / Phonetics */}
                    {!customTranslation && result.targetPronunciation ? (
                      <p className="text-xs sm:text-sm font-mono text-muted/80 select-all">
                        {result.targetPronunciation}
                      </p>
                    ) : null}
                  </div>

                  {/* Edit/Customize Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setEditMeaning(baseTranslation);
                      setEditNote(customNote);
                      setIsEditing((prev) => !prev);
                    }}
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                      isEditing || customTranslation || customNote
                        ? "bg-subtitle/15 text-ink border-subtitle/40 font-semibold"
                        : "text-muted hover:text-ink hover:bg-black/5 dark:hover:bg-white/10 border-line"
                    }`}
                    title="تعديل المعنى أو إضافة ملاحظة / تعليق بالعربي"
                  >
                    <svg className="w-3.5 h-3.5 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                    <span>
                      {customTranslation || customNote ? "تعديل المعنى" : "تعديل أو تعليق"}
                    </span>
                  </button>
                </div>

                {/* Active Custom Meaning & Note Badges (when not editing) */}
                {(customTranslation || customNote) && !isEditing ? (
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    {customTranslation && customTranslation !== result.translation ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-subtitle/15 border border-subtitle/30 text-xs text-ink font-medium">
                        <span className="text-subtitle font-bold text-[11px]">معنى مخصص:</span>
                        <span className="font-semibold">{customTranslation}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setCustomTranslation("");
                            setEditMeaning(result.translation);
                          }}
                          className="ms-1 text-[11px] text-muted hover:text-bad underline cursor-pointer"
                          title="استعادة الترجمة الافتراضية"
                        >
                          (الأصلية: {result.translation})
                        </button>
                      </span>
                    ) : null}

                    {customNote ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/25 text-xs text-ink font-medium">
                        <svg className="w-3 h-3 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                        <span className="text-blue-500 font-semibold text-[11px]">ملاحظة:</span>
                        <span dir="auto">{customNote}</span>
                        <button
                          type="button"
                          onClick={() => setCustomNote("")}
                          className="ms-1 text-xs text-muted hover:text-bad cursor-pointer"
                          title="حذف الملاحظة"
                        >
                          ✕
                        </button>
                      </span>
                    ) : null}
                  </div>
                ) : null}

                {/* Inline Edit Panel when isEditing is true */}
                {isEditing ? (
                  <div className="p-4 rounded-2xl bg-surface border border-line shadow-lg space-y-3 animate-in fade-in">
                    <div className="flex items-center justify-between border-b border-line/50 pb-2">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                        <svg className="w-3.5 h-3.5 text-subtitle" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                        <span>تخصيص المعنى أو إضافة تعليق بالعربي</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="text-xs text-muted hover:text-ink cursor-pointer p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
                        aria-label="إغلاق"
                      >
                        ✕
                      </button>
                    </div>

                    {/* 1. Meaning input */}
                    <div>
                      <label className="block text-[11px] font-medium text-muted mb-1">
                        الترجمة / المعنى المفضل (Preferred Meaning):
                      </label>
                      <input
                        type="text"
                        dir="auto"
                        value={editMeaning}
                        onChange={(e) => setEditMeaning(e.target.value)}
                        placeholder="اكتب المعنى الذي تفضله (مثال: ترانزيت / على حسابي)..."
                        className="w-full px-3 py-2 text-sm rounded-xl border border-line bg-surface-elevated text-ink placeholder:text-muted/50 focus:outline-none focus:border-subtitle"
                      />
                    </div>

                    {/* 2. Optional Comment/Note input */}
                    <div>
                      <label className="block text-[11px] font-medium text-muted mb-1">
                        تعليق أو ملاحظة بالعربي (Comment / Context - Optional):
                      </label>
                      <input
                        type="text"
                        dir="auto"
                        value={editNote}
                        onChange={(e) => setEditNote(e.target.value)}
                        placeholder="أضف تعليقاً أو سياقاً بالعربي (مثال: تستخدم في المطارات، أو عامية)..."
                        className="w-full px-3 py-2 text-sm rounded-xl border border-line bg-surface-elevated text-ink placeholder:text-muted/50 focus:outline-none focus:border-subtitle"
                      />
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setCustomTranslation("");
                          setCustomNote("");
                          setEditMeaning(result.translation);
                          setEditNote("");
                          setIsEditing(false);
                        }}
                        className="text-xs text-muted hover:text-bad underline cursor-pointer"
                      >
                        ↺ استعادة الترجمة الافتراضية
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsEditing(false)}
                          className="px-3 py-1.5 text-xs font-medium rounded-xl text-muted hover:text-ink hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                        >
                          إلغاء
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCustomTranslation(editMeaning.trim());
                            setCustomNote(editNote.trim());
                            setIsEditing(false);
                          }}
                          className="btn btn-primary min-h-8 px-4 py-1.5 text-xs rounded-xl cursor-pointer"
                        >
                          ✓ تطبيق التعديل
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Dictionary Definitions with Apple capsule chips */}
                {result.definitions && result.definitions.length > 0 ? (
                  <div className="mt-3 pt-3 border-t border-line/50 space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center justify-between">
                      <span>Dictionary / معاني الكلمة:</span>
                      <span className="text-[11px] font-normal text-muted/70 lowercase">اضغط على أي معنى لاختياره</span>
                    </span>
                    <div className="space-y-2">
                      {result.definitions.map((def, idx) => (
                        <div
                          key={`def-${idx}`}
                          className="flex flex-wrap items-baseline gap-2 text-xs sm:text-sm"
                        >
                          <span className="inline-block px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/10 text-muted font-medium text-[11px]">
                            {def.partOfSpeech}
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {def.meanings.map((m, mIdx) => {
                              const isCurrent = baseTranslation.trim() === m.trim();
                              return (
                                <button
                                  key={`m-${idx}-${mIdx}`}
                                  type="button"
                                  onClick={() => {
                                    setCustomTranslation(m.trim());
                                    setEditMeaning(m.trim());
                                  }}
                                  title="اضغط لتغيير المعنى إلى هذا اللفظ"
                                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                                    isCurrent
                                      ? "bg-subtitle text-black font-semibold shadow-xs"
                                      : "bg-black/[0.04] dark:bg-white/[0.08] text-ink hover:bg-black/[0.08] dark:hover:bg-white/[0.12]"
                                  }`}
                                >
                                  {m}
                                  {isCurrent && <span className="ms-1 text-[10px]">✓</span>}
                                </button>
                              );
                            })}
                          </div>
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
                onClick={() => handleSpeak(baseTranslation, targetLang)}
                disabled={!result?.translation}
                title="Listen translation"
                className="p-2 rounded-xl text-muted hover:text-ink hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <SpeakerIcon size={19} />
              </button>
              <button
                type="button"
                onClick={() => handleCopy(effectiveTranslation, "target")}
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
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    savingWord
                      ? "bg-subtitle/15 text-ink border-subtitle/30"
                      : "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20"
                  }`}
                >
                  {savingWord ? (
                    <>
                      <span className="h-3 w-3 rounded-full border-2 border-subtitle border-t-transparent animate-spin" />
                      <span>Auto-saving...</span>
                    </>
                  ) : (
                    <>
                      <span>✓ Auto-saved to words</span>
                    </>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleSaveWord}
                  disabled={isAlreadySaved || savingWord}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                    isAlreadySaved || saveSuccess
                      ? "bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 cursor-default"
                      : "btn btn-primary min-h-9 px-4 py-1.5 text-xs sm:text-sm"
                  }`}
                >
                  {savingWord ? (
                    <>
                      <span className="h-3.5 w-3.5 rounded-full border-2 border-black border-t-transparent animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : isAlreadySaved || saveSuccess ? (
                    <>
                      <svg className="w-4 h-4 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span>In your words</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                      <span>Save to My Words</span>
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

"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { speak } from "@/lib/speech";
import { addCustomWord, deleteWord } from "@/lib/api";
import { getStoredSettings, type UserSettings, type TranslationProvider } from "@/lib/settings";
import type { Word } from "@/lib/schemas";
import { SpeakerIcon, CloseIcon, TrashIcon, ImageIcon, MicIcon } from "@/components/Icons";
import { addHistoryItem, markHistoryItemSaved } from "@/lib/history";
import { getVerbConjugation, type VerbConjugation } from "@/lib/verbs";

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

export type SourceDefinition = {
  partOfSpeech: string;
  text: string;
};

export type SpellCorrection = {
  correctedText: string;
  originalText: string;
  autoCorrected: boolean;
};

function renderHighlightedSentence(sentence: string, targetWord: string) {
  const clean = sentence.replace(/<[^>]+>/g, "").trim();
  if (!targetWord || !targetWord.trim()) {
    return clean;
  }
  const cleanWord = targetWord.trim();
  const escaped = cleanWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(\\b${escaped}(?:s|es|ed|ing|d)?\\b)`, "gi");
  const parts = clean.split(regex);

  return parts.map((part, i) => {
    if (regex.test(part)) {
      return (
        <span
          key={i}
          className="not-italic font-extrabold text-amber-600 dark:text-amber-300 bg-amber-500/15 dark:bg-amber-400/20 px-1.5 py-0.5 rounded-md border border-amber-500/30 dark:border-amber-400/30 shadow-2xs"
        >
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

type TranslationResult = {
  text: string;
  translation: string;
  detectedSrcLang: string;
  sourcePronunciation?: string;
  targetPronunciation?: string;
  definitions?: Definition[];
  sourceDefinitions?: SourceDefinition[];
  partsOfSpeech?: string[];
  primaryPartOfSpeech?: string | null;
  correction?: SpellCorrection | null;
  verbInfo?: VerbConjugation | null;
  examples?: Array<{ sentence: string; source?: string }>;
  provider?: string;
};

export const POS_BADGES: Record<string, { en: string; ar: string; badge: string }> = {
  noun: { en: "noun", ar: "اسم", badge: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30" },
  n: { en: "noun", ar: "اسم", badge: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30" },
  verb: { en: "verb", ar: "فعل", badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
  v: { en: "verb", ar: "فعل", badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
  adjective: { en: "adj", ar: "صفة", badge: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30" },
  adj: { en: "adj", ar: "صفة", badge: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30" },
  adverb: { en: "adv", ar: "ظرف", badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" },
  adv: { en: "adv", ar: "ظرف", badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" },
  pronoun: { en: "pron", ar: "ضمير", badge: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30" },
  pron: { en: "pron", ar: "ضمير", badge: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30" },
  preposition: { en: "prep", ar: "حرف جر", badge: "bg-pink-500/15 text-pink-600 dark:text-pink-400 border-pink-500/30" },
  prep: { en: "prep", ar: "حرف جر", badge: "bg-pink-500/15 text-pink-600 dark:text-pink-400 border-pink-500/30" },
  conjunction: { en: "conj", ar: "حرف عطف", badge: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30" },
  conj: { en: "conj", ar: "حرف عطف", badge: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30" },
  interjection: { en: "interj", ar: "تعجب", badge: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30" },
  phrase: { en: "phrase", ar: "عبارة", badge: "bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30" },
  idiom: { en: "idiom", ar: "تعبير اصطلاحي", badge: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30" },
  // Verb Tense Badges
  past: { en: "past (V2)", ar: "ماضي", badge: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40" },
  present: { en: "present (V1)", ar: "مضارع", badge: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40" },
  past_participle: { en: "past part. (V3)", ar: "تصريف ثالث", badge: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40" },
  continuous: { en: "continuous (-ing)", ar: "مستمر", badge: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40" },
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
        className={`h-7 px-2 sm:px-2.5 rounded-lg flex items-center justify-center gap-1 text-xs font-medium transition-all cursor-pointer select-none ${
          open
            ? "bg-black/10 dark:bg-white/15 text-ink"
            : "text-muted hover:text-ink hover:bg-black/5 dark:hover:bg-white/10"
        }`}
      >
        <span className="hidden sm:inline">More</span>
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
          className={`absolute top-full mt-2 z-50 min-w-[200px] max-w-[calc(100vw-2rem)] max-h-64 overflow-y-auto rounded-2xl border border-line bg-surface/95 p-1.5 shadow-2xl backdrop-blur-xl ${
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
  const [targetLang, setTargetLang] = useState<string>(() => settings.targetLang || "ar");
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

  // Translation Provider (Engine) State
  const [provider, setProvider] = useState<TranslationProvider>(
    () => settings.translationProvider || "google",
  );
  const [providerMenuOpen, setProviderMenuOpen] = useState(false);
  const providerMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (providerMenuRef.current && !providerMenuRef.current.contains(e.target as Node)) {
        setProviderMenuOpen(false);
      }
    }
    if (providerMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [providerMenuOpen]);

  // Photo / Image OCR State
  const [ocrLoading, setOcrLoading] = useState<boolean>(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  const matchedExistingWord = useMemo(() => {
    if (!result?.text || !effectiveTranslation) return null;
    const checkText = (
      result.correction?.autoCorrected
        ? result.correction.correctedText
        : result.text
    ).trim().toLowerCase();
    const currentTrans = effectiveTranslation.trim().toLowerCase();
    return (
      existingWords.find(
        (w) =>
          w.text.trim().toLowerCase() === checkText &&
          w.translation.trim().toLowerCase() === currentTrans,
      ) || null
    );
  }, [result, effectiveTranslation, existingWords]);

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
          Boolean(matchedExistingWord)
        );
      })(),
  );

  const activeVerbConjugation = useMemo(() => {
    if (result?.verbInfo) return result.verbInfo;
    const clean = (result?.text || inputText).trim().toLowerCase();
    if (clean && !clean.includes(" ") && clean.length <= 30) {
      return getVerbConjugation(clean);
    }
    return null;
  }, [result?.verbInfo, result?.text, inputText]);

  const [showAllDefinitions, setShowAllDefinitions] = useState(false);
  const [showAllAlternatives, setShowAllAlternatives] = useState(false);

  const effectivePartsOfSpeech = useMemo(() => {
    const list = [...(result?.partsOfSpeech || [])];
    if (activeVerbConjugation) {
      if (!list.includes("verb")) list.unshift("verb");
      for (const t of activeVerbConjugation.currentTenses) {
        if (t === "past" && !list.includes("past")) list.push("past");
        if (t === "past_participle" && !list.includes("past_participle")) list.push("past_participle");
        if (t === "present_participle" && !list.includes("continuous")) list.push("continuous");
        if (t === "base" && !list.includes("present")) list.push("present");
      }
    }
    const cleanList = list
      .map((p) => p.toLowerCase().trim())
      .filter((p) => p && p !== "def" && p !== "alternatives" && p !== "undefined");
    return Array.from(new Set(cleanList));
  }, [result?.partsOfSpeech, activeVerbConjugation]);

  // Cleanly separate Source Monolingual Definitions (Left Side) from Target Alternatives (Right Side)
  const { sourceDefinitionsList, targetAlternativesList } = useMemo(() => {
    const srcDefs: Array<{ partOfSpeech: string; text: string }> = [
      ...(result?.sourceDefinitions || []),
    ];
    const targetAlts: Array<{ partOfSpeech: string; meanings: string[] }> = [];

    if (result?.definitions) {
      for (const def of result.definitions) {
        const rawPos = def.partOfSpeech.toLowerCase();
        const normPos = rawPos === "def" ? "noun" : rawPos;
        const shortWords: string[] = [];

        for (const m of def.meanings) {
          const trimmed = m.trim();
          if (!trimmed) continue;
          // An explanatory definition sentence typically has >35 chars or >5 words
          const isExplanation = trimmed.length > 35 || trimmed.split(" ").length > 5;
          if (isExplanation) {
            if (!srcDefs.some((s) => s.text === trimmed)) {
              srcDefs.push({ partOfSpeech: normPos, text: trimmed });
            }
          } else {
            shortWords.push(trimmed);
          }
        }

        if (shortWords.length > 0) {
          targetAlts.push({
            partOfSpeech: normPos === "def" ? "alternatives" : normPos,
            meanings: shortWords,
          });
        }
      }
    }

    return { sourceDefinitionsList: srcDefs, targetAlternativesList: targetAlts };
  }, [result?.sourceDefinitions, result?.definitions]);

  const [isDeletingWord, setIsDeletingWord] = useState(false);

  const handleDeleteWordFromTranslator = async () => {
    if (!matchedExistingWord) return;
    setIsDeletingWord(true);
    try {
      await deleteWord(matchedExistingWord.id);
      const checkText = (
        result?.correction?.autoCorrected
          ? result.correction.correctedText
          : result?.text || ""
      ).trim().toLowerCase();
      const currentTrans = effectiveTranslation.trim().toLowerCase();
      savedWordsInSession.current.delete(`${checkText}:::${currentTrans}`);
      setSaveSuccess(false);
      onWordSaved?.();
    } catch (e) {
      console.error("Failed to delete word from translator:", e);
    } finally {
      setIsDeletingWord(false);
    }
  };

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
          "Translator",
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
            sentence: "",
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
    async (
      text: string,
      src: string,
      target: string,
      forceExact = false,
      overrideProvider?: TranslationProvider,
    ) => {
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
        const activeProv = overrideProvider || provider;
        const url = `/api/translate?text=${encodeURIComponent(q)}&src=${encodeURIComponent(
          src,
        )}&target=${encodeURIComponent(target)}${
          forceExact ? "&forceExact=true" : ""
        }&provider=${encodeURIComponent(activeProv)}`;
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
    [provider],
  );

  function selectProvider(p: TranslationProvider) {
    setProvider(p);
    setProviderMenuOpen(false);
    try {
      const raw = localStorage.getItem("wordtap_settings");
      const current = raw ? JSON.parse(raw) : {};
      localStorage.setItem("wordtap_settings", JSON.stringify({ ...current, translationProvider: p }));
    } catch {}
    if (inputText.trim()) {
      void fetchTranslation(inputText, srcLang, targetLang, false, p);
    }
  }

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
      void fetchTranslation(inputText, srcLang, targetLang, false, provider);
    }, 320);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [inputText, srcLang, targetLang, provider, fetchTranslation]);

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
        "Translator",
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
          sentence: "",
        });
      }
    } catch (err: unknown) {
      console.error("Failed to save word:", err);
    } finally {
      setSavingWord(false);
    }
  }

// Compress and downscale image before upload to avoid multi-megabyte transfers
async function compressImageForOcr(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX_DIM = 1280;
      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;

      if (width > MAX_DIM || height > MAX_DIM) {
        if (width > height) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        } else {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, width);
      canvas.height = Math.max(1, height);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to read image"));
        reader.readAsDataURL(file);
        return;
      }

      // Draw white background in case image has transparency (PNG)
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Export as crisp JPEG with 0.82 quality: ~100KB payload instead of 5MB
      const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
      resolve(dataUrl);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read image file"));
      reader.readAsDataURL(file);
    };

    img.src = objectUrl;
  });
}

  // Process image for translation (OCR)
  const handleImageFile = useCallback(
    async (file: File) => {
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        setOcrError("Please upload an image file (PNG, JPG, WEBP).");
        return;
      }
      if (file.size > 15 * 1024 * 1024) {
        setOcrError("Image is too large (maximum size: 15 MB).");
        return;
      }

      setOcrError(null);
      setOcrLoading(true);

      try {
        // Fast client-side resize and compression to ~100KB in ~20ms
        const dataUrl = await compressImageForOcr(file);

        const res = await fetch("/api/ocr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: dataUrl,
            lang: srcLang === "auto" ? "en" : srcLang,
          }),
        });

        if (!res.ok) {
          const errData = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(errData?.error || "Failed to extract text from image");
        }

        const data = (await res.json()) as { ok?: boolean; text?: string; error?: string };
        const extractedText = (data?.text || "").trim();

        if (!extractedText) {
          setOcrError("No text detected in this image. Try another photo or clearer image.");
          return;
        }

        setInputText(extractedText);
        textareaRef.current?.focus();
      } catch (err: unknown) {
        const message =
          err instanceof Error && err.message
            ? err.message
            : "Failed to extract text from image";
        setOcrError(message);
      } finally {
        setOcrLoading(false);
      }
    },
    [srcLang],
  );

interface BrowserSpeechRecognitionEvent {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
}

interface BrowserSpeechRecognitionErrorEvent {
  error: string;
}

interface BrowserSpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognitionInstance;

  // Speech Recognition (Microphone Voice Dictation)
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognitionInstance | null>(null);

  const getSpeechLang = useCallback((langCode: string): string => {
    const map: Record<string, string> = {
      en: "en-US",
      ar: "ar-SA",
      es: "es-ES",
      fr: "fr-FR",
      de: "de-DE",
      it: "it-IT",
      pt: "pt-BR",
      ru: "ru-RU",
      tr: "tr-TR",
      ja: "ja-JP",
      ko: "ko-KR",
      zh: "zh-CN",
      nl: "nl-NL",
      pl: "pl-PL",
      sv: "sv-SE",
    };
    if (langCode === "auto") {
      return (typeof navigator !== "undefined" && navigator.language) || "en-US";
    }
    return map[langCode] || langCode;
  }, []);

  const toggleListening = useCallback(() => {
    if (typeof window === "undefined") return;

    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognitionAPI =
      (window as unknown as { SpeechRecognition?: BrowserSpeechRecognitionConstructor }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor }).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setSpeechError("Speech recognition is not supported in this browser. Try Chrome, Edge, or Safari.");
      setTimeout(() => setSpeechError(null), 4000);
      return;
    }

    setSpeechError(null);
    try {
      const recognition = new SpeechRecognitionAPI();
      recognitionRef.current = recognition;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = getSpeechLang(srcLang);

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: BrowserSpeechRecognitionEvent) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript.trim()) {
          setInputText(transcript.trim());
          if (debounceTimer.current) clearTimeout(debounceTimer.current);
          void fetchTranslation(transcript.trim(), srcLang, targetLang);
        }
      };

      recognition.onerror = (event: BrowserSpeechRecognitionErrorEvent) => {
        setIsListening(false);
        if (event.error === "not-allowed") {
          setSpeechError("Microphone permission denied. Please allow microphone in browser.");
        } else if (event.error !== "no-speech" && event.error !== "aborted") {
          setSpeechError(`Speech error: ${event.error}`);
        }
        setTimeout(() => setSpeechError(null), 4000);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch {
      setIsListening(false);
      setSpeechError("Failed to start voice input. Please try again.");
      setTimeout(() => setSpeechError(null), 4000);
    }
  }, [isListening, srcLang, targetLang, getSpeechLang, fetchTranslation]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, []);

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
      <div className="grid grid-cols-[1fr_auto_1fr] items-center border-b border-line/60 bg-surface px-2 sm:px-4 py-2 sm:py-2.5 gap-1.5 sm:gap-2.5">
        {/* Source Language Segmented Control (Left Column) */}
        <div className="flex items-center min-w-0 overflow-hidden">
          <div className="apple-segmented-container max-w-full overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => selectSrcLang("auto")}
              data-active={srcLang === "auto" ? "true" : undefined}
              className={`apple-segmented-item whitespace-nowrap text-xs sm:text-sm px-2 sm:px-3 ${
                srcLang === "auto" ? "inline-flex" : "hidden sm:inline-flex"
              }`}
            >
              <span className="hidden sm:inline">Detect language</span>
              <span className="sm:hidden">Detect</span>
              {detectedLabel ? (
                <span className="opacity-75 font-normal ms-1 text-[11px] sm:text-xs">
                  {detectedLabel}
                </span>
              ) : null}
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
                  className={`apple-segmented-item whitespace-nowrap text-xs sm:text-sm px-2 sm:px-3 ${
                    isActive ? "inline-flex" : "hidden xl:inline-flex"
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
        </div>

        {/* Swap Button ⇄ (Center Column) */}
        <div className="flex items-center justify-center shrink-0 px-0.5 sm:px-2">
          <button
            type="button"
            onClick={handleSwap}
            title="Swap languages"
            aria-label="Swap languages"
            className="w-8 h-8 rounded-full border border-line bg-surface hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-muted hover:text-ink active:scale-90 transition-all flex items-center justify-center cursor-pointer shadow-2xs shrink-0"
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
        <div className="flex items-center justify-end gap-1 sm:gap-2 min-w-0 overflow-hidden">
          <div className="apple-segmented-container max-w-full overflow-x-auto no-scrollbar">
            {topTargetLangs.map((code) => {
              const lang = ALL_LANGS.find((l) => l.code === code) || { code, native: code };
              const isActive = targetLang === code;
              return (
                <button
                  key={`target-${code}`}
                  type="button"
                  onClick={() => selectTargetLang(code)}
                  data-active={isActive ? "true" : undefined}
                  className={`apple-segmented-item whitespace-nowrap text-xs sm:text-sm px-2 sm:px-3 ${
                    isActive ? "inline-flex" : "hidden xl:inline-flex"
                  }`}
                >
                  {lang.native}
                </button>
              );
            })}
            <LanguageDropdown
              current={targetLang}
              onSelect={selectTargetLang}
              align="right"
            />
          </div>

          {/* Save mode indicator / link to Settings (Visible on sm+ viewports where space allows) */}
          <Link
            href="/settings"
            title="Configure Word Saving in Settings (Auto-save / Manual)"
            className="hidden sm:inline-flex h-7 items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 text-xs font-medium rounded-full bg-black/[0.03] dark:bg-white/[0.06] border border-line text-muted hover:text-ink transition-all shrink-0"
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
        <div
          className={`flex flex-col justify-between p-4 sm:p-5 relative bg-transparent transition-colors ${
            isDraggingOver ? "bg-subtitle/5 ring-2 ring-inset ring-subtitle/50" : ""
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!isDraggingOver) setIsDraggingOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDraggingOver(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDraggingOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file && file.type.startsWith("image/")) {
              void handleImageFile(file);
            }
          }}
        >
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
              onPaste={(e) => {
                const items = e.clipboardData?.items;
                if (items) {
                  for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    if (item.type.indexOf("image") !== -1) {
                      const file = item.getAsFile();
                      if (file) {
                        e.preventDefault();
                        void handleImageFile(file);
                        return;
                      }
                    }
                  }
                }
              }}
              onBlur={() => {
                handleImmediateAutoSave();
              }}
              placeholder="Enter text to translate or paste / drop an image..."
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

            {/* Source Part of Speech Badges (noun / verb / adj / past / present etc.) */}
            {effectivePartsOfSpeech.length > 0 ? (
              <div
                className={`mt-2.5 flex items-center gap-1.5 flex-wrap ${
                  isRTL ? "justify-end" : "justify-start"
                }`}
              >
                {effectivePartsOfSpeech.map((pos) => {
                  const p = pos.toLowerCase();
                  const meta = POS_BADGES[p] || {
                    en: p,
                    ar: p,
                    badge: "bg-subtitle/15 text-subtitle-edge dark:text-subtitle border-subtitle/30",
                  };
                  return (
                    <span
                      key={p}
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border tracking-wide shadow-2xs select-none ${meta.badge}`}
                      title={`Part of speech: ${meta.en} (${meta.ar})`}
                    >
                      <span>{meta.en}</span>
                      <span className="opacity-75 font-normal text-[10px]">· {meta.ar}</span>
                    </span>
                  );
                })}
              </div>
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

            {/* Source Monolingual Dictionary Definitions (Left Side) */}
            {sourceDefinitionsList.length > 0 ? (
              <div className="mt-3 pt-3 border-t border-line/40 space-y-2 text-left" dir="ltr">
                <div className="flex items-center justify-between text-xs font-semibold text-muted">
                  <span className="flex items-center gap-1.5 text-ink font-bold">
                    <span>📖</span>
                    <span>Definitions</span>
                    <span className="text-[11px] font-normal text-muted opacity-80">(معاني الكلمة)</span>
                  </span>
                  {sourceDefinitionsList.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setShowAllDefinitions((prev) => !prev)}
                      className="text-[11px] font-semibold text-subtitle hover:underline cursor-pointer flex items-center gap-0.5"
                    >
                      {showAllDefinitions
                        ? "Show less (أقل) ↑"
                        : `+${sourceDefinitionsList.length - 2} more (المزيد) ↓`}
                    </button>
                  )}
                </div>

                <div className="space-y-1.5">
                  {(showAllDefinitions ? sourceDefinitionsList : sourceDefinitionsList.slice(0, 2)).map(
                    (def, dIdx) => {
                      const p = (def.partOfSpeech || "").toLowerCase();
                      const meta = POS_BADGES[p] || {
                        en: p,
                        ar: p,
                        badge: "bg-surface border-line text-muted",
                      };
                      return (
                        <div
                          key={`sdef-${dIdx}`}
                          className="text-xs text-ink/90 flex items-start gap-2 leading-relaxed bg-black/[0.02] dark:bg-white/[0.03] p-2 rounded-xl border border-line/30"
                        >
                          <span
                            className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold border shrink-0 mt-0.5 ${meta.badge}`}
                          >
                            {meta.en}
                          </span>
                          <span className="flex-1 select-text">{def.text}</span>
                        </div>
                      );
                    },
                  )}
                </div>
              </div>
            ) : null}

            {/* Google-style Spell Correction Banner */}
            {result?.correction ? (
              <div
                className={`mt-3 p-3 rounded-2xl bg-subtitle/10 border border-subtitle/30 text-xs sm:text-sm space-y-1.5 shadow-sm ${
                  isRTL ? "text-right" : "text-left"
                }`}
              >
                {result.correction.autoCorrected ? (
                  <>
                    <div className="flex items-center gap-1.5 flex-wrap text-ink font-medium">
                      <span className="text-subtitle font-bold text-base">✨</span>
                      <span>Showing translation for</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (debounceTimer.current) clearTimeout(debounceTimer.current);
                          if (result?.correction) {
                            setInputText(result.correction.correctedText);
                            void fetchTranslation(result.correction.correctedText, srcLang, targetLang);
                          }
                        }}
                        className="font-bold text-subtitle hover:underline italic cursor-pointer text-sm sm:text-base bg-subtitle/15 px-2 py-0.5 rounded-lg border border-subtitle/30"
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
                          if (debounceTimer.current) clearTimeout(debounceTimer.current);
                          if (result?.correction) {
                            void fetchTranslation(result.correction.originalText, srcLang, targetLang, true);
                          }
                        }}
                        className="text-subtitle hover:underline font-medium cursor-pointer underline-offset-2"
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
                  <div className="flex items-center gap-2 flex-wrap text-ink font-medium">
                    <span className="text-subtitle font-bold text-base">💡</span>
                    <span>Did you mean:</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (debounceTimer.current) clearTimeout(debounceTimer.current);
                        if (result?.correction) {
                          setInputText(result.correction.correctedText);
                          void fetchTranslation(result.correction.correctedText, srcLang, targetLang);
                        }
                      }}
                      className="font-bold text-subtitle hover:underline italic cursor-pointer text-sm sm:text-base bg-subtitle/20 hover:bg-subtitle/30 px-2.5 py-0.5 rounded-lg border border-subtitle/40 transition-colors"
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

            {/* Drag and Drop Active Overlay */}
            {isDraggingOver ? (
              <div className="absolute inset-0 z-20 rounded-2xl border-2 border-dashed border-subtitle bg-surface/95 backdrop-blur-xs flex flex-col items-center justify-center gap-2 pointer-events-none p-4 text-center">
                <ImageIcon size={36} className="text-subtitle animate-bounce" />
                <p className="text-sm font-bold text-ink">Drop image to translate</p>
                <p className="text-xs text-muted">إفلات الصورة لاستخراج النص والترجمة</p>
              </div>
            ) : null}

            {/* OCR Processing Banner */}
            {ocrLoading ? (
              <div className="mt-3 p-3 rounded-2xl bg-subtitle/10 border border-subtitle/30 flex items-center gap-2.5 text-xs sm:text-sm text-ink animate-pulse shadow-sm">
                <span className="h-4 w-4 rounded-full border-2 border-subtitle border-t-transparent animate-spin shrink-0" />
                <div className="flex-1">
                  <span className="font-semibold text-subtitle">Extracting text from image...</span>
                  <span className="text-muted text-xs ms-1.5">(جارِ استخراج النص والترجمة...)</span>
                </div>
              </div>
            ) : null}

            {/* OCR Error Banner */}
            {ocrError ? (
              <div className="mt-3 p-3 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-between gap-2 text-xs sm:text-sm text-red-400 shadow-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="shrink-0 text-base">⚠️</span>
                  <span className="truncate">{ocrError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setOcrError(null)}
                  className="p-1 text-red-400 hover:text-red-200 text-sm font-bold rounded-lg hover:bg-white/10"
                  aria-label="Dismiss error"
                >
                  ✕
                </button>
              </div>
            ) : null}

            {/* Voice Input Listening Pulse Banner */}
            {isListening ? (
              <div className="mt-3 p-3 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-between gap-2.5 text-xs sm:text-sm text-red-500 shadow-sm animate-pulse">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-red-500 animate-ping" />
                  <span className="font-bold">Listening... Speak now</span>
                  <span className="text-muted text-xs ms-1">(جاري الاستماع... تحدث الآن)</span>
                </div>
                <button
                  type="button"
                  onClick={toggleListening}
                  className="px-2 py-0.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 font-semibold text-xs text-red-500 transition-colors"
                >
                  Done / إنهاء
                </button>
              </div>
            ) : null}

            {/* Speech Recognition Error Banner */}
            {speechError ? (
              <div className="mt-3 p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2 text-xs text-amber-500 shadow-sm">
                <span className="truncate">🎙️ {speechError}</span>
                <button
                  type="button"
                  onClick={() => setSpeechError(null)}
                  className="p-1 hover:bg-white/10 rounded-md font-bold"
                  aria-label="Dismiss voice error"
                >
                  ✕
                </button>
              </div>
            ) : null}
          </div>

          {/* Bottom Toolbar for Source */}
          <div className="flex items-center justify-between pt-4 mt-2 border-t border-line/40 gap-2 flex-wrap">
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

              {/* Photo / Image Translation (OCR) Button */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    void handleImageFile(file);
                  }
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={ocrLoading}
                title="Translate image / photo (OCR)"
                aria-label="Translate image or photo"
                className="p-2 rounded-xl text-muted hover:text-ink hover:bg-white/10 disabled:opacity-50 transition-all flex items-center gap-1.5"
              >
                {ocrLoading ? (
                  <span className="h-4 w-4 rounded-full border-2 border-subtitle border-t-transparent animate-spin" />
                ) : (
                  <ImageIcon size={19} />
                )}
              </button>

              {/* Voice Input Microphone Button */}
              <button
                type="button"
                onClick={toggleListening}
                title={
                  isListening
                    ? "Stop listening (جاري الاستماع... اضغط للإيقاف)"
                    : "Voice input / Translate by speaking (إدخال صوتي)"
                }
                aria-label="Translate by voice"
                className={`p-2 rounded-xl transition-all flex items-center gap-1.5 relative ${
                  isListening
                    ? "bg-red-500/15 text-red-500 ring-2 ring-red-500/40 shadow-sm"
                    : "text-muted hover:text-ink hover:bg-white/10"
                }`}
              >
                <MicIcon size={19} className={isListening ? "animate-pulse text-red-500" : ""} />
                {isListening && (
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-ping absolute top-1 right-1" />
                )}
              </button>

              {/* Translation Provider Selector Dropdown */}
              <div className="h-4 w-px bg-line/60 mx-1 shrink-0" />
              <div className="relative inline-block" ref={providerMenuRef}>
                <button
                  type="button"
                  onClick={() => setProviderMenuOpen((prev) => !prev)}
                  title="Choose translation provider / dictionary"
                  className="h-7 px-2 sm:px-2.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-ink transition-all cursor-pointer border border-line/40 select-none"
                >
                  <span className="text-xs">
                    {provider === "udictionary" ? "📖 U-Dict" : "🌐 Google"}
                  </span>
                  <svg
                    className={`w-3 h-3 opacity-60 transition-transform duration-150 ${
                      providerMenuOpen ? "rotate-180" : ""
                    }`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {providerMenuOpen && (
                  <div
                    role="menu"
                    className="absolute bottom-full mb-1.5 start-0 z-50 min-w-[200px] max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-surface/95 p-1.5 shadow-2xl backdrop-blur-xl space-y-1"
                  >
                    <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted border-b border-line/40 mb-1">
                      Translation Provider
                    </div>
                    <button
                      type="button"
                      onClick={() => selectProvider("google")}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                        provider === "google"
                          ? "bg-subtitle/15 text-ink font-semibold"
                          : "text-muted hover:text-ink hover:bg-black/5 dark:hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span>🌐</span>
                        <span>Google Translate</span>
                      </div>
                      {provider === "google" && <span className="text-subtitle font-bold">✓</span>}
                    </button>
                    <button
                      type="button"
                      onClick={() => selectProvider("udictionary")}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                        provider === "udictionary"
                          ? "bg-subtitle/15 text-ink font-semibold"
                          : "text-muted hover:text-ink hover:bg-black/5 dark:hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span>📖</span>
                        <span>U-Dictionary (Oxford)</span>
                      </div>
                      {provider === "udictionary" && <span className="text-subtitle font-bold">✓</span>}
                    </button>
                  </div>
                )}
              </div>
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
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <div
                        dir="auto"
                        className="text-xl sm:text-2xl font-bold text-ink leading-relaxed select-all"
                      >
                        {baseTranslation}
                      </div>
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

                {/* Verb Conjugation Table (Past, Present, Past Participle) */}
                {activeVerbConjugation ? (
                  <div className="mt-3 pt-3 border-t border-line/50 space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted flex-wrap gap-1.5">
                      <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold flex-wrap min-w-0">
                        <span className="text-sm shrink-0">⏱️</span>
                        <span className="truncate">تصريفات الفعل ({activeVerbConjugation.base}):</span>
                        <span className="text-[10px] sm:text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 whitespace-nowrap shrink-0">
                          {activeVerbConjugation.tenseLabelAr}
                        </span>
                      </div>
                      <span className="text-[11px] font-normal text-muted/70 lowercase shrink-0">
                        اضغط على أي تصريف لترجمته
                      </span>
                    </div>

                    <div className="grid grid-cols-2 xl:grid-cols-5 gap-2">
                      {/* V1 Present */}
                      <button
                        type="button"
                        onClick={() => {
                          setInputText(activeVerbConjugation.base);
                          textareaRef.current?.focus();
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer min-w-0 overflow-hidden ${
                          activeVerbConjugation.currentTenses.includes("base")
                            ? "border-subtitle bg-subtitle/15 shadow-xs ring-1 ring-subtitle"
                            : "border-line bg-black/[0.02] dark:bg-white/[0.04] hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
                        }`}
                        title={`المصدر / المضارع البسيط (V1): ${activeVerbConjugation.base}`}
                      >
                        <div className="flex items-center justify-between gap-1 min-w-0">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted truncate">V1 · مضارع</span>
                          {activeVerbConjugation.currentTenses.includes("base") && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-subtitle text-black shrink-0">الحالي</span>
                          )}
                        </div>
                        <div className="text-xs sm:text-sm font-bold text-ink mt-0.5 truncate tracking-tight" title={activeVerbConjugation.base}>
                          {activeVerbConjugation.base}
                        </div>
                        <div className="text-[10px] text-muted truncate">المصدر / الحاضر</div>
                      </button>

                      {/* V2 Past Simple */}
                      <button
                        type="button"
                        onClick={() => {
                          setInputText(activeVerbConjugation.past);
                          textareaRef.current?.focus();
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer min-w-0 overflow-hidden ${
                          activeVerbConjugation.currentTenses.includes("past")
                            ? "border-subtitle bg-subtitle/15 shadow-xs ring-1 ring-subtitle"
                            : "border-line bg-black/[0.02] dark:bg-white/[0.04] hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
                        }`}
                        title={`الماضي البسيط (V2): ${activeVerbConjugation.past}`}
                      >
                        <div className="flex items-center justify-between gap-1 min-w-0">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted truncate">V2 · ماضي</span>
                          {activeVerbConjugation.currentTenses.includes("past") && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-subtitle text-black shrink-0">الحالي</span>
                          )}
                        </div>
                        <div className="text-xs sm:text-sm font-bold text-ink mt-0.5 truncate tracking-tight" title={activeVerbConjugation.past}>
                          {activeVerbConjugation.past}
                        </div>
                        <div className="text-[10px] text-muted truncate">الماضي البسيط</div>
                      </button>

                      {/* V3 Past Participle */}
                      <button
                        type="button"
                        onClick={() => {
                          setInputText(activeVerbConjugation.pastParticiple);
                          textareaRef.current?.focus();
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer min-w-0 overflow-hidden ${
                          activeVerbConjugation.currentTenses.includes("past_participle")
                            ? "border-subtitle bg-subtitle/15 shadow-xs ring-1 ring-subtitle"
                            : "border-line bg-black/[0.02] dark:bg-white/[0.04] hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
                        }`}
                        title={`التصريف الثالث (V3 - Past Participle): ${activeVerbConjugation.pastParticiple}`}
                      >
                        <div className="flex items-center justify-between gap-1 min-w-0">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted truncate">V3 · تصريف 3</span>
                          {activeVerbConjugation.currentTenses.includes("past_participle") && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-subtitle text-black shrink-0">الحالي</span>
                          )}
                        </div>
                        <div className="text-xs sm:text-sm font-bold text-ink mt-0.5 truncate tracking-tight" title={activeVerbConjugation.pastParticiple}>
                          {activeVerbConjugation.pastParticiple}
                        </div>
                        <div className="text-[10px] text-muted truncate">التصريف الثالث</div>
                      </button>

                      {/* V4 Continuous (-ing) */}
                      <button
                        type="button"
                        onClick={() => {
                          setInputText(activeVerbConjugation.presentParticiple);
                          textareaRef.current?.focus();
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer min-w-0 overflow-hidden ${
                          activeVerbConjugation.currentTenses.includes("present_participle")
                            ? "border-subtitle bg-subtitle/15 shadow-xs ring-1 ring-subtitle"
                            : "border-line bg-black/[0.02] dark:bg-white/[0.04] hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
                        }`}
                        title={`المضارع المستمر / اسم الفاعل (-ing): ${activeVerbConjugation.presentParticiple}`}
                      >
                        <div className="flex items-center justify-between gap-1 min-w-0">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted truncate">V4 · مستمر</span>
                          {activeVerbConjugation.currentTenses.includes("present_participle") && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-subtitle text-black shrink-0">الحالي</span>
                          )}
                        </div>
                        <div className="text-xs sm:text-sm font-bold text-ink mt-0.5 truncate tracking-tight" title={activeVerbConjugation.presentParticiple}>
                          {activeVerbConjugation.presentParticiple}
                        </div>
                        <div className="text-[10px] text-muted truncate">اسم الفاعل (-ing)</div>
                      </button>

                      {/* V5 3rd Person Singular */}
                      <button
                        type="button"
                        onClick={() => {
                          setInputText(activeVerbConjugation.thirdPerson);
                          textareaRef.current?.focus();
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer min-w-0 overflow-hidden col-span-2 xl:col-span-1 ${
                          activeVerbConjugation.currentTenses.includes("third_person")
                            ? "border-subtitle bg-subtitle/15 shadow-xs ring-1 ring-subtitle"
                            : "border-line bg-black/[0.02] dark:bg-white/[0.04] hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
                        }`}
                        title={`المضارع للمفرد الغائب (-s): ${activeVerbConjugation.thirdPerson}`}
                      >
                        <div className="flex items-center justify-between gap-1 min-w-0">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted truncate">V5 · مفرد</span>
                          {activeVerbConjugation.currentTenses.includes("third_person") && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-subtitle text-black shrink-0">الحالي</span>
                          )}
                        </div>
                        <div className="text-xs sm:text-sm font-bold text-ink mt-0.5 truncate tracking-tight" title={activeVerbConjugation.thirdPerson}>
                          {activeVerbConjugation.thirdPerson}
                        </div>
                        <div className="text-[10px] text-muted truncate">المضارع الغائب (-s)</div>
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* Alternative Translations in the Target Language (Right Side) */}
                {targetAlternativesList && targetAlternativesList.length > 0 ? (
                  <div className="mt-3 pt-3 border-t border-line/50 space-y-2">
                    <div className="text-xs font-semibold text-muted flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-ink font-bold">
                        <span>معاني بديلة / Alternatives</span>
                        <span className="text-[11px] font-normal text-muted/70">(اضغط لتغيير المعنى)</span>
                      </span>
                      {(() => {
                        const totalChips = targetAlternativesList.reduce(
                          (acc, curr) => acc + curr.meanings.length,
                          0,
                        );
                        return totalChips > 4 ? (
                          <button
                            type="button"
                            onClick={() => setShowAllAlternatives((prev) => !prev)}
                            className="text-[11px] font-semibold text-subtitle hover:underline cursor-pointer flex items-center gap-0.5"
                          >
                            {showAllAlternatives ? "Show less (أقل) ↑" : "More (المزيد) ↓"}
                          </button>
                        ) : null;
                      })()}
                    </div>
                    <div className="space-y-2">
                      {targetAlternativesList.map((def, idx) => {
                        const p = def.partOfSpeech.toLowerCase();
                        const meta = POS_BADGES[p] || {
                          en: p,
                          ar: p,
                          badge: "bg-black/5 dark:bg-white/10 text-muted border-line",
                        };
                        const displayedMeanings = showAllAlternatives
                          ? def.meanings
                          : def.meanings.slice(0, 4);

                        return (
                          <div
                            key={`alt-${idx}`}
                            className="flex flex-wrap items-baseline gap-2 text-xs sm:text-sm"
                          >
                            {p !== "alternatives" ? (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${meta.badge}`}
                              >
                                <span>{meta.en}</span>
                                {meta.ar ? (
                                  <span className="opacity-75 font-normal text-[10px]">
                                    ({meta.ar})
                                  </span>
                                ) : null}
                              </span>
                            ) : null}
                            <div className="flex flex-wrap items-center gap-1.5">
                              {displayedMeanings.map((m, mIdx) => {
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
                                    className={`max-w-full text-right leading-relaxed break-words px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
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
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {/* Authentic Example Sentences (from U-Dictionary) */}
                {result?.examples && result.examples.length > 0 ? (
                  <div className="mt-3 pt-3 border-t border-line/50 space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-ink font-semibold">
                        <span>📖</span>
                        <span>Examples / أمثلة القاموس:</span>
                      </span>
                      <span className="text-[10px] text-muted font-mono">U-Dictionary</span>
                    </span>
                    <div className="space-y-2">
                      {result.examples.map((ex, exIdx) => (
                        <div
                          key={`ex-${exIdx}`}
                          className="p-2.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.04] border border-line text-xs sm:text-sm text-ink leading-relaxed space-y-1"
                        >
                          <p className="font-serif italic text-muted-ink">
                            {renderHighlightedSentence(ex.sentence, inputText)}
                          </p>
                          {ex.source ? (
                            <span className="text-[10px] text-muted block text-end font-mono">
                              — {ex.source}
                            </span>
                          ) : null}
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
            <div className="flex items-center gap-1.5 flex-wrap">
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

              {result?.provider && (
                <span className="text-[10px] text-muted/70 font-mono ms-1 px-2 py-0.5 rounded-md bg-black/[0.03] dark:bg-white/[0.05]">
                  via {result.provider === "udictionary" ? "U-Dictionary" : "Google"}
                </span>
              )}
            </div>

            {/* Save to My Words Button or Auto-Save Status */}
            {result?.translation ? (
              <div className="flex items-center gap-2">
                {(settings.translateSaveMode || "manual") === "auto" ? (
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
                )}

                {/* If word was saved by accident, provide quick Delete button */}
                {matchedExistingWord ? (
                  <button
                    type="button"
                    onClick={handleDeleteWordFromTranslator}
                    disabled={isDeletingWord}
                    title="Delete this word from My Words (saved by accident)"
                    aria-label="Delete word from My Words"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-muted hover:text-bad hover:bg-bad/10 border border-line transition-colors cursor-pointer"
                  >
                    <TrashIcon size={14} />
                    <span>{isDeletingWord ? "Deleting..." : "Delete"}</span>
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

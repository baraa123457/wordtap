export type PracticeMode = "mixed" | "typing" | "choice" | "dictation";
export type ThemeMode = "light" | "dark" | "system";
export type VoiceGender = "female" | "male" | "auto";
export type VoiceTone = "soft" | "natural" | "deep" | "energetic";
export type TranslateSaveMode = "auto" | "manual" | "subtitles_only";
export type SelectionMode = "immediate" | "icon" | "alt" | "off";
export type TranslationProvider = "google" | "udictionary";

export type UserSettings = {
  theme: ThemeMode;
  autoAdvance: boolean;
  autoAdvanceDelayMs: number;
  sessionSize: number;
  practiceMode: PracticeMode;
  enableChoice: boolean;
  enableTyping: boolean;
  speechRate: number;
  voiceGender: VoiceGender;
  voiceTone: VoiceTone;
  voiceURI: string;
  targetLang: string;
  translateSaveMode: TranslateSaveMode;
  selectionMode?: SelectionMode;
  translationProvider?: TranslationProvider;
  customApiKey?: string;
  dailyNewWordsGoal?: number;
  dailyReviewsGoal?: number;
  dataSaverMode: boolean;
  whatsappReminderPhone?: string;
  reminderTime?: string;
};

export const DEFAULT_SETTINGS: UserSettings = {
  theme: "system",
  autoAdvance: true,
  autoAdvanceDelayMs: 800,
  sessionSize: 8,
  practiceMode: "mixed",
  enableChoice: true,
  enableTyping: true,
  speechRate: 0.92,
  voiceGender: "female",
  voiceTone: "soft",
  voiceURI: "",
  targetLang: "ar",
  translateSaveMode: "manual",
  selectionMode: "immediate",
  translationProvider: "google",
  customApiKey: "",
  dailyNewWordsGoal: 5,
  dailyReviewsGoal: 20,
  dataSaverMode: false,
  reminderTime: "20:00",
};

const STORAGE_KEY = "wordtap_settings";

export function getStoredSettings(): UserSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw || raw === "undefined" || raw === "null" || raw.trim() === "") return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return DEFAULT_SETTINGS;

    const validModes: PracticeMode[] = ["mixed", "typing", "choice", "dictation"];
    const validThemes: ThemeMode[] = ["light", "dark", "system"];
    const validGenders: VoiceGender[] = ["female", "male", "auto"];
    const validTones: VoiceTone[] = ["soft", "natural", "deep", "energetic"];
    const validSaveModes: TranslateSaveMode[] = ["auto", "manual", "subtitles_only"];

    const sessionSize =
      typeof parsed.sessionSize === "number" && parsed.sessionSize >= 3 && parsed.sessionSize <= 100
        ? Math.round(parsed.sessionSize)
        : DEFAULT_SETTINGS.sessionSize;

    const speechRate =
      typeof parsed.speechRate === "number" && parsed.speechRate >= 0.5 && parsed.speechRate <= 2.0
        ? parsed.speechRate
        : DEFAULT_SETTINGS.speechRate;

    const autoAdvanceDelayMs =
      typeof parsed.autoAdvanceDelayMs === "number" && parsed.autoAdvanceDelayMs >= 200 && parsed.autoAdvanceDelayMs <= 5000
        ? Math.round(parsed.autoAdvanceDelayMs)
        : DEFAULT_SETTINGS.autoAdvanceDelayMs;

    const practiceMode = validModes.includes(parsed.practiceMode)
      ? parsed.practiceMode
      : DEFAULT_SETTINGS.practiceMode;

    const theme = validThemes.includes(parsed.theme) ? parsed.theme : DEFAULT_SETTINGS.theme;
    const voiceGender = validGenders.includes(parsed.voiceGender) ? parsed.voiceGender : DEFAULT_SETTINGS.voiceGender;
    const voiceTone = validTones.includes(parsed.voiceTone) ? parsed.voiceTone : DEFAULT_SETTINGS.voiceTone;
    const translateSaveMode = validSaveModes.includes(parsed.translateSaveMode)
      ? parsed.translateSaveMode
      : DEFAULT_SETTINGS.translateSaveMode;

    const settings: UserSettings = {
      ...DEFAULT_SETTINGS,
      ...parsed,
      sessionSize,
      speechRate,
      autoAdvanceDelayMs,
      practiceMode,
      theme,
      voiceGender,
      voiceTone,
      translateSaveMode,
    };

    if (typeof parsed.enableChoice !== "boolean" || typeof parsed.enableTyping !== "boolean") {
      if (settings.practiceMode === "typing") {
        settings.enableTyping = true;
        settings.enableChoice = false;
      } else if (settings.practiceMode === "choice") {
        settings.enableChoice = true;
        settings.enableTyping = false;
      } else {
        settings.enableChoice = true;
        settings.enableTyping = true;
      }
    }
    return settings;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function applyTheme(theme: ThemeMode) {
  if (typeof window === "undefined") return;
  const isDark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  if (isDark) {
    document.documentElement.classList.add("dark");
    document.documentElement.classList.remove("light");
  } else {
    document.documentElement.classList.add("light");
    document.documentElement.classList.remove("dark");
  }
  document.documentElement.setAttribute("data-theme", theme);
  window.dispatchEvent(new CustomEvent("wordtap_theme_changed", { detail: theme }));
}

export function saveStoredSettings(partial: Partial<UserSettings>): UserSettings {
  const current = getStoredSettings();
  const next = { ...current, ...partial };
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    if (partial.theme !== undefined) {
      applyTheme(partial.theme);
    }
    window.dispatchEvent(new CustomEvent("wordtap_settings_changed", { detail: next }));
    window.postMessage({ type: "wordtap:sync-settings", settings: next }, "*");
  }
  return next;
}

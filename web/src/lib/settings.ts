export type PracticeMode = "mixed" | "typing" | "choice";
export type ThemeMode = "light" | "dark" | "system";
export type VoiceGender = "female" | "male" | "auto";
export type VoiceTone = "soft" | "natural" | "deep" | "energetic";
export type TranslateSaveMode = "auto" | "manual";

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
};

export const DEFAULT_SETTINGS: UserSettings = {
  theme: "system",
  autoAdvance: true,
  autoAdvanceDelayMs: 800,
  sessionSize: 8,
  practiceMode: "mixed",
  enableChoice: true,
  enableTyping: true,
  speechRate: 0.95,
  voiceGender: "female",
  voiceTone: "soft",
  voiceURI: "",
  targetLang: "ar",
  translateSaveMode: "manual",
};

const STORAGE_KEY = "wordtap_settings";

export function getStoredSettings(): UserSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw || raw === "undefined" || raw === "null" || raw.trim() === "") return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return DEFAULT_SETTINGS;
    const settings = { ...DEFAULT_SETTINGS, ...parsed };
    if (typeof parsed.enableChoice !== "boolean" || typeof parsed.enableTyping !== "boolean") {
      if (parsed.practiceMode === "typing") {
        settings.enableTyping = true;
        settings.enableChoice = false;
      } else if (parsed.practiceMode === "choice") {
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
  }
  return next;
}

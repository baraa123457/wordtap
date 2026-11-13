import { getStoredSettings, type VoiceGender, type VoiceTone } from "./settings";

export function canSpeak(): boolean {
  return typeof window !== "undefined";
}

const LANG_LOCALES: Record<string, string> = {
  de: "de-DE",
  en: "en-US",
  fr: "fr-FR",
  es: "es-ES",
  it: "it-IT",
  pt: "pt-PT",
  tr: "tr-TR",
  ru: "ru-RU",
  ar: "ar-SA",
  ja: "ja-JP",
  ko: "ko-KR",
  zh: "zh-CN",
};

export type SpeakOptions = {
  rate?: number;
  pitch?: number;
  gender?: VoiceGender;
  tone?: VoiceTone;
  voiceURI?: string;
};

const FEMALE_NAMES = [
  "female", "woman", "zira", "samantha", "katja", "victoria", "karen", "fiona", "tessa",
  "helena", "hedda", "amira", "salma", "stephanie", "susan", "linda", "joana", "anna", "petra",
  "leila", "meryem", "zeina", "fatima", "nour", "mariam", "monica", "elena", "lucia"
];

const MALE_NAMES = [
  "male", "man", "david", "george", "alex", "fred", "stefan", "daniel", "oliver", "tarik",
  "shakir", "mark", "richard", "thomas", "paul", "martin", "hans", "maged", "mehdi", "omar",
  "hassan", "ali", "khalid", "naayf", "pablo", "jorge", "alain"
];

export function detectVoiceGender(voice: SpeechSynthesisVoice): "female" | "male" | "unknown" {
  const name = (voice.name + " " + voice.voiceURI).toLowerCase();
  const isFemale = FEMALE_NAMES.some((k) => name.includes(k));
  const isMale = MALE_NAMES.some((k) => name.includes(k));
  if (isFemale && !isMale) return "female";
  if (isMale && !isFemale) return "male";
  return "unknown";
}

/**
 * Deterministically ranks and selects a consistent voice for a given language and gender,
 * ensuring the selected voice never changes randomly between page reloads or words.
 */
export function pickConsistentVoice(
  voices: SpeechSynthesisVoice[],
  prefix: string,
  gender: VoiceGender,
  voiceURI?: string
): SpeechSynthesisVoice | undefined {
  if (voiceURI) {
    const matched = voices.find((v) => v.voiceURI === voiceURI);
    if (matched) return matched;
  }

  // Filter voices matching the requested language prefix (e.g. "en")
  const langVoices = voices.filter((v) => {
    const l = (v.lang || "").toLowerCase();
    return l.startsWith(prefix) || l.replace("_", "-").startsWith(prefix);
  });

  if (langVoices.length === 0) return undefined;

  // Filter by requested gender if specified
  const genderMatched =
    gender !== "auto"
      ? langVoices.filter((v) => detectVoiceGender(v) === gender)
      : langVoices;

  const candidatePool = genderMatched.length > 0 ? genderMatched : langVoices;

  // Sort candidate voices deterministically:
  // 1. Natural / Online / High-quality voices first (e.g. Google, Natural, Microsoft Online)
  // 2. Stable alphabetical order by name so the choice never flips randomly
  return candidatePool.slice().sort((a, b) => {
    const aName = a.name.toLowerCase();
    const bName = b.name.toLowerCase();
    const aQuality =
      (aName.includes("natural") || aName.includes("online") || aName.includes("google") ? 2 : 0) +
      (!a.localService ? 1 : 0);
    const bQuality =
      (bName.includes("natural") || bName.includes("online") || bName.includes("google") ? 2 : 0) +
      (!b.localService ? 1 : 0);

    if (bQuality !== aQuality) return bQuality - aQuality;
    return a.name.localeCompare(b.name);
  })[0];
}

export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  return window.speechSynthesis.getVoices();
}

let activeAudio: HTMLAudioElement | null = null;

/** Plays high-quality remote audio via Google Translate TTS */
export function playRemoteTTS(text: string, lang: string): boolean {
  try {
    if (typeof window === "undefined") return false;

    if (activeAudio) {
      activeAudio.pause();
      activeAudio.currentTime = 0;
      activeAudio = null;
    }

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    const clean = text.trim().slice(0, 500);
    if (!clean) return false;

    const url = `/api/tts?text=${encodeURIComponent(clean)}&lang=${encodeURIComponent(lang)}`;
    const audio = new Audio(url);
    activeAudio = audio;

    audio.onended = () => {
      if (activeAudio === audio) activeAudio = null;
    };
    audio.onerror = () => {
      if (activeAudio === audio) activeAudio = null;
    };

    audio.play().catch(() => {});
    return true;
  } catch {
    return false;
  }
}

/** Reads text aloud with customizable voice, gender (man/woman), tone, or high-definition remote fallback. */
export function speak(text: string, lang: string, options?: SpeakOptions | number): void {
  if (typeof window === "undefined") return;

  const cleanText = text.trim();
  if (!cleanText) return;

  const hasArabic = /[\u0600-\u06FF]/.test(cleanText);
  const effectiveLang = lang && lang !== "auto" ? lang : hasArabic ? "ar" : "en";
  const prefix = effectiveLang.toLowerCase().slice(0, 2);

  // 1. If SpeechSynthesis is available and has an Arabic voice, use it so gender & pitch apply!
  // If no local voice exists for this language, fallback to remote TTS.
  if (!("speechSynthesis" in window)) {
    playRemoteTTS(cleanText, prefix);
    return;
  }

  const voices = window.speechSynthesis.getVoices();
  const langVoices = voices.filter((v) => {
    const l = (v.lang || "").toLowerCase();
    return l.startsWith(prefix) || l.replace("_", "-").startsWith(prefix);
  });

  // If the browser doesn't have a voice for this language (e.g. Arabic on older Windows without language pack),
  // fallback to remote Google TTS
  if (langVoices.length === 0) {
    playRemoteTTS(cleanText, prefix);
    return;
  }

  // 3. Otherwise, use SpeechSynthesis with user preferences
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio = null;
  }

  const userSettings = getStoredSettings();
  const opts: SpeakOptions =
    typeof options === "number"
      ? { rate: options }
      : {
          rate: userSettings.speechRate,
          gender: userSettings.voiceGender,
          tone: userSettings.voiceTone,
          voiceURI: userSettings.voiceURI,
          ...(options || {}),
        };

  const targetLocale = LANG_LOCALES[prefix] || (effectiveLang !== "auto" ? effectiveLang : "en-US");

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = targetLocale;

  let rate = opts.rate ?? 0.95;
  let pitch = opts.pitch ?? 1.0;

  // Tone adjustments
  const tone = opts.tone || "soft";
  if (tone === "soft") {
    rate = Math.max(0.75, rate * 0.92);
    pitch = pitch * 0.97;
  } else if (tone === "deep") {
    pitch = pitch * 0.82;
  } else if (tone === "energetic") {
    rate = rate * 1.08;
    pitch = pitch * 1.1;
  }

  // Gender adjustments
  const gender = opts.gender || "female";
  if (gender === "male") {
    pitch = Math.max(0.65, pitch * 0.88);
  } else if (gender === "female") {
    pitch = Math.min(1.35, pitch * 1.12);
  }

  utterance.rate = rate;
  utterance.pitch = pitch;

  const chosenVoice = pickConsistentVoice(voices, prefix, opts.gender || "female", opts.voiceURI);
  if (chosenVoice) {
    utterance.voice = chosenVoice;
  }

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

/** Immediately cancels all active audio and synthetic speech */
export function cancelSpeech(): void {
  if (typeof window === "undefined") return;
  if (activeAudio) {
    try {
      activeAudio.pause();
      activeAudio.currentTime = 0;
    } catch {
      // ignore audio stop error
    }
    activeAudio = null;
  }
  if ("speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore synthesis cancel error
    }
  }
}

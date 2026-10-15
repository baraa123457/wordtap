import { getStoredSettings, type VoiceGender, type VoiceTone } from "./settings";

export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
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
  "helena", "hedda", "amira", "salma", "stephanie", "susan", "linda", "joana", "anna", "petra"
];

const MALE_NAMES = [
  "male", "man", "david", "george", "alex", "fred", "stefan", "daniel", "oliver", "tarik",
  "shakir", "mark", "richard", "thomas", "paul", "martin", "hans"
];

export function detectVoiceGender(voice: SpeechSynthesisVoice): "female" | "male" | "unknown" {
  const name = (voice.name + " " + voice.voiceURI).toLowerCase();
  const isFemale = FEMALE_NAMES.some((k) => name.includes(k));
  const isMale = MALE_NAMES.some((k) => name.includes(k));
  if (isFemale && !isMale) return "female";
  if (isMale && !isFemale) return "male";
  return "unknown";
}

export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (!canSpeak()) return [];
  return window.speechSynthesis.getVoices();
}

/** Reads text aloud with customizable voice, gender (man/woman), and tone (soft, natural, deep). */
export function speak(text: string, lang: string, options?: SpeakOptions | number): void {
  if (!canSpeak()) return;

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

  const utterance = new SpeechSynthesisUtterance(text);
  const prefix = (lang && lang !== "auto" ? lang : "en").toLowerCase().slice(0, 2);
  const targetLocale = LANG_LOCALES[prefix] || (lang !== "auto" ? lang : "en-US");

  utterance.lang = targetLocale;

  let rate = opts.rate ?? 0.95;
  let pitch = opts.pitch ?? 1.0;

  // Apply tone characteristics
  const tone = opts.tone || "soft";
  if (tone === "soft") {
    // Soft & calm: slightly gentler pace, warmer pitch
    rate = Math.max(0.75, rate * 0.92);
    pitch = pitch * 0.97;
  } else if (tone === "deep") {
    pitch = pitch * 0.82;
  } else if (tone === "energetic") {
    rate = rate * 1.08;
    pitch = pitch * 1.1;
  }

  // Apply gender pitch adjustment if specific voice is not locking the pitch
  const gender = opts.gender || "female";
  if (gender === "male") {
    pitch = Math.max(0.65, pitch * 0.88);
  } else if (gender === "female") {
    pitch = Math.min(1.35, pitch * 1.12);
  }

  utterance.rate = rate;
  utterance.pitch = pitch;

  const voices = window.speechSynthesis.getVoices();
  const langVoices = voices.filter((v) => v.lang.toLowerCase().startsWith(prefix));

  let chosenVoice: SpeechSynthesisVoice | undefined;

  // 1. If explicit voiceURI selected
  if (opts.voiceURI) {
    chosenVoice = voices.find((v) => v.voiceURI === opts.voiceURI);
  }

  // 2. If gender is requested (female or male), try finding a voice matching that gender
  if (!chosenVoice && gender !== "auto") {
    chosenVoice = langVoices.find((v) => detectVoiceGender(v) === gender);
  }

  // 3. Fallback: cloud/remote voices generally sound smoother/softer, then first locale voice
  if (!chosenVoice) {
    chosenVoice =
      langVoices.find((v) => !v.localService) ||
      langVoices[0] ||
      voices.find((v) => !v.localService);
  }

  if (chosenVoice) utterance.voice = chosenVoice;

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

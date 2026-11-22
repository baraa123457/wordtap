/**
 * Spoken Language & Audio Verification Filter for Video Discovery
 *
 * Ensures that English vocabulary learners are ONLY served videos whose spoken audio
 * is genuine, audible English, preventing:
 * 1. Foreign-language videos with English translated subtitles (e.g. Chinese car reviews,
 *    German Wikipedia explainers, French documentaries).
 * 2. Non-speech media (silent showcase reels, b-roll montages, timelapses, music videos).
 */

import {
  ALLOWED_MEDIA_HOSTS,
  CHINESE_OR_ASIAN_MEDIA_RE,
  FOREIGN_TITLE_MARKERS_RE,
  FRENCH_TITLE_MARKERS_RE,
  GERMAN_TITLE_MARKERS_RE,
  NON_ENGLISH_CAPTION_OR_SUB_CAT_RE,
  NON_ENGLISH_CATEGORY_RE,
  NON_ENGLISH_ROMANCE_LETTERS_RE,
  NON_ENGLISH_SINGLE_WORD_MARKERS_RE,
  NON_LATIN_SCRIPT_RE,
  NON_SPEECH_MEDIA_RE,
  PORTUGUESE_TITLE_MARKERS_RE,
  SPANISH_TITLE_MARKERS_RE,
  VERIFIED_ENGLISH_COLLECTIONS_RE,
} from "./video-language-constants";

export {
  ALLOWED_MEDIA_HOSTS,
  MAX_VIDEO_FILE_SIZE_BYTES,
  NON_ENGLISH_CAPTION_OR_SUB_CAT_RE,
  NON_ENGLISH_CATEGORY_RE,
  NON_ENGLISH_ROMANCE_LETTERS_RE,
  NON_ENGLISH_SINGLE_WORD_MARKERS_RE,
  NON_LATIN_SCRIPT_RE,
  NON_SPEECH_MEDIA_RE,
  FOREIGN_TITLE_MARKERS_RE,
  GERMAN_TITLE_MARKERS_RE,
  FRENCH_TITLE_MARKERS_RE,
  SPANISH_TITLE_MARKERS_RE,
  PORTUGUESE_TITLE_MARKERS_RE,
  CHINESE_OR_ASIAN_MEDIA_RE,
  VERIFIED_ENGLISH_COLLECTIONS_RE,
} from "./video-language-constants";

/**
 * Validates that a video URL belongs strictly to whitelisted secure CDNs.
 */
export function isAllowedMediaUrl(rawUrl: string): boolean {
  if (!rawUrl || typeof rawUrl !== "string") return false;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:") return false;
    return ALLOWED_MEDIA_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Checks whether a video title or channel indicates a non-English language or non-speech media.
 */
export function isNonEnglishVideoTitle(title: string, channelName?: string): boolean {
  const combined = `${title || ""} ${channelName || ""}`.toLowerCase();

  // Reject non-speech media (silent showcase reels, b-roll, timelapses)
  if (NON_SPEECH_MEDIA_RE.test(combined)) {
    return true;
  }

  // Reject non-Latin characters (Chinese Hanzi, Cyrillic, Arabic, etc.)
  if (NON_LATIN_SCRIPT_RE.test(combined)) {
    return true;
  }

  // Reject foreign characters not part of native English vocabulary (ç, ã, õ, ñ, ¿, ¡)
  // E.g. "Governança", "Episódio", "Lição", "Español", "Não"
  if (NON_ENGLISH_ROMANCE_LETTERS_RE.test(combined)) {
    return true;
  }

  // Reject foreign production brands / keywords
  if (FOREIGN_TITLE_MARKERS_RE.test(combined) || CHINESE_OR_ASIAN_MEDIA_RE.test(combined)) {
    return true;
  }

  // High-confidence single-word markers for Portuguese / Spanish / foreign media
  if (NON_ENGLISH_SINGLE_WORD_MARKERS_RE.test(combined)) {
    return true;
  }

  const cleanTitle = title.replace(/^File:/i, "").replace(/\.(webm|mp4|ogv)$/i, "");

  // German checks
  const germanMatches = cleanTitle.match(GERMAN_TITLE_MARKERS_RE) || [];
  if (
    germanMatches.length >= 2 ||
    /\bmach\s+mit\b/i.test(cleanTitle) ||
    /\berklärvideo\b/i.test(cleanTitle)
  ) {
    return true;
  }

  // French checks
  const frenchMatches = cleanTitle.match(FRENCH_TITLE_MARKERS_RE) || [];
  if (frenchMatches.length >= 2) return true;

  // Spanish checks
  const spanishMatches = cleanTitle.match(SPANISH_TITLE_MARKERS_RE) || [];
  if (spanishMatches.length >= 2) return true;

  // Portuguese checks
  const portugueseMatches = cleanTitle.match(PORTUGUESE_TITLE_MARKERS_RE) || [];
  if (portugueseMatches.length >= 2) return true;

  return false;
}

/**
 * Checks Wikimedia Commons metadata (categories, descriptions, title) to verify whether
 * the spoken audio is non-English or lacks genuine spoken English speech.
 */
export function isNonEnglishVideoMetadata(params: {
  title: string;
  categories?: string;
  description?: string;
}): boolean {
  const { title, categories = "", description = "" } = params;

  // 1. Non-Latin characters in title, categories, or description
  if (
    NON_LATIN_SCRIPT_RE.test(title) ||
    NON_LATIN_SCRIPT_RE.test(categories) ||
    NON_LATIN_SCRIPT_RE.test(description)
  ) {
    return true;
  }

  // 2. Closed captions or subtitles in foreign language (e.g. "Videos with Chinese subtitles", "Files with closed captioning in German")
  if (categories && NON_ENGLISH_CAPTION_OR_SUB_CAT_RE.test(categories)) {
    return true;
  }

  // 3. Foreign classification categories or origins (e.g. "Automobiles in China", "Instructional videos on using Wikipedia in German")
  if (categories && NON_ENGLISH_CATEGORY_RE.test(categories)) {
    return true;
  }

  // 4. Foreign description templates or intro phrases
  if (description) {
    if (/^\s*\{\{(de|fr|es|it|ru|nl|pt|ar|pl|sv|uk|zh|ja|ko)\|/i.test(description)) {
      return true;
    }
    if (
      /\{\{(de|fr|es|it|ru|nl|pt|ar|zh|ja|ko)\|/i.test(description) &&
      !/\{\{en\|/i.test(description)
    ) {
      return true;
    }
    if (/\b(Dieses Video zeigt|Cette vidéo|Este vídeo|Questo video)\b/i.test(description)) {
      return true;
    }
  }

  // 5. Title words & non-speech media check
  if (isNonEnglishVideoTitle(title)) {
    return true;
  }

  return false;
}

/**
 * Recognizes verified official native spoken-English public collections (DVIDS, PBS, NASA, VOA, C-SPAN).
 * These receive a top ranking bonus to guarantee learners hear authentic, fluent English pronunciation.
 */
export function isVerifiedEnglishCollection(categories?: string, channelOrTitle?: string): boolean {
  const combined = `${categories || ""} ${channelOrTitle || ""}`.toLowerCase();
  return VERIFIED_ENGLISH_COLLECTIONS_RE.test(combined);
}

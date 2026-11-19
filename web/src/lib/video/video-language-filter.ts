/**
 * Spoken Language & Audio Verification Filter for Video Discovery
 *
 * Ensures that English vocabulary learners are ONLY served videos whose spoken audio
 * is genuine, audible English, preventing:
 * 1. Foreign-language videos with English translated subtitles (e.g. Chinese car reviews,
 *    German Wikipedia explainers, French documentaries).
 * 2. Non-speech media (silent showcase reels, b-roll montages, timelapses, music videos).
 */

// Any closed captions or subtitles in a language other than English
const NON_ENGLISH_CAPTION_OR_SUB_CAT_RE =
  /\b(Files with closed captioning in (?!English\b)[A-Za-z]+|Videos with (?!English\b)[A-Za-z]+ subtitles|Files with (?!English\b)[A-Za-z]+ subtitles)\b/i;

// Categories designating foreign video collections or languages
const NON_ENGLISH_CATEGORY_RE =
  /\b(Videos?\s+in\s+(?!English\b)[A-Za-z]+|(?!English\b)[A-Za-z]+-language\s+videos?|instructional\s+videos?\s+.*in\s+(?!English\b)[A-Za-z]+|vidéos?\s+en\s+français|vídeos?\s+en\s+español|video\s+in\s+deutsch|deutschsprachig|erklärvideo|kurzfilm|hörspiel|spielfilm|chinese television|chinese media|automobiles in china|leapmotor|autolab|media of china|videos (of|from|in) (china|germany|france|russia|japan|korea|spain|italy|brazil|ukraine|poland|iran|turkey|taiwan))\b/i;

// Non-Latin scripts (Hanzi/Kanji, Cyrillic, Arabic, Hangul, Kana, Thai, Hebrew)
const NON_LATIN_SCRIPT_RE =
  /[\u4e00-\u9fa5\u0400-\u04ff\u0600-\u06ff\u3040-\u30ff\uac00-\ud7af\u0e00-\u0e7f\u0590-\u05ff]/;

// Non-speech media title markers (silent showcase reels, B-roll, timelapses, sound effects only)
const NON_SPEECH_MEDIA_RE =
  /\b(showcase reel|\(reel\)|reel\b|b-roll|b roll|timelapse|time-lapse|silent film|silent animation|silent video|no sound|no audio|music only|soundtrack|ambient|drone footage|dashcam footage)\b/i;

// Foreign language and production brand markers in title/channel
const FOREIGN_TITLE_MARKERS_RE =
  /\b(mach\s+mit|erklärvideo|kurzfilm|hörspiel|spielfilm|autolab|leapmotor|the chinese car|chinese car|bilibili|weibo|youku|cgtn|cctv|xinhua|dw deutsch|zdf|ard|rt news|sputnik)\b/i;

const GERMAN_TITLE_MARKERS_RE =
  /\b(der|die|das|und|nicht|für|mit|ein|eine|eines|einer|einem|einen|aus|auf|nach|über|wie|wir|sie|ihr|uns|dass|deutsch|deutschland)\b/gi;

const FRENCH_TITLE_MARKERS_RE =
  /\b(dans|pour|avec|sur|les|des|une|cette|sont|nous|vous|leur|leurs|français|france|comment|pourquoi|vidéo)\b/gi;

const SPANISH_TITLE_MARKERS_RE =
  /\b(para|con|por|sobre|los|las|una|este|esta|estos|estas|español|méxico|españa|cómo|vídeo)\b/gi;

const CHINESE_OR_ASIAN_MEDIA_RE =
  /\b(chinese car|autolab|leapmotor|byd yuan|byd auto|nio firefly|xpeng|changan|dongfeng|bilibili)\b/i;

/**
 * Checks whether a video title or channel indicates a non-English language or non-speech media.
 */
export function isNonEnglishVideoTitle(title: string, channelName?: string): boolean {
  const combined = `${title || ""} ${channelName || ""}`.toLowerCase();

  // Reject non-speech media (silent showcase reels, b-roll, timelapses)
  if (NON_SPEECH_MEDIA_RE.test(combined)) {
    return true;
  }

  // Reject foreign production brands / keywords
  if (FOREIGN_TITLE_MARKERS_RE.test(combined) || CHINESE_OR_ASIAN_MEDIA_RE.test(combined)) {
    return true;
  }

  // Reject non-Latin characters (Chinese Hanzi, Cyrillic, Arabic, etc.)
  if (NON_LATIN_SCRIPT_RE.test(combined)) {
    return true;
  }

  const cleanTitle = title.replace(/^File:/i, "").replace(/\.(webm|mp4|ogv)$/i, "");
  const germanMatches = cleanTitle.match(GERMAN_TITLE_MARKERS_RE) || [];
  if (
    germanMatches.length >= 2 ||
    /\bmach\s+mit\b/i.test(cleanTitle) ||
    /\berklärvideo\b/i.test(cleanTitle)
  ) {
    return true;
  }
  const frenchMatches = cleanTitle.match(FRENCH_TITLE_MARKERS_RE) || [];
  if (frenchMatches.length >= 2) return true;
  const spanishMatches = cleanTitle.match(SPANISH_TITLE_MARKERS_RE) || [];
  if (spanishMatches.length >= 2) return true;
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
  return /\b(defense visual information distribution service|dvids|united states army|united states navy|united states air force|united states marine corps|united states coast guard|pd us army|pd us navy|pd us air force|lakeland pbs|pbs|voice of america|voa news|nasa videos|pd nasa|white house|c-span|wikimania.*in english|english wikipedia)\b/i.test(
    combined,
  );
}

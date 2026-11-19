/**
 * Language & Audio Verification Constants for Video Discovery
 *
 * Centralized patterns and rules to filter out:
 * 1. Foreign-language speech (German, Chinese, French, Spanish, Russian, Japanese, etc.)
 * 2. Non-speech media (silent showcase reels, B-rolls, timelapses, music videos)
 * 3. Oversized files and insecure video URLs
 */

/**
 * Hard size limit in bytes for direct HTML5 video playback.
 * Clips larger than 150MB are rejected to protect user data plans, mobile devices,
 * and eliminate long seek delays.
 */
export const MAX_VIDEO_FILE_SIZE_BYTES = 150_000_000; // 150 MB

/**
 * Whitelist of allowed secure hosts for playable video streams.
 * Prevents open-redirect or SSRF attacks from untrusted external URLs.
 */
export const ALLOWED_MEDIA_HOSTS = new Set([
  "upload.wikimedia.org",
  "commons.wikimedia.org",
  "www.youtube.com",
  "youtube.com",
  "youtu.be",
]);

/**
 * Closed caption or subtitle categories designating a non-English language.
 * E.g., "Files with closed captioning in German", "Videos with Chinese subtitles".
 */
export const NON_ENGLISH_CAPTION_OR_SUB_CAT_RE =
  /\b(Files with closed captioning in (?!English\b)[A-Za-z]+|Videos with (?!English\b)[A-Za-z]+ subtitles|Files with (?!English\b)[A-Za-z]+ subtitles)\b/i;

/**
 * Categories designating foreign video collections, origins, or foreign instructional media.
 */
export const NON_ENGLISH_CATEGORY_RE =
  /\b(Videos?\s+in\s+(?!English\b)[A-Za-z]+|(?!English\b)[A-Za-z]+-language\s+videos?|instructional\s+videos?\s+.*in\s+(?!English\b)[A-Za-z]+|vidéos?\s+en\s+français|vídeos?\s+en\s+español|video\s+in\s+deutsch|deutschsprachig|erklärvideo|kurzfilm|hörspiel|spielfilm|chinese television|chinese media|automobiles in china|leapmotor|autolab|media of china|videos (of|from|in) (china|germany|france|russia|japan|korea|spain|italy|brazil|ukraine|poland|iran|turkey|taiwan))\b/i;

/**
 * Unicode ranges for non-Latin writing systems:
 * Hanzi/Kanji (\u4e00-\u9fa5), Cyrillic (\u0400-\u04ff), Arabic (\u0600-\u06ff),
 * Japanese Hiragana/Katakana (\u3040-\u30ff), Korean Hangul (\uac00-\ud7af),
 * Thai (\u0e00-\u0e7f), Hebrew (\u0590-\u05ff).
 */
export const NON_LATIN_SCRIPT_RE =
  /[\u4e00-\u9fa5\u0400-\u04ff\u0600-\u06ff\u3040-\u30ff\uac00-\ud7af\u0e00-\u0e7f\u0590-\u05ff]/;

/**
 * Title markers indicating non-speech media (silent reels, B-rolls, timelapses, music-only).
 */
export const NON_SPEECH_MEDIA_RE =
  /\b(showcase reel|\(reel\)|reel\b|b-roll|b roll|timelapse|time-lapse|silent film|silent animation|silent video|no sound|no audio|music only|soundtrack|ambient|drone footage|dashcam footage)\b/i;

/**
 * Common foreign language production brands, networks, and media identifiers.
 */
export const FOREIGN_TITLE_MARKERS_RE =
  /\b(mach\s+mit|erklärvideo|kurzfilm|hörspiel|spielfilm|autolab|leapmotor|the chinese car|chinese car|bilibili|weibo|youku|cgtn|cctv|xinhua|dw deutsch|zdf|ard|rt news|sputnik)\b/i;

/**
 * High-frequency German stop words in video titles.
 */
export const GERMAN_TITLE_MARKERS_RE =
  /\b(der|die|das|und|nicht|für|mit|ein|eine|eines|einer|einem|einen|aus|auf|nach|über|wie|wir|sie|ihr|uns|dass|deutsch|deutschland)\b/gi;

/**
 * High-frequency French stop words in video titles.
 */
export const FRENCH_TITLE_MARKERS_RE =
  /\b(dans|pour|avec|sur|les|des|une|cette|sont|nous|vous|leur|leurs|français|france|comment|pourquoi|vidéo)\b/gi;

/**
 * High-frequency Spanish stop words in video titles.
 */
export const SPANISH_TITLE_MARKERS_RE =
  /\b(para|con|por|sobre|los|las|una|este|esta|estos|estas|español|méxico|españa|cómo|vídeo)\b/gi;

/**
 * Asian/Chinese automotive and media brands that often have English translated subtitles.
 */
export const CHINESE_OR_ASIAN_MEDIA_RE =
  /\b(chinese car|autolab|leapmotor|byd yuan|byd auto|nio firefly|xpeng|changan|dongfeng|bilibili)\b/i;

/**
 * Verified native spoken-English public collections (DVIDS, PBS, NASA, VOA, C-SPAN).
 * These receive priority ranking bonuses.
 */
export const VERIFIED_ENGLISH_COLLECTIONS_RE =
  /\b(defense visual information distribution service|dvids|united states army|united states navy|united states air force|united states marine corps|united states coast guard|pd us army|pd us navy|pd us air force|lakeland pbs|pbs|voice of america|voa news|nasa videos|pd nasa|white house|c-span|wikimania.*in english|english wikipedia)\b/i;

/**
 * Spoken Language Verification Filter for Video Discovery
 *
 * Ensures that English vocabulary learners are ONLY served videos whose spoken audio
 * is in English, preventing foreign-language videos with English translated subtitles
 * (e.g. German videos from Wikimedia Commons with English subtitles) from being shown.
 */

const NON_ENGLISH_CAPTION_CAT_RE =
  /Files with closed captioning in (?!English\b)[A-Za-z]+/i;

const NON_ENGLISH_CATEGORY_RE =
  /\b(Videos?\s+in\s+(?!English\b)[A-Za-z]+|(?!English\b)[A-Za-z]+-language\s+videos?|instructional\s+videos?\s+.*in\s+(?!English\b)[A-Za-z]+|erklärvideo|kurzfilm|hörspiel|spielfilm|vidéos?\s+en\s+français|vídeos?\s+en\s+español|video\s+in\s+deutsch|deutschsprachig)\b/i;

const GERMAN_TITLE_MARKERS_RE =
  /\b(mach\s+mit|erklärvideo|bei|der|die|das|und|nicht|für|mit|ein|eine|eines|einer|einem|einen|aus|auf|nach|über|wie|wir|sie|ihr|uns|dass|deutsch|deutschland|kurzfilm|hörspiel|spielfilm)\b/gi;
const FRENCH_TITLE_MARKERS_RE =
  /\b(dans|pour|avec|sur|les|des|une|cette|sont|nous|vous|leur|leurs|français|france|comment|pourquoi|vidéo)\b/gi;
const SPANISH_TITLE_MARKERS_RE =
  /\b(para|con|por|sobre|los|las|una|este|esta|estos|estas|español|méxico|españa|cómo|vídeo)\b/gi;

/**
 * Checks whether a video title or channel indicates a non-English language.
 */
export function isNonEnglishVideoTitle(title: string, channelName?: string): boolean {
  const combined = `${title || ""} ${channelName || ""}`.toLowerCase();
  if (/\b(mach\s+mit|erklärvideo|kurzfilm|hörspiel|spielfilm)\b/i.test(combined)) {
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
 * the spoken audio is non-English.
 */
export function isNonEnglishVideoMetadata(params: {
  title: string;
  categories?: string;
  description?: string;
}): boolean {
  const { title, categories, description } = params;

  // 1. Closed captions in foreign language (e.g. "Files with closed captioning in German")
  if (categories && NON_ENGLISH_CAPTION_CAT_RE.test(categories)) {
    return true;
  }

  // 2. Video classification categories (e.g. "Instructional videos on using Wikipedia in German", "Erklärvideo")
  if (categories && NON_ENGLISH_CATEGORY_RE.test(categories)) {
    return true;
  }

  // 3. Foreign description templates or intro phrases
  if (description) {
    if (/^\s*\{\{(de|fr|es|it|ru|nl|pt|ar|pl|sv|uk|zh|ja|ko)\|/i.test(description)) {
      return true;
    }
    if (
      /\{\{(de|fr|es|it|ru|nl|pt|ar)\|/i.test(description) &&
      !/\{\{en\|/i.test(description)
    ) {
      return true;
    }
    if (/\b(Dieses Video zeigt|Cette vidéo|Este vídeo|Questo video)\b/i.test(description)) {
      return true;
    }
  }

  // 4. Title words
  if (isNonEnglishVideoTitle(title)) {
    return true;
  }

  return false;
}

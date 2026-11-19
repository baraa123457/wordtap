import { NON_LATIN_SCRIPT_RE } from "./video-language-constants";

/**
 * Heuristic language detector for subtitle tracks (SRT/VTT).
 * Returns 'en', 'de', 'fr', 'es', 'zh', 'foreign', or null if ambiguous/empty.
 */
export function detectSubtitleLanguage(text: string): string | null {
  if (!text || typeof text !== "string") return null;

  const sample = text.slice(0, 5000);
  if (NON_LATIN_SCRIPT_RE.test(sample)) {
    // Contains Chinese, Japanese, Cyrillic, Arabic, etc.
    if (/[\u4e00-\u9fa5]/.test(sample)) return "zh";
    return "foreign";
  }

  const lower = sample.toLowerCase();
  const counts: Record<string, number> = { en: 0, de: 0, fr: 0, es: 0 };

  const vocab: Record<string, RegExp[]> = {
    en: [/\b(the|and|of|to|is|you|a|in|that|for|with|this|from|they|we|have|has|are|was)\b/gi],
    de: [/\b(der|die|das|und|nicht|mit|ein|eine|zu|ich|sie|ist|wir|fuer|für|auf|aus)\b/gi],
    fr: [/\b(le|la|les|et|pour|dans|une|un|est|de|qui|que|nous|vous|sont)\b/gi],
    es: [/\b(el|la|los|las|y|para|con|de|un|una|es|en|que|por|del|al)\b/gi],
  };

  for (const [lang, regexes] of Object.entries(vocab)) {
    for (const rg of regexes) {
      const m = lower.match(rg);
      if (m) counts[lang] += m.length;
    }
  }

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const [topLang, topCount] = sorted[0]!;
  const secondCount = sorted[1] ? sorted[1][1] : 0;

  if (topCount >= 2 && topCount > secondCount * 1.5) {
    return topLang;
  }

  return null;
}

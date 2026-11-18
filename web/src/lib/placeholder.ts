/**
 * Missing-word placeholder and answer validation utilities for Stage 2 Contextual Learning.
 *
 * STRICT PLACEHOLDER RULE:
 * Each dot ('.') represents EXACTLY ONE missing letter/character.
 *   CAT       -> ...       (3 dots)
 *   APPLE     -> .....     (5 dots)
 *   RELUCTANT -> ......... (9 dots)
 * Spaces or hyphens inside multi-word phrases are preserved so the learner sees word boundaries,
 * while every alphabetic character becomes exactly one dot.
 */

export type MaskedSentence = {
  before: string;
  hiddenWord: string;
  placeholder: string;
  after: string;
  position: number;
  letterCount: number;
};

/** Escapes special RegExp characters in a literal word. */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Generates an exact dot placeholder for a hidden word.
 * Every letter becomes one '.' (preserving internal spaces/hyphens for phrases).
 */
export function buildExactDotPlaceholder(word: string): string {
  const trimmed = word.trim();
  if (!trimmed) return "";
  return Array.from(trimmed)
    .map((ch) => (ch === " " || ch === "-" || ch === "'" ? ch : "."))
    .join("");
}

/**
 * Builds a regex that matches the target word (or common English inflections: s, es, ed, d, ing, er, est, ly)
 * as a whole word inside a sentence or transcript.
 */
export function buildTargetWordPattern(targetWord: string): RegExp {
  const clean = targetWord.trim();
  const escaped = escapeRegex(clean);
  if (clean.includes(" ")) {
    return new RegExp(`(?<![A-Za-z])${escaped}(?![A-Za-z])`, "i");
  }
  // Support base form and common regular inflections (e.g. reluctant/reluctantly, accept/accepted/accepting)
  const stem = clean.length >= 4 && clean.endsWith("e") ? escapeRegex(clean.slice(0, -1)) : null;
  const stemY = clean.length >= 4 && clean.endsWith("y") ? escapeRegex(clean.slice(0, -1)) : null;

  const variants = [
    `${escaped}(?:s|es|ed|d|ing|ly|er|est)?`,
    ...(stem ? [`${stem}(?:ed|ing|er|est)`] : []),
    ...(stemY ? [`${stemY}(?:ies|ied|ier|iest|ily)`] : []),
  ];

  return new RegExp(`(?<![A-Za-z])(?:${variants.join("|")})(?![A-Za-z])`, "i");
}

/**
 * Finds the target word in a real sentence and replaces it with exact character-count dots.
 * Returns null if the target word does NOT actually appear in the sentence (never fabricates a match!).
 */
export function maskWordInSentence(sentence: string, targetWord: string): MaskedSentence | null {
  const cleanSentence = sentence.replace(/\s+/g, " ").trim();
  const cleanTarget = targetWord.trim();
  if (!cleanSentence || !cleanTarget) return null;

  const pattern = buildTargetWordPattern(cleanTarget);
  const match = pattern.exec(cleanSentence);
  if (!match || match.index === undefined) return null;

  const hiddenWord = match[0];
  const position = match.index;
  const placeholder = buildExactDotPlaceholder(hiddenWord);
  const letterCount = Array.from(placeholder).filter((c) => c === ".").length;

  return {
    before: cleanSentence.slice(0, position),
    hiddenWord,
    placeholder,
    after: cleanSentence.slice(position + hiddenWord.length),
    position,
    letterCount,
  };
}

/**
 * Validates the user's typed answer for the missing-word exercise.
 * Accepts either the exact matched form from the sentence OR the canonical target word form.
 */
export function validateMissingWordAnswer(
  userInput: string,
  hiddenWord: string,
  canonicalWord: string,
): boolean {
  const normalize = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .replace(/^[.,!?;:"'()\[\]]+|[.,!?;:"'()\[\]]+$/g, "")
      .replace(/\s+/g, " ");

  const input = normalize(userInput);
  if (!input) return false;
  return input === normalize(hiddenWord) || input === normalize(canonicalWord);
}

/**
 * Generates a progressive hint after repeated failed attempts without immediately revealing the full word.
 *  - attempts < 2: no letters revealed (pure dots)
 *  - attempts === 2: first letter revealed (e.g. "r........")
 *  - attempts >= 3: first and last letters revealed (e.g. "r.......t")
 */
export function buildProgressiveHint(hiddenWord: string, failedAttempts: number): string | null {
  const chars = Array.from(hiddenWord.trim());
  if (chars.length <= 2 || failedAttempts < 2) return null;

  return chars
    .map((ch, idx) => {
      if (ch === " " || ch === "-" || ch === "'") return ch;
      if (idx === 0) return ch;
      if (failedAttempts >= 3 && idx === chars.length - 1) return ch;
      return ".";
    })
    .join("");
}

import {
  getPresentParticiple,
  getRegularPast,
  getThirdPersonSingular,
  getVerbConjugation,
} from "./verbs";

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
 * Builds a regex that matches the target word (or linguistically valid English inflections:
 * regular suffixes, doubled consonants like stop->stopped, irregular verbs via verbs.ts,
 * and common adjective/adverb forms like probable->probably, dramatic->dramatically)
 * strictly as a whole word — never matching unrelated substrings (e.g. "cat" inside "catch").
 */
export function buildTargetWordPattern(targetWord: string): RegExp {
  const clean = targetWord.trim();
  const escaped = escapeRegex(clean);
  if (clean.includes(" ")) {
    return new RegExp(`(?<![A-Za-z])${escaped}(?![A-Za-z])`, "i");
  }

  const lower = clean.toLowerCase();
  const variantSet = new Set<string>([escaped]);

  // Common regular suffixes
  variantSet.add(`${escaped}(?:s|es|ed|d|ing|ly|er|est)?`);

  // Silent-e stem (e.g. make -> making, negotiate -> negotiated/negotiating)
  if (lower.length >= 4 && lower.endsWith("e")) {
    const stem = escapeRegex(clean.slice(0, -1));
    variantSet.add(`${stem}(?:ed|ing|er|est)`);
    // -le -> -ly (e.g. probable -> probably, gentle -> gently)
    if (lower.endsWith("le") && lower.length >= 5) {
      variantSet.add(`${escapeRegex(clean.slice(0, -1))}y`);
    }
  }

  // Consonant + y -> ies / ied / ier / iest / ily
  if (lower.length >= 4 && lower.endsWith("y") && !/[aeiou]y$/.test(lower)) {
    const stemY = escapeRegex(clean.slice(0, -1));
    variantSet.add(`${stemY}(?:ies|ied|ier|iest|ily)`);
  }

  // -ic -> -ically (e.g. dramatic -> dramatically)
  if (lower.length >= 4 && lower.endsWith("ic")) {
    variantSet.add(`${escaped}ally`);
  }

  // Doubled final consonant for short CVC or stressed-final stems (stop -> stopped/stopping, prefer -> preferred)
  if (/^[a-z]{3,}[aeiou][bcdfgklmnprtvz]$/.test(lower)) {
    const doubled = escapeRegex(clean + clean.slice(-1));
    variantSet.add(`${doubled}(?:ed|ing|er|est)`);
  }

  // Irregular & regular verb conjugations from WordTap's own verbs.ts
  if (/^[a-z]{2,}$/.test(lower)) {
    const conj = getVerbConjugation(lower);
    if (conj) {
      for (const form of [
        conj.base,
        conj.past,
        conj.pastParticiple,
        conj.presentParticiple,
        conj.thirdPerson,
      ]) {
        if (form && form.length >= 2) {
          variantSet.add(escapeRegex(form));
        }
      }
    } else if (lower.length >= 3) {
      variantSet.add(escapeRegex(getRegularPast(lower)));
      variantSet.add(escapeRegex(getPresentParticiple(lower)));
      variantSet.add(escapeRegex(getThirdPersonSingular(lower)));
    }
  }

  // Sort longest patterns first so regex prefers full inflected match over shorter stem
  const sorted = Array.from(variantSet).sort((a, b) => b.length - a.length);
  return new RegExp(`(?<![A-Za-z])(?:${sorted.join("|")})(?![A-Za-z])`, "i");
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

export type ParsedYouGlishCaption = {
  plainSentence: string;
  masked: MaskedSentence | null;
  hasExplicitMarker: boolean;
};

/**
 * Safely decodes a raw caption string returned by YouGlish's official onCaptionChange(event) callback.
 * Handles URL-encoding (e.g. %20, +, %5B%5B%5B...%5D%5D%5D), HTML entities, and extra whitespace.
 */
export function decodeYouGlishCaptionText(rawCaption: string): string {
  let decoded = rawCaption;
  try {
    decoded = decodeURIComponent(rawCaption.replace(/\+/g, " "));
  } catch {
    decoded = rawCaption.replace(/\+/g, " ");
  }

  return decoded
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parses an official YouGlish onCaptionChange caption string where the target word is delimited
 * with triple square brackets: [[[target word]]].
 *
 * Example:
 *   "On now-[[[crowded]]] commuter trains, a frequent conversation topic..."
 *   -> hiddenWord: "crowded", placeholder: ".......", letterCount: 7
 *
 * Never fabricates a sentence or match. Returns masked: null if the target word is not present.
 */
export function parseYouGlishCaption(
  rawCaption: string,
  targetWord?: string,
): ParsedYouGlishCaption {
  const decoded = decodeYouGlishCaptionText(rawCaption);
  if (!decoded) {
    return { plainSentence: "", masked: null, hasExplicitMarker: false };
  }

  const markerMatch = /\[\[\[([\s\S]+?)\]\]\]/.exec(decoded);
  if (markerMatch && markerMatch.index !== undefined) {
    const rawMarked = markerMatch[1]!.trim();
    const before = decoded.slice(0, markerMatch.index).replace(/\[\[\[|\]\]\]/g, "");
    const after = decoded
      .slice(markerMatch.index + markerMatch[0].length)
      .replace(/\[\[\[|\]\]\]/g, "");
    const plainSentence = `${before}${rawMarked}${after}`.replace(/\s+/g, " ").trim();

    if (rawMarked) {
      const placeholder = buildExactDotPlaceholder(rawMarked);
      const letterCount = Array.from(placeholder).filter((c) => c === ".").length;
      if (letterCount > 0) {
        return {
          plainSentence,
          hasExplicitMarker: true,
          masked: {
            before,
            hiddenWord: rawMarked,
            placeholder,
            after,
            position: before.length,
            letterCount,
          },
        };
      }
    }
  }

  const plainSentence = decoded.replace(/\[\[\[|\]\]\]/g, "").replace(/\s+/g, " ").trim();
  const fallbackMasked = targetWord ? maskWordInSentence(plainSentence, targetWord) : null;
  return {
    plainSentence,
    masked: fallbackMasked,
    hasExplicitMarker: false,
  };
}

/**
 * Generates a progressive hint on the first failed attempt or Hint button click without spoiling the full word:
 *  - level <= 0: no letters revealed (pure dots)
 *  - level === 1: first letter revealed (e.g. "r........")
 *  - level === 2: first and last letters revealed (e.g. "r.......t")
 *  - level === 3: first 2 letters and last letter revealed (e.g. "re......t")
 *  - level >= 4: first ~half of letters and last letter revealed (e.g. "relu....t")
 */
export function buildProgressiveHint(hiddenWord: string, hintLevel: number): string | null {
  const chars = Array.from(hiddenWord.trim());
  if (chars.length <= 2 || hintLevel < 1) return null;

  const prefixCount =
    hintLevel === 1
      ? 1
      : hintLevel === 2
      ? 1
      : hintLevel === 3
      ? Math.min(2, chars.length - 2)
      : Math.min(Math.max(2, Math.ceil(chars.length / 2) - 1), chars.length - 2);
  const revealLast = hintLevel >= 2;

  return chars
    .map((ch, idx) => {
      if (ch === " " || ch === "-" || ch === "'") return ch;
      if (idx < prefixCount) return ch;
      if (revealLast && idx === chars.length - 1) return ch;
      return ".";
    })
    .join("");
}

export type LetterFault = {
  char: string;
  expectedChar: string | null;
  status: "correct" | "wrong" | "extra";
  index: number; // 0-based index
  position: number; // 1-based index (e.g. 1 for first letter)
  isFault: boolean;
};

export type AnswerFaultAnalysis = {
  hasFault: boolean;
  isCorrect: boolean;
  correctPrefix: string;
  firstWrongIndex: number;
  firstWrongChar: string | null;
  expectedChar: string | null;
  notInWord: boolean;
  lengthDiff: number;
  summary: string | null;
  letterFaults: LetterFault[];
  faultDescription: string | null;
  wrongLettersList: string[];
  nextExpectedChar: string | null;
  hintSuggestion: string;
};

/**
 * Compares the user's typed attempt against the target word to pinpoint exact faulty letters,
 * transpositions, or missing characters.
 */
export function analyzeAnswerFaults(
  rawInput: string,
  rawTarget: string,
): AnswerFaultAnalysis {
  const normalize = (s: string) =>
    (s || "")
      .trim()
      .toLowerCase()
      .replace(/^[.,!?;:"'()\[\]]+|[.,!?;:"'()\[\]]+$/g, "");

  const input = normalize(rawInput);
  const target = normalize(rawTarget);

  if (!input) {
    const firstChar = target.length > 0 ? target[0] : null;
    return {
      hasFault: false,
      isCorrect: false,
      correctPrefix: "",
      firstWrongIndex: -1,
      firstWrongChar: null,
      expectedChar: firstChar,
      notInWord: false,
      lengthDiff: -target.length,
      summary: null,
      letterFaults: [],
      faultDescription: null,
      wrongLettersList: [],
      nextExpectedChar: firstChar,
      hintSuggestion: firstChar
        ? `The word starts with "${firstChar}" (${target.length} letters).`
        : "",
    };
  }

  // Construct letter-by-letter breakdown
  let prefixLen = 0;
  while (
    prefixLen < input.length &&
    prefixLen < target.length &&
    input[prefixLen] === target[prefixLen]
  ) {
    prefixLen++;
  }

  const correctPrefix = input.slice(0, prefixLen);

  const letterFaults: LetterFault[] = Array.from(input).map((char, idx) => {
    if (idx < prefixLen) {
      return {
        char,
        expectedChar: target[idx] ?? null,
        status: "correct",
        index: idx,
        position: idx + 1,
        isFault: false,
      };
    }
    if (idx >= target.length) {
      return {
        char,
        expectedChar: null,
        status: "extra",
        index: idx,
        position: idx + 1,
        isFault: true,
      };
    }
    return {
      char,
      expectedChar: target[idx] ?? null,
      status: "wrong",
      index: idx,
      position: idx + 1,
      isFault: true,
    };
  });

  const wrongLettersList = letterFaults.filter((lf) => lf.isFault).map((lf) => lf.char);

  if (input === target) {
    return {
      hasFault: false,
      isCorrect: true,
      correctPrefix: target,
      firstWrongIndex: -1,
      firstWrongChar: null,
      expectedChar: null,
      notInWord: false,
      lengthDiff: 0,
      summary: null,
      letterFaults,
      faultDescription: null,
      wrongLettersList: [],
      nextExpectedChar: null,
      hintSuggestion: "Perfect match!",
    };
  }

  if (prefixLen < input.length) {
    const wrongChar = input[prefixLen]!;
    const expectedChar = prefixLen < target.length ? target[prefixLen]! : null;
    const notInWord = !target.includes(wrongChar);
    const posNum = prefixLen + 1;

    let summary = "";
    let faultDesc = "";
    if (notInWord) {
      summary = `Letter #${posNum} ("${wrongChar}") is incorrect — "${wrongChar}" is not in this word.`;
      faultDesc = `Letter #${posNum} ("${wrongChar}") is incorrect — "${wrongChar}" is not in this word.`;
    } else if (expectedChar) {
      summary = `Letter #${posNum} ("${wrongChar}") is incorrect — try "${expectedChar}".`;
      faultDesc = `Letter #${posNum} ("${wrongChar}") is incorrect — try "${expectedChar}".`;
    } else {
      summary = `Remove extra letters starting from letter #${posNum} ("${wrongChar}").`;
      faultDesc = `Remove extra letter "${wrongChar}" at position #${posNum}.`;
    }

    if (correctPrefix.length > 0) {
      summary += ` You have "${correctPrefix}" right so far.`;
    }

    if (input.length !== target.length) {
      summary += ` (${target.length} letters total).`;
    }

    const hintSuggestion = expectedChar
      ? `Letter #${posNum} ("${wrongChar}") is your fault letter — change it to "${expectedChar}".`
      : `Letter #${posNum} ("${wrongChar}") is an extra letter — remove it.`;

    return {
      hasFault: true,
      isCorrect: false,
      correctPrefix,
      firstWrongIndex: prefixLen,
      firstWrongChar: wrongChar,
      expectedChar,
      notInWord,
      lengthDiff: input.length - target.length,
      summary,
      letterFaults,
      faultDescription: faultDesc,
      wrongLettersList,
      nextExpectedChar: expectedChar,
      hintSuggestion,
    };
  }

  const remaining = target.length - input.length;
  const nextChar = target[input.length]!;
  const summary = `"${input}" is correct so far! You need ${remaining} more ${
    remaining === 1 ? "letter" : "letters"
  } (starts with "${input}${nextChar}…", ${target.length} letters total).`;

  const hintSuggestion = `"${input}" is correct so far! Next letter is "${nextChar}" (${input}${nextChar}…).`;

  return {
    hasFault: true,
    isCorrect: false,
    correctPrefix: input,
    firstWrongIndex: -1,
    firstWrongChar: null,
    expectedChar: nextChar || null,
    notInWord: false,
    lengthDiff: -remaining,
    summary,
    letterFaults,
    faultDescription: null,
    wrongLettersList: [],
    nextExpectedChar: nextChar || null,
    hintSuggestion,
  };
}


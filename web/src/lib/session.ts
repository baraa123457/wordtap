import type { Word } from "./schemas";
import { normalizeAnswer } from "./text";

export type Rng = () => number;

export type ChoiceVariant = "to-translation" | "to-word" | "listen";
export type TypeVariant = "to-translation" | "to-word";

export type ChoiceQuestion = {
  type: "choice";
  id: string;
  variant: ChoiceVariant;
  wordId: string;
  /** What the learner sees in the frame (empty for listening questions). */
  prompt: string;
  options: string[];
  answer: string;
  /** Text and language to read aloud, when the question is about sound. */
  speak: { text: string; lang: string } | null;
  /** Language of the option choices, so any choice can be spoken aloud */
  optionsLang?: string;
  context: string;
};

export type TypeQuestion = {
  type: "type";
  id: string;
  variant: TypeVariant;
  wordId: string;
  prompt: string;
  answer: string;
  context: string;
};

export type MatchPair = { wordId: string; word: string; translation: string; lang: string };

export type MatchQuestion = {
  type: "match";
  id: string;
  pairs: MatchPair[];
};

export type Question = ChoiceQuestion | TypeQuestion | MatchQuestion;

export type PracticeMode = "mixed" | "typing" | "choice";

export type BuildOptions = {
  /** Number of different words to practice in one session. */
  size?: number;
  /** Whether the browser can read words aloud. */
  canSpeak?: boolean;
  /** Practice mode: mixed (default), typing (write the words), or choice (multiple choice only). */
  mode?: PracticeMode;
  now?: Date;
  rng?: Rng;
};

export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = out[i] as T;
    out[i] = out[j] as T;
    out[j] = a;
  }
  return out;
}

/** Due words first (weakest box first), then the rest with weaker boxes ahead. */
export function selectWords(words: Word[], size: number, now: Date, rng: Rng): Word[] {
  const nowMs = now.getTime();
  const due: Word[] = [];
  const later: Word[] = [];
  for (const w of words) {
    (new Date(w.next_review).getTime() <= nowMs ? due : later).push(w);
  }
  const byBox = (a: Word, b: Word) => a.box - b.box;
  // Shuffle first so equal boxes come out in random order (Array.sort is stable).
  const ordered = [...shuffle(due, rng).sort(byBox), ...shuffle(later, rng).sort(byBox)];
  return ordered.slice(0, size);
}

const FALLBACK_ENGLISH_DISTRACTORS = [
  "important", "different", "possible", "between", "because", "without",
  "another", "together", "understand", "experience", "remember", "everything",
  "moment", "question", "consider", "probably", "continue", "decision"
];

const FALLBACK_ARABIC_DISTRACTORS = [
  "مهم", "مختلف", "ممكن", "بين", "بسبب", "بدون",
  "آخر", "معاً", "يفهم", "تجربة", "يتذكر", "كل شيء",
  "لحظة", "سؤال", "يعتبر", "ربما", "يستمر", "قرار"
];

function distractors(pool: string[], answer: string, count: number, rng: Rng, isArabic = false): string[] {
  const wanted = normalizeAnswer(answer);
  const seen = new Set<string>([wanted]);
  const unique: string[] = [];

  // Filter pool to valid candidates (skip empty or 1-character fragments like "ر" or "†")
  const cleanPool = pool.filter((c) => {
    const trimmed = (c || "").trim();
    return trimmed.length >= 2 && trimmed.toLowerCase() !== answer.toLowerCase();
  });

  for (const candidate of shuffle(cleanPool, rng)) {
    const key = normalizeAnswer(candidate);
    if (key === "" || seen.has(key)) continue;
    seen.add(key);
    unique.push(candidate);
    if (unique.length === count) break;
  }

  // If user has at least 2 words but fewer words saved than needed, fill remaining slots with clean common vocabulary
  if (pool.length > 1 && unique.length < count) {
    const fallbacks = isArabic ? FALLBACK_ARABIC_DISTRACTORS : FALLBACK_ENGLISH_DISTRACTORS;
    for (const fallback of shuffle(fallbacks, rng)) {
      const key = normalizeAnswer(fallback);
      if (key === "" || seen.has(key)) continue;
      seen.add(key);
      unique.push(fallback);
      if (unique.length === count) break;
    }
  }

  return unique;
}

type Plan = "choice-translation" | "choice-word" | "listen" | "type-translation" | "type-word";

/**
 * Pedagogical Spaced Repetition Progression (Leitner Box Ladder):
 * - Box 0 & 1 (New words): 100% Recognition (Multiple Choice). Never force typing a word on first sight!
 * - Box 2 & 3 (Learning words): Recognition & Audio Choice (75%) + Active recall Typing (25%).
 * - Box 4 & 5 (Mastered words): 100% Active Production Typing.
 */
function plansFor(word: Word, canSpeak: boolean): Plan[] {
  const listen = canSpeak && word.src_lang !== "auto" ? (["listen"] as const) : [];
  if (word.box <= 1) {
    return ["choice-word", "choice-word", "choice-translation", ...listen];
  }
  if (word.box <= 3) {
    return ["choice-word", "type-word", ...listen];
  }
  return ["type-word", "type-word", ...listen];
}

export function buildSession(words: Word[], options: BuildOptions = {}): Question[] {
  const rng = options.rng ?? Math.random;
  const size = options.size ?? 8;
  const now = options.now ?? new Date();
  const canSpeak = options.canSpeak ?? false;
  const mode = options.mode ?? "mixed";

  const picked = selectWords(words, size, now, rng);
  const translations = words.map((w) => w.translation);
  const texts = words.map((w) => w.text);
  const questions: Question[] = [];
  let n = 0;

  for (const word of picked) {
    const id = `q${n++}-${word.id}`;
    const context = word.source_title;

    // Writing Mode: Prompt shows translation (e.g. "كان") and user types the word (e.g. "was")
    if (mode === "typing") {
      questions.push({
        type: "type",
        id,
        variant: "to-word",
        wordId: word.id,
        prompt: word.translation,
        answer: word.text,
        context,
      });
      continue;
    }

    const choice = (variant: ChoiceVariant, answer: string, pool: string[]): ChoiceQuestion | null => {
      const isArabic = /[\u0600-\u06FF]/.test(answer);
      const wrong = distractors(pool, answer, 3, rng, isArabic);
      if (wrong.length === 0) return null;

      const isToWord = variant === "to-word";
      const prompt = isToWord ? word.translation : variant === "to-translation" ? word.text : "";

      // Pronounce the word that is actually shown in the prompt:
      // When the prompt is the translation (e.g. Arabic word), speak the translation in target_lang (or Arabic).
      // When the prompt is the source word (e.g. English word), speak the text in src_lang.
      const targetLang =
        word.target_lang && word.target_lang !== "auto"
          ? word.target_lang
          : /[\u0600-\u06FF]/.test(word.translation)
          ? "ar"
          : "en";
      const srcLang = word.src_lang && word.src_lang !== "auto" ? word.src_lang : "en";

      const speak = isToWord
        ? { text: word.translation, lang: targetLang }
        : variant === "listen" || word.src_lang !== "auto"
        ? { text: word.text, lang: srcLang }
        : null;

      const optionsLang = isToWord || variant === "listen" ? srcLang : targetLang;

      return {
        type: "choice",
        id,
        variant,
        wordId: word.id,
        prompt,
        options: shuffle([answer, ...wrong], rng),
        answer,
        speak,
        optionsLang,
        context,
      };
    };

    if (mode === "choice") {
      const plan = rng() > 0.5 ? "choice-word" : "choice-translation";
      const q = (plan === "choice-word" ? choice("to-word", word.text, texts) : choice("to-translation", word.translation, translations))
        || choice("to-translation", word.translation, translations)
        || choice("to-word", word.text, texts);
      if (q) {
        questions.push(q);
        continue;
      }
    }

    // Mixed mode: respect the Leitner box spaced repetition ladder!
    // Box 0 & 1: 100% Recognition choice. Box 2 & 3: Choice + Audio + 25% Typing. Box 4+: Production typing.
    const plans = plansFor(word, canSpeak);
    const plan = plans[Math.floor(rng() * plans.length)] ?? "choice-word";

    if (plan === "type-word") {
      questions.push({
        type: "type",
        id,
        variant: "to-word",
        wordId: word.id,
        prompt: word.translation,
        answer: word.text,
        context,
      });
      continue;
    } else if (plan === "type-translation") {
      questions.push({
        type: "type",
        id,
        variant: "to-translation",
        wordId: word.id,
        prompt: word.text,
        answer: word.translation,
        context,
      });
      continue;
    }

    let q: Question | null = null;
    if (plan === "choice-word") q = choice("to-word", word.text, texts);
    else if (plan === "choice-translation") q = choice("to-translation", word.translation, translations);
    else if (plan === "listen") q = choice("listen", word.text, texts);

    if (!q) {
      q = choice("to-word", word.text, texts) || choice("to-translation", word.translation, translations);
    }
    if (!q) {
      q = {
        type: "type",
        id,
        variant: "to-word",
        wordId: word.id,
        prompt: word.translation,
        answer: word.text,
        context,
      };
    }
    questions.push(q);
  }

  const shuffled = shuffle(questions, rng);

  if (mode !== "typing" && picked.length >= 3) {
    const pairs: MatchPair[] = picked.slice(0, 5).map((w) => ({
      wordId: w.id,
      word: w.text,
      translation: w.translation,
      lang: w.src_lang,
    }));
    shuffled.splice(Math.floor(shuffled.length / 2), 0, { type: "match", id: "match", pairs });
  }

  return shuffled;
}

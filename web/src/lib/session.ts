import type { Word } from "./schemas";
import { normalizeAnswer } from "./text";
import { parseSourceContext } from "./format";

export type Rng = () => number;

export type ChoiceVariant = "to-translation" | "to-word" | "listen" | "cloze";
export type TypeVariant = "to-translation" | "to-word" | "dictation";

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
  sentence?: string;
  sourceUrl?: string;
};

export type ScrambleQuestion = {
  type: "scramble";
  id: string;
  wordId: string;
  prompt: string;
  answer: string;
  tiles: { id: string; char: string }[];
  context: string;
  sentence?: string;
  sourceUrl?: string;
  speak?: { text: string; lang: string } | null;
};

export type TypeQuestion = {
  type: "type";
  id: string;
  variant: TypeVariant;
  wordId: string;
  prompt: string;
  answer: string;
  context: string;
  sentence?: string;
  sourceUrl?: string;
  speak?: { text: string; lang: string } | null;
};

export type MatchPair = { wordId: string; word: string; translation: string; lang: string };

export type MatchQuestion = {
  type: "match";
  id: string;
  pairs: MatchPair[];
};

export type Question = ChoiceQuestion | ScrambleQuestion | TypeQuestion | MatchQuestion;

export type PracticeMode = "mixed" | "typing" | "choice" | "dictation";

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

export function isPracticableWord(w: Word): boolean {
  const clean = (w.text || "").trim();
  const cleanTrans = (w.translation || "").trim();
  if (!clean || !cleanTrans) return false;
  // Skip single non-word characters (allow legitimate 1-letter words like 'a' or 'I')
  if (clean.length === 1 && !/^[aiAI]$/.test(clean)) return false;
  // Skip overly long scraped page blocks (e.g. YouTube banner / subscribe text > 60 chars or > 6 words)
  if (clean.length > 60 || cleanTrans.length > 80) return false;
  const wordCount = clean.split(/\s+/).length;
  if (wordCount > 6) return false;
  return true;
}

/** Due words first (weakest box first), then the rest with weaker boxes ahead. */
export function selectWords(words: Word[], size: number, now: Date, rng: Rng): Word[] {
  const valid = words.filter(isPracticableWord);
  const nowMs = now.getTime();
  const due: Word[] = [];
  const later: Word[] = [];
  for (const w of valid) {
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

export function makeClozePrompt(sentence: string, targetWord: string): string {
  const escaped = targetWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`\\b${escaped}\\b`, "i");
  if (regex.test(sentence)) {
    return sentence.replace(regex, "______");
  }
  const simpleRegex = new RegExp(escaped, "i");
  if (simpleRegex.test(sentence)) {
    return sentence.replace(simpleRegex, "______");
  }
  return `${sentence} (______)`;
}

export function makeScrambleTiles(text: string, rng: Rng = Math.random): { id: string; char: string }[] {
  const chars = text.trim().split("");
  const tiles = chars.map((char, index) => ({ id: `tile-${index}`, char }));
  const shuffled = shuffle(tiles, rng);
  if (shuffled.length > 1 && shuffled.map((t) => t.char).join("") === chars.join("")) {
    const temp = shuffled[0]!;
    shuffled[0] = shuffled[1]!;
    shuffled[1] = temp;
  }
  return shuffled;
}

type Plan = "choice-translation" | "choice-word" | "cloze" | "listen" | "scramble" | "type-word";

/**
 * Pedagogical Practice Ladder (Leitner Spaced Repetition Progression):
 * - New word (box 0–1): Multiple choice. Show real subtitle sentence with word highlighted -> pick translation.
 * - Learning (box 2): Listen and choose, or fill in the blank in the sentence (cloze).
 * - Almost known (box 3): Tap shuffled letters to build the word (scramble).
 * - Known (box 4–5): Type the word, with hint button and typo forgiveness.
 */
function plansFor(word: Word, canSpeak: boolean, canCloze: boolean): Plan[] {
  // Box 0 & 1: New words -> 100% Recognition choice (to-translation)
  if (word.box <= 1) {
    return ["choice-translation"];
  }

  // Box 2: Learning -> Fill in blank in sentence OR Listen & choose
  if (word.box === 2) {
    if (canCloze) {
      return canSpeak && word.src_lang !== "auto" ? ["cloze", "listen"] : ["cloze"];
    }
    return canSpeak && word.src_lang !== "auto" ? ["listen"] : ["choice-translation"];
  }

  // Box 3: Almost known -> Tap shuffled letters to build the word
  if (word.box === 3) {
    return ["scramble"];
  }

  // Box 4 & 5: Known -> Full active recall typing
  return ["type-word"];
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

  const buildQuestion = (word: Word, index: number): Question => {
    const id = `q${index}-${word.id}`;
    const context = word.source_title;
    const sourceUrl = word.source_url || undefined;
    const parsedContext = parseSourceContext(word.source_title);
    const sentence = (word.sentence && word.sentence.trim()) || parsedContext.sentence;
    const hasSentence = Boolean(sentence && sentence.trim());
    const targetEscaped = word.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const canCloze =
      hasSentence &&
      sentence !== undefined &&
      (new RegExp(`\\b${targetEscaped}\\b`, "i").test(sentence) ||
        sentence.toLowerCase().includes(word.text.toLowerCase()));

    // Dictation Mode: Hear the word and type it from sound
    if (mode === "dictation") {
      const srcLang = word.src_lang && word.src_lang !== "auto" ? word.src_lang : "en";
      return {
        type: "type",
        id,
        variant: "dictation",
        wordId: word.id,
        prompt: word.translation,
        answer: word.text,
        context,
        sentence,
        sourceUrl,
        speak: { text: word.text, lang: srcLang },
      };
    }

    // Writing Mode: Prompt shows translation (e.g. "كان") and user types the word (e.g. "was")
    if (mode === "typing") {
      const srcLang = word.src_lang && word.src_lang !== "auto" ? word.src_lang : "en";
      return {
        type: "type",
        id,
        variant: "to-word",
        wordId: word.id,
        prompt: word.translation,
        answer: word.text,
        context,
        sentence,
        sourceUrl,
        speak: { text: word.text, lang: srcLang },
      };
    }

    const choice = (
      variant: ChoiceVariant,
      answer: string,
      pool: string[],
      customPrompt?: string,
    ): ChoiceQuestion | null => {
      const isArabic = /[\u0600-\u06FF]/.test(answer);
      const wrong = distractors(pool, answer, 3, rng, isArabic);
      if (wrong.length === 0) return null;

      const isToWord = variant === "to-word" || variant === "cloze";
      const prompt =
        customPrompt ??
        (isToWord ? word.translation : variant === "to-translation" ? word.text : "");

      const srcLang = word.src_lang && word.src_lang !== "auto" ? word.src_lang : "en";
      const targetLang =
        word.target_lang && word.target_lang !== "auto"
          ? word.target_lang
          : /[\u0600-\u06FF]/.test(word.translation)
          ? "ar"
          : "en";

      // Always speak the English word:
      const speak = { text: word.text, lang: srcLang };
      const optionsLang = isToWord ? srcLang : targetLang;

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
        sentence,
        sourceUrl,
      };
    };

    if (mode === "choice") {
      const q =
        choice("to-translation", word.translation, translations) ||
        (canCloze && sentence
          ? choice("cloze", word.text, texts, makeClozePrompt(sentence, word.text))
          : null);
      if (q) return q;
    }

    // Mixed mode: follows the exact Pedagogical Ladder!
    const plans = plansFor(word, canSpeak, canCloze);
    const plan = plans[Math.floor(rng() * plans.length)] ?? "choice-translation";

    if (plan === "type-word") {
      const srcLang = word.src_lang && word.src_lang !== "auto" ? word.src_lang : "en";
      return {
        type: "type",
        id,
        variant: "to-word",
        wordId: word.id,
        prompt: word.translation,
        answer: word.text,
        context,
        sentence,
        sourceUrl,
        speak: { text: word.text, lang: srcLang },
      };
    }

    if (plan === "scramble" && word.text.trim().length > 1) {
      const srcLang = word.src_lang && word.src_lang !== "auto" ? word.src_lang : "en";
      return {
        type: "scramble",
        id,
        wordId: word.id,
        prompt: word.translation,
        answer: word.text,
        tiles: makeScrambleTiles(word.text, rng),
        context,
        sentence,
        sourceUrl,
        speak: { text: word.text, lang: srcLang },
      };
    }

    let q: Question | null = null;
    if (plan === "choice-translation") {
      q = choice("to-translation", word.translation, translations);
    } else if (plan === "cloze" && sentence) {
      q = choice("cloze", word.text, texts, makeClozePrompt(sentence, word.text));
    } else if (plan === "listen") {
      q = choice("listen", word.translation, translations);
    }

    if (!q) {
      q = choice("to-translation", word.translation, translations);
    }

    if (!q) {
      const srcLang = word.src_lang && word.src_lang !== "auto" ? word.src_lang : "en";
      q = {
        type: "type",
        id,
        variant: "to-word",
        wordId: word.id,
        prompt: word.translation,
        answer: word.text,
        context,
        sentence,
        sourceUrl,
        speak: { text: word.text, lang: srcLang },
      };
    }
    return q;
  };

  const firstBatch = picked.slice(0, Math.min(5, picked.length));
  const secondBatch = picked.slice(5);

  const firstQuestions = firstBatch.map((word, i) => buildQuestion(word, i));
  const secondQuestions = secondBatch.map((word, i) => buildQuestion(word, firstBatch.length + i));

  if (mode !== "typing" && mode !== "dictation" && firstBatch.length >= 3) {
    const matchQuestion: MatchQuestion = {
      type: "match",
      id: "match",
      pairs: firstBatch.map((w) => ({
        wordId: w.id,
        word: w.text,
        translation: w.translation,
        lang: w.src_lang,
      })),
    };

    return [
      ...shuffle(firstQuestions, rng),
      matchQuestion,
      ...shuffle(secondQuestions, rng),
    ];
  }

  return shuffle([...firstQuestions, ...secondQuestions], rng);
}

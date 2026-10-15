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

function distractors(pool: string[], answer: string, count: number, rng: Rng): string[] {
  const wanted = normalizeAnswer(answer);
  const seen = new Set<string>([wanted]);
  const unique: string[] = [];
  for (const candidate of shuffle(pool, rng)) {
    const key = normalizeAnswer(candidate);
    if (key === "" || seen.has(key)) continue;
    seen.add(key);
    unique.push(candidate);
    if (unique.length === count) break;
  }
  return unique;
}

type Plan = "choice-translation" | "choice-word" | "listen" | "type-translation" | "type-word";

function plansFor(word: Word, canSpeak: boolean): Plan[] {
  const listen = canSpeak && word.src_lang !== "auto" ? (["listen"] as const) : [];
  if (word.box <= 1) return ["choice-translation", "choice-translation", ...listen];
  if (word.box <= 3) return ["choice-word", "type-translation", ...listen];
  return ["type-word", "type-translation", ...listen];
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
      const wrong = distractors(pool, answer, 3, rng);
      if (wrong.length === 0) return null;
      return {
        type: "choice",
        id,
        variant,
        wordId: word.id,
        prompt: variant === "to-translation" ? word.text : variant === "to-word" ? word.translation : "",
        options: shuffle([answer, ...wrong], rng),
        answer,
        speak: variant === "listen" || word.src_lang !== "auto" ? { text: word.text, lang: word.src_lang } : null,
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

    // Both enabled (mixed mode): generate a balanced mix of typing and multiple choice!
    const preferTyping = rng() > 0.5;
    if (preferTyping) {
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
    } else {
      const plan = rng() > 0.5 ? "choice-word" : "choice-translation";
      const q = (plan === "choice-word" ? choice("to-word", word.text, texts) : choice("to-translation", word.translation, translations))
        || choice("to-translation", word.translation, translations)
        || choice("to-word", word.text, texts);
      if (q) {
        questions.push(q);
        continue;
      }
    }

    const plans = plansFor(word, canSpeak);
    const plan = plans[Math.floor(rng() * plans.length)] ?? "choice-translation";

    let question: Question | null = null;
    if (plan === "choice-translation") question = choice("to-translation", word.translation, translations);
    else if (plan === "choice-word") question = choice("to-word", word.text, texts);
    else if (plan === "listen") question = choice("listen", word.text, texts);

    if (!question) {
      const toWord = plan === "type-word" || plan === "choice-word";
      question = {
        type: "type",
        id,
        variant: toWord ? "to-word" : "to-translation",
        wordId: word.id,
        prompt: toWord ? word.translation : word.text,
        answer: toWord ? word.text : word.translation,
        context,
      };
    }
    questions.push(question);
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

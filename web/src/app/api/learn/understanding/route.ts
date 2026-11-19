import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders, guardApiRequest, handleCorsPreflight } from "@/lib/api-guard";
import { callAiJson } from "@/lib/ai-server";
import { getCachedWordExercise, saveWordExerciseToCache } from "@/lib/word-exercise-cache";

export async function OPTIONS(req: Request) {
  return handleCorsPreflight(req);
}

const requestSchema = z.object({
  word: z.string().trim().min(1).max(120),
  translation: z.string().trim().max(300).optional().default(""),
  targetLang: z.string().trim().max(20).optional().default("ar"),
  existingDefinition: z.string().trim().max(600).optional().default(""),
  partOfSpeech: z.string().trim().max(60).optional().default(""),
  level: z.enum(["beginner", "intermediate", "advanced"]).optional().default("intermediate"),
});

const aiResponseSchema = z.object({
  correctMeaning: z.string().min(4).max(240),
  distractors: z.array(z.string().min(4).max(240)).length(3),
  explanation: z.string().min(8).max(400),
  partOfSpeech: z.string().max(60).optional().default(""),
  pronunciation: z.string().max(100).optional().default(""),
  nativeMeanings: z.array(z.string().min(1).max(80)).optional().default([]),
});

type OptionId = "A" | "B" | "C" | "D";
const OPTION_IDS: OptionId[] = ["A", "B", "C", "D"];

// Authentic simple-English distractor definitions grouped by part of speech for dictionary fallback
const DISTRACTOR_POOL: Record<string, string[]> = {
  adjective: [
    "Excited and eager to start something right away",
    "Very confident about a decision or outcome",
    "Unable to understand a clear explanation",
    "Lasting for only a very brief period of time",
    "Calm and relaxed even under heavy pressure",
    "Carefully organized down to the smallest detail",
    "Happening unexpectedly without any prior warning",
    "Willing to share time or resources freely with others",
    "Easy to notice because of an unusual appearance",
    "Completely indifferent to what happens next",
    "Strictly following traditional rules and habits",
    "Capable of adapting quickly to new environments",
  ],
  verb: [
    "To postpone a planned event to a later date",
    "To examine something carefully in order to find errors",
    "To persuade someone to agree with a new idea",
    "To gradually reduce the size or strength of something",
    "To express strong admiration or approval publicly",
    "To combine separate parts into one unified whole",
    "To avoid giving a direct answer to a difficult question",
    "To recover quickly after facing a setback or difficulty",
    "To officially cancel an agreement or rule",
    "To repeat an action regularly until it becomes automatic",
  ],
  noun: [
    "A formal agreement made between two or more groups",
    "A sudden change in direction or public opinion",
    "A detailed plan created to achieve a long-term goal",
    "A strong feeling of curiosity about an unfamiliar topic",
    "An unexpected obstacle that slows down progress",
    "A reliable source of evidence used to prove a point",
    "A habit passed down through several generations",
    "A brief summary of the main ideas in a discussion",
    "A noticeable difference between two similar things",
    "A period of calm following a stressful situation",
  ],
  adverb: [
    "In a way that happens almost immediately without delay",
    "With great care and attention to avoid mistakes",
    "In a manner that is easy to notice or understand",
    "Only on rare occasions rather than regularly",
    "Without showing any strong emotion or reaction",
    "In a way that gradually increases over time",
    "Completely and without leaving any room for doubt",
    "In an informal and relaxed manner among friends",
  ],
};

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

function capitalizeSentence(s: string): string {
  const clean = s.trim().replace(/\.+$/, "");
  if (!clean) return "";
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

/** Strips accidental occurrences of the target word itself from a definition so the question isn't a giveaway. */
function sanitizeMeaning(meaning: string, word: string): string {
  const escaped = word.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!escaped) return capitalizeSentence(meaning);
  const cleaned = meaning.replace(new RegExp(`\\b${escaped}\\b`, "gi"), "this");
  return capitalizeSentence(cleaned);
}

async function fetchDictionaryEntry(word: string): Promise<{
  definition: string;
  partOfSpeech: string;
  pronunciation: string;
} | null> {
  // 1. Primary free dictionary: dictionaryapi.dev
  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.toLowerCase())}`,
      { signal: AbortSignal.timeout(3500) },
    );
    if (res.ok) {
      const data = (await res.json()) as Array<{
        phonetic?: string;
        phonetics?: Array<{ text?: string }>;
        meanings?: Array<{
          partOfSpeech?: string;
          definitions?: Array<{ definition?: string }>;
        }>;
      }>;
      const first = data?.[0];
      const pronunciation =
        first?.phonetic || first?.phonetics?.find((p) => p.text)?.text || "";
      for (const m of first?.meanings || []) {
        const def = m.definitions?.find((d) => d.definition && d.definition.length >= 8)?.definition;
        if (def) {
          return {
            definition: def.trim(),
            partOfSpeech: (m.partOfSpeech || "").toLowerCase(),
            pronunciation,
          };
        }
      }
    }
  } catch {
    // continue to secondary real dictionary
  }

  // 2. Secondary real dictionary: Google Dictionary (dt=md)
  try {
    const gUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=en&dt=md&dt=rm&q=${encodeURIComponent(word.trim())}`;
    const gRes = await fetch(gUrl, {
      signal: AbortSignal.timeout(4000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    if (gRes.ok) {
      const gData = (await gRes.json()) as unknown[];
      if (Array.isArray(gData?.[12])) {
        for (const group of gData[12]) {
          if (Array.isArray(group) && typeof group[0] === "string" && Array.isArray(group[1])) {
            const pos = group[0].toLowerCase();
            for (const item of group[1]) {
              if (Array.isArray(item) && typeof item[0] === "string" && item[0].trim().length >= 8) {
                return {
                  definition: item[0].trim(),
                  partOfSpeech: pos,
                  pronunciation: "",
                };
              }
            }
          }
        }
      }
    }
  } catch {
    // continue to tertiary dictionary
  }

  // 3. Tertiary real dictionary: Youdao / Collins English definitions
  try {
    const yRes = await fetch(
      `https://dict.youdao.com/jsonapi?q=${encodeURIComponent(word.trim())}`,
      {
        signal: AbortSignal.timeout(4000),
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      },
    );
    if (yRes.ok) {
      const yData = (await yRes.json()) as {
        simple?: { word?: Array<{ usphone?: string; ukphone?: string }> };
        ee?: {
          word?: {
            trs?: Array<{ pos?: string; tr?: Array<{ l?: { i?: string } }> }>;
          };
        };
      };
      const phone = yData.simple?.word?.[0]?.usphone || yData.simple?.word?.[0]?.ukphone || "";
      const trs = yData.ee?.word?.trs || [];
      for (const entry of trs) {
        const rawDef = entry.tr?.[0]?.l?.i;
        if (rawDef && typeof rawDef === "string" && rawDef.trim().length >= 8) {
          return {
            definition: rawDef.replace(/<[^>]+>/g, "").trim(),
            partOfSpeech: (entry.pos || "").replace(/\./g, "").toLowerCase(),
            pronunciation: phone ? `/${phone}/` : "",
          };
        }
      }
    }
  } catch {
    // ignore
  }

  return null;
}

async function fetchNativeMeanings(
  word: string,
  targetLang = "ar",
  primaryTranslation = "",
): Promise<string[]> {
  const list: string[] = [];
  if (primaryTranslation) {
    const parts = primaryTranslation.split(/[,/،;·•\n]+/).map((s) => s.trim()).filter(Boolean);
    for (const p of parts) {
      if (!list.includes(p)) list.push(p);
    }
  }

  try {
    const gUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${encodeURIComponent(
      targetLang,
    )}&dt=t&dt=bd&dt=rm&q=${encodeURIComponent(word.trim())}`;
    const res = await fetch(gUrl, {
      signal: AbortSignal.timeout(3500),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    if (res.ok) {
      const data = (await res.json()) as unknown[];
      const main = (data?.[0] as Array<Array<string>>)?.[0]?.[0];
      if (typeof main === "string" && main.trim() && !list.includes(main.trim())) {
        list.push(main.trim());
      }
      if (Array.isArray(data?.[1])) {
        for (const entry of data[1]) {
          if (Array.isArray(entry) && Array.isArray(entry[1])) {
            for (const m of entry[1]) {
              if (typeof m === "string" && m.trim() && !list.includes(m.trim())) {
                list.push(m.trim());
              }
            }
          }
        }
      }
    }
  } catch {
    // continue with whatever was extracted
  }

  return list.slice(0, 5);
}

function pickDistractors(
  pos: string,
  correctMeaning: string,
  targetWord: string,
): string[] {
  const key = pos in DISTRACTOR_POOL ? pos : "adjective";
  const primaryPool = DISTRACTOR_POOL[key] || DISTRACTOR_POOL.adjective!;
  const backupPool = Object.values(DISTRACTOR_POOL).flat();
  const correctLower = correctMeaning.toLowerCase();
  const targetLower = targetWord.toLowerCase();

  // Compute significant tokens from correct meaning so we avoid semantically overlapping distractors
  const stop = new Set(["the", "and", "for", "with", "that", "this", "from", "into", "something", "someone", "very", "more"]);
  const correctWords = new Set(
    correctLower
      .replace(/[^a-z\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !stop.has(w)),
  );

  const isSafeDistractor = (cand: string) => {
    const lc = cand.toLowerCase();
    if (lc === correctLower || lc.includes(targetLower)) return false;
    const candWords = lc.replace(/[^a-z\s]/g, "").split(/\s+/).filter((w) => w.length >= 4 && !stop.has(w));
    const overlap = candWords.filter((w) => correctWords.has(w)).length;
    return overlap < 2;
  };

  const chosen: string[] = [];
  for (const cand of shuffle(primaryPool)) {
    if (chosen.length >= 3) break;
    if (isSafeDistractor(cand)) chosen.push(cand);
  }
  for (const cand of shuffle(backupPool)) {
    if (chosen.length >= 3) break;
    if (!chosen.includes(cand) && isSafeDistractor(cand)) chosen.push(cand);
  }
  return chosen.slice(0, 3);
}

export async function POST(req: Request) {
  const blocked = guardApiRequest(req, "learn-understanding", 45);
  if (blocked) return blocked;
  const corsHeaders = getCorsHeaders(req);

  try {
    const raw = await req.json();
    const parsed = requestSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request parameters", details: parsed.error.flatten() },
        { status: 400, headers: corsHeaders },
      );
    }

    const { word, translation, targetLang = "ar", existingDefinition, partOfSpeech, level } = parsed.data;
    const displayWord = word.charAt(0).toUpperCase() + word.slice(1);
    const question = `What does "${displayWord}" mean?`;

    // 0. High-speed cache check (zero AI token cost, sub-25ms response)
    const cached = await getCachedWordExercise(word, targetLang);
    if (cached?.understanding) {
      return NextResponse.json(
        {
          ...cached.understanding,
          meanings: cached.meanings || cached.understanding.meanings,
          provider: "cache",
        },
        { headers: corsHeaders },
      );
    }

    // 1. Primary: AI-generated learner-level understanding question (if GEMINI_API_KEY or OPENAI_API_KEY is configured)
    const systemPrompt = `You are an expert English vocabulary teacher creating Stage 1 Understanding multiple-choice questions for an ${level}-level English learner.
Return ONLY valid JSON with these exact keys:
{
  "correctMeaning": "clear, simple English definition (6-16 words, do NOT include the target word itself)",
  "distractors": ["plausible wrong meaning 1", "plausible wrong meaning 2", "plausible wrong meaning 3"],
  "explanation": "1-2 friendly, simple sentences explaining what the word means and when native speakers use it.",
  "partOfSpeech": "noun|verb|adjective|adverb|phrase",
  "pronunciation": "IPA pronunciation like /rɪˈlʌktənt/ if known, else empty string",
  "nativeMeanings": ["primary translation", "common alternative 1", "common alternative 2"]
}
Rules:
- All 4 options must share the same grammatical style and similar length so the learner CANNOT guess by wording length or grammar cues.
- Distractors must be realistic, relevant meanings of other concepts—never silly, never obvious opposites only, never synonyms of the correct answer.
- Never include the target word or its stem in correctMeaning.
- nativeMeanings must contain 2 to 4 natural, accurate translations of "${word}" in the learner's native language (${targetLang}).`;

    const userPrompt = `Target English word: "${word}"${partOfSpeech ? `\nPart of speech hint: ${partOfSpeech}` : ""}${existingDefinition ? `\nReference definition: ${existingDefinition}` : ""}${translation ? `\nLearner's native translation hint (for disambiguating sense, language: ${targetLang}): ${translation}` : ""}`;

    const aiRes = await callAiJson<unknown>(systemPrompt, userPrompt);
    if (aiRes) {
      const checked = aiResponseSchema.safeParse(aiRes.data);
      if (checked.success) {
        const d = checked.data;
        const correctText = sanitizeMeaning(d.correctMeaning, word);
        const rawOptions = shuffle([
          { text: correctText, isCorrect: true },
          ...d.distractors.map((t) => ({ text: capitalizeSentence(t), isCorrect: false })),
        ]);
        const options = rawOptions.map((o, idx) => ({
          id: OPTION_IDS[idx]!,
          text: o.text,
        }));
        const correctIndex = rawOptions.findIndex((o) => o.isCorrect);
        const correctOptionId = OPTION_IDS[correctIndex]!;

        const fallbackDictMeanings = await fetchNativeMeanings(word, targetLang, translation);
        const resolvedMeanings = Array.from(
          new Set(
            [...(d.nativeMeanings || []), ...fallbackDictMeanings]
              .map((s) => s.trim())
              .filter(Boolean),
          ),
        ).slice(0, 5);

        const understandingPayload = {
          word,
          question,
          options,
          correctOptionId,
          explanation: d.explanation.trim(),
          definition: correctText,
          pronunciation: d.pronunciation || "",
          partOfSpeech: d.partOfSpeech || partOfSpeech || "",
          meanings: resolvedMeanings,
          provider: aiRes.provider,
        };

        void saveWordExerciseToCache({
          word,
          targetLang,
          understanding: understandingPayload,
          meanings: resolvedMeanings,
          definition: correctText,
          partOfSpeech: d.partOfSpeech || partOfSpeech || "",
        });

        return NextResponse.json(understandingPayload, { headers: corsHeaders });
      }
    }

    // 2. Legitimate Dictionary API fallback (Free Dictionary API + curated authentic POS distractors)
    const dict = await fetchDictionaryEntry(word);
    const resolvedDefinition = existingDefinition
      ? sanitizeMeaning(existingDefinition, word)
      : dict?.definition
      ? sanitizeMeaning(dict.definition, word)
      : translation
      ? `Meaning equivalent to "${translation}"`
      : null;

    if (!resolvedDefinition) {
      return NextResponse.json(
        {
          error: "Could not find a verified English definition for this word yet.",
        },
        { status: 404, headers: corsHeaders },
      );
    }

    const resolvedPos = (dict?.partOfSpeech || partOfSpeech || "adjective").toLowerCase();
    const resolvedPron = dict?.pronunciation || "";
    const distractors = pickDistractors(resolvedPos, resolvedDefinition, word);

    const rawOptions = shuffle([
      { text: resolvedDefinition, isCorrect: true },
      ...distractors.map((t) => ({ text: t, isCorrect: false })),
    ]);
    const options = rawOptions.map((o, idx) => ({
      id: OPTION_IDS[idx]!,
      text: o.text,
    }));
    const correctIndex = rawOptions.findIndex((o) => o.isCorrect);
    const correctOptionId = OPTION_IDS[correctIndex]!;

    const dictMeanings = await fetchNativeMeanings(word, targetLang, translation);

    const explanation = `"${displayWord}" (${resolvedPos || "word"}) means: ${resolvedDefinition.toLowerCase()}.${translation ? ` In your language: ${translation}.` : ""}`;

    const dictPayload = {
      word,
      question,
      options,
      correctOptionId,
      explanation,
      definition: resolvedDefinition,
      pronunciation: resolvedPron,
      partOfSpeech: resolvedPos,
      meanings: dictMeanings,
      provider: "dictionary" as const,
    };

    void saveWordExerciseToCache({
      word,
      targetLang,
      understanding: dictPayload,
      meanings: dictMeanings,
      definition: resolvedDefinition,
      partOfSpeech: resolvedPos,
    });

    return NextResponse.json(dictPayload, { headers: corsHeaders });
  } catch (err) {
    console.error("Understanding API error:", err);
    return NextResponse.json(
      { error: "Failed to prepare understanding exercise." },
      { status: 500, headers: corsHeaders },
    );
  }
}

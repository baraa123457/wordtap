import { getSupabase } from "./supabase";

export type CachedUnderstanding = {
  word: string;
  question: string;
  options: Array<{ id: "A" | "B" | "C" | "D"; text: string }>;
  correctOptionId: "A" | "B" | "C" | "D";
  explanation: string;
  definition: string;
  pronunciation: string;
  partOfSpeech: string;
  meanings?: string[];
  provider: "gemini" | "openai" | "dictionary" | "cache";
};

// High-speed in-memory LRU-style cache to avoid hitting Supabase for very frequent words
const MEMORY_CACHE = new Map<
  string,
  {
    data: {
      understanding?: CachedUnderstanding;
      examples?: string[];
      meanings?: string[];
    };
    cachedAt: number;
  }
>();

const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days in memory

function cacheKey(word: string, targetLang = "ar"): string {
  return `${word.toLowerCase().trim()}::${targetLang.toLowerCase().trim()}`;
}

/**
 * Retrieves cached educational exercises for a given word.
 * Checks in-memory cache first (<1ms), then Supabase database (<30ms).
 */
export async function getCachedWordExercise(
  word: string,
  targetLang = "ar",
): Promise<{
  understanding?: CachedUnderstanding;
  examples?: string[];
  meanings?: string[];
} | null> {
  const key = cacheKey(word, targetLang);
  const mem = MEMORY_CACHE.get(key);
  if (mem && Date.now() - mem.cachedAt < CACHE_TTL_MS) {
    return mem.data;
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("cached_word_exercises")
      .select("understanding_question,sentence_examples,meanings,hits_count")
      .eq("word", word.toLowerCase().trim())
      .eq("target_lang", targetLang.toLowerCase().trim())
      .maybeSingle();

    if (error || !data) return null;

    const understanding = data.understanding_question
      ? ({
          ...(data.understanding_question as CachedUnderstanding),
          provider: "cache" as const,
        } as CachedUnderstanding)
      : undefined;

    const examples = Array.isArray(data.sentence_examples)
      ? (data.sentence_examples as string[])
      : undefined;

    const meanings = Array.isArray(data.meanings) ? (data.meanings as string[]) : undefined;

    const res = { understanding, examples, meanings };

    // Update in-memory cache
    MEMORY_CACHE.set(key, { data: res, cachedAt: Date.now() });

    // Asynchronously increment hits_count in background
    void supabase
      .from("cached_word_exercises")
      .update({ hits_count: (data.hits_count || 1) + 1, updated_at: new Date().toISOString() })
      .eq("word", word.toLowerCase().trim())
      .eq("target_lang", targetLang.toLowerCase().trim());

    return res;
  } catch {
    return null;
  }
}

/**
 * Saves or updates a word exercise in cache for all future students.
 */
export async function saveWordExerciseToCache(params: {
  word: string;
  targetLang?: string;
  understanding?: CachedUnderstanding;
  examples?: string[];
  meanings?: string[];
  definition?: string;
  partOfSpeech?: string;
}): Promise<void> {
  const cleanWord = params.word.toLowerCase().trim();
  const targetLang = (params.targetLang || "ar").toLowerCase().trim();
  const key = cacheKey(cleanWord, targetLang);

  // Update memory immediately
  const existing = MEMORY_CACHE.get(key)?.data || {};
  const updatedData = {
    understanding: params.understanding || existing.understanding,
    examples: params.examples || existing.examples,
    meanings: params.meanings || existing.meanings,
  };
  MEMORY_CACHE.set(key, { data: updatedData, cachedAt: Date.now() });

  // Persist to Supabase
  try {
    const supabase = getSupabase();
    await supabase.from("cached_word_exercises").upsert(
      {
        word: cleanWord,
        target_lang: targetLang,
        understanding_question: updatedData.understanding || null,
        sentence_examples: updatedData.examples || [],
        meanings: updatedData.meanings || [],
        definition: params.definition || updatedData.understanding?.definition || "",
        part_of_speech: params.partOfSpeech || updatedData.understanding?.partOfSpeech || "",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "word,target_lang" },
    );
  } catch {
    // Best effort persistence
  }
}

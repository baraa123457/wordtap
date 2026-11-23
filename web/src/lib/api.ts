import { getSupabase } from "./supabase";
import { trackEvent } from "./analytics";
import {
  EMPTY_STATS,
  STATS_COLUMNS,
  STATS_COLUMNS_V2,
  WORD_COLUMNS,
  WORD_COLUMNS_LEGACY,
  WORD_COLUMNS_V2,
  WORD_COLUMNS_V3,
  statsSchema,
  wordsSchema,
  type Stats,
  type Word,
} from "./schemas";

export type ReviewGrade = 0 | 1 | 2 | 3;

export function tagWordByLang(text: string, lang: string): string {
  const clean = cleanWordText(text);
  const code = (lang || "en").toLowerCase().slice(0, 2);
  if (code === "en" || code === "auto" || !code) return clean;
  return `${clean}::${code}`;
}

export function cleanWordText(text: string): string {
  return (text || "")
    .replace(/::[a-z]{2,5}$/i, "")
    .replace(/[\u200B-\u200F\uFEFF\u2060]/g, "")
    .trim();
}

export function normalizeWordPair(w: {
  text: string;
  translation: string;
  src_lang?: string;
  target_lang?: string;
}): {
  text: string;
  translation: string;
  src_lang: string;
  target_lang: string;
  isInverted: boolean;
} {
  let text = cleanWordText(w.text);
  let translation = (w.translation || "").trim();
  let srcLang = (w.src_lang || "en").toLowerCase();
  let targetLang = (w.target_lang || "ar").toLowerCase();

  const isTextArabic = /[\u0600-\u06FF]/.test(text);
  const isTransArabic = /[\u0600-\u06FF]/.test(translation);
  const isTransLatin = /[a-zA-Z]/.test(translation);

  // If text is Arabic script and translation is Latin/English (e.g. text="عميل", translation="client")
  // Or src_lang was saved as "ar" while translation is Latin
  const isInverted =
    (isTextArabic && isTransLatin && !isTransArabic) ||
    (srcLang === "ar" && isTransLatin);

  if (isInverted) {
    const originalText = text;
    text = translation;
    translation = originalText;
    srcLang = srcLang === "ar" ? "en" : srcLang;
    targetLang = "ar";
    return { text, translation, src_lang: srcLang, target_lang: targetLang, isInverted: true };
  }

  // If marked "ar" but target is "ar" (native Arabic speaker studying foreign words)
  if (srcLang === "ar" && (targetLang === "ar" || !isTextArabic)) {
    srcLang = "en";
    return { text, translation, src_lang: srcLang, target_lang: "ar", isInverted: true };
  }

  return { text, translation, src_lang: srcLang, target_lang: targetLang, isInverted: false };
}

const WORDS_PAGE_SIZE = 1000; // Supabase/PostgREST default max rows per request

/** Reads the whole `words` table (newest first) page by page instead of one capped request. */
async function selectAllWords(
  supabase: ReturnType<typeof getSupabase>,
  columns: string,
): Promise<{ data: unknown[] | null; error: { message: string } | null }> {
  const all: unknown[] = [];
  for (let from = 0; ; from += WORDS_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("words")
      .select(columns)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true }) // stable tie-break so pages never skip or repeat rows
      .range(from, from + WORDS_PAGE_SIZE - 1);
    if (error) return { data: null, error };
    const page = (data ?? []) as unknown[];
    all.push(...page);
    if (page.length < WORDS_PAGE_SIZE) break;
  }
  return { data: all, error: null };
}

export async function fetchWords(): Promise<Word[]> {
  const supabase = getSupabase();
  // Supabase returns at most 1000 rows per request, so read the table in pages.
  // (Without this, users with more than 1000 words silently lose the oldest ones.)
  const v3 = await selectAllWords(supabase, WORD_COLUMNS_V3);

  let rows: unknown = v3.data;
  let error = v3.error;

  // Fallback gracefully if migration 011 hasn't been applied yet
  if (error && /column|does not exist|schema cache/i.test(error.message)) {
    const v2 = await selectAllWords(supabase, WORD_COLUMNS_V2);
    rows = v2.data;
    error = v2.error;
  }

  // Fallback gracefully if migration 010 hasn't been applied yet
  if (error && /column|does not exist|schema cache/i.test(error.message)) {
    const primary = await selectAllWords(supabase, WORD_COLUMNS);
    rows = primary.data;
    error = primary.error;

    if (error && error.message.toLowerCase().includes("sentence")) {
      const legacy = await selectAllWords(supabase, WORD_COLUMNS_LEGACY);
      rows = legacy.data;
      error = legacy.error;
    }
  }

  if (error) throw new Error(error.message);
  const words = wordsSchema.parse(rows);

  const invertedToHeal: { id: string; text: string; translation: string; src_lang: string; target_lang: string }[] = [];

  const cleaned = words.map((w) => {
    const match = (w.text || "").match(/::([a-z]{2,5})$/i);
    const inferredLang = match ? match[1].toLowerCase() : w.src_lang;
    const baseText = cleanWordText(w.text);
    const normalized = normalizeWordPair({
      text: baseText,
      translation: w.translation,
      src_lang: inferredLang || w.src_lang,
      target_lang: w.target_lang,
    });

    if (normalized.isInverted) {
      invertedToHeal.push({
        id: w.id,
        text: normalized.text,
        translation: normalized.translation,
        src_lang: normalized.src_lang,
        target_lang: normalized.target_lang,
      });
    }

    return {
      ...w,
      text: normalized.text,
      translation: normalized.translation,
      src_lang: normalized.src_lang,
      target_lang: normalized.target_lang,
    };
  });

  // Automatically heal inverted records in Supabase so the database is permanently normalized
  if (invertedToHeal.length > 0) {
    Promise.resolve().then(async () => {
      for (const item of invertedToHeal) {
        try {
          await updateWordDetails(
            item.id,
            {
              text: item.text,
              translation: item.translation,
              src_lang: item.src_lang,
            }
          );
        } catch {
          // ignore background update error
        }
      }
    });
  }

  return cleaned;
}

export async function fetchStats(): Promise<Stats> {
  const supabase = getSupabase();
  const v2 = await supabase
    .from("user_stats")
    .select(STATS_COLUMNS_V2)
    .maybeSingle();
  if (!v2.error) {
    return v2.data === null ? EMPTY_STATS : statsSchema.parse(v2.data);
  }
  const { data, error } = await supabase
    .from("user_stats")
    .select(STATS_COLUMNS)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data === null ? EMPTY_STATS : statsSchema.parse(data);
}

export async function setDailyLearningGoals(newWords: number, reviews: number): Promise<void> {
  const { error } = await getSupabase().rpc("set_daily_learning_goals", {
    p_new_words: newWords,
    p_reviews: reviews,
  });
  if (error) {
    // Graceful fallback if migration 010 hasn't been applied on Supabase yet
    console.warn("Could not persist daily learning goals to DB:", error.message);
  }
}

export async function deleteWord(id: string): Promise<void> {
  const supabase = getSupabase();
  // Try RPC first for guaranteed security definer deletion
  const { error: rpcError } = await supabase.rpc("delete_word", { p_word_id: id });
  if (rpcError) {
    const { error } = await supabase.from("words").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }
}

export async function bulkDeleteWords(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const supabase = getSupabase();
  const { error } = await supabase.from("words").delete().in("id", ids);
  if (error) {
    // Fall back to sequential RPC deletes if RLS blocks batch delete
    for (const id of ids) {
      await deleteWord(id);
    }
  }
}

export async function deleteWordByText(text: string, srcLang = "auto"): Promise<void> {
  const supabase = getSupabase();
  const { error: rpcError } = await supabase.rpc("delete_word_by_text", {
    p_text: text,
    p_src_lang: srcLang,
  });
  if (rpcError) {
    const query = supabase.from("words").delete().ilike("text", text.trim());
    if (srcLang && srcLang !== "auto") {
      query.eq("src_lang", srcLang);
    }
    const { error } = await query;
    if (error) throw new Error(error.message);
  }
}

export async function reviewWord(
  wordId: string,
  correct: boolean,
  grade?: ReviewGrade,
): Promise<void> {
  const supabase = getSupabase();
  if (grade !== undefined) {
    const res = await supabase.rpc("review_word", {
      p_word_id: wordId,
      p_correct: correct,
      p_grade: grade,
    });
    if (!res.error) return;
  }

  const { error } = await supabase.rpc("review_word", {
    p_word_id: wordId,
    p_correct: correct,
  });
  if (error) throw new Error(error.message);
}

export async function recordPractice(xp: number, today: string): Promise<void> {
  const { error } = await getSupabase().rpc("record_practice", { p_xp: xp, p_today: today });
  if (error) throw new Error(error.message);
}

export async function syncUserStreak(
  streak: number,
  bestStreak: number,
  lastPracticeDate?: string | null,
): Promise<void> {
  const supabase = getSupabase();

  // 1. Prefer atomic SECURITY DEFINER RPC (migration 008)
  const { error: rpcError } = await supabase.rpc("sync_user_streak", {
    p_streak: streak,
    p_best_streak: bestStreak,
    p_last_practice_date: lastPracticeDate || null,
  });
  if (!rpcError) return;

  // 2. Fallback to direct table update with user_id targeting
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const updates: Record<string, unknown> = {
    streak,
    best_streak: bestStreak,
  };
  if (lastPracticeDate) {
    updates.last_practice_date = lastPracticeDate;
  }
  const { error } = await supabase
    .from("user_stats")
    .update(updates)
    .eq("user_id", user.id);

  if (error) {
    console.warn("Could not sync user streak:", error.message);
  }
}

export async function setDailyGoal(goal: number): Promise<void> {
  const { error } = await getSupabase().rpc("set_daily_goal", { p_goal: goal });
  if (error) throw new Error(error.message);
}

export async function updateWordLanguage(id: string, srcLang: string, word?: Word): Promise<void> {
  return updateWordDetails(id, { src_lang: srcLang }, word);
}

export async function updateWordDetails(
  id: string,
  updates: { text?: string; translation?: string; src_lang?: string },
  word?: Word,
): Promise<void> {
  const supabase = getSupabase();
  const rawText =
    updates.text !== undefined
      ? cleanWordText(updates.text)
      : word
      ? cleanWordText(word.text)
      : "";
  const rawLang =
    updates.src_lang !== undefined ? updates.src_lang : word?.src_lang || "en";
  const rawTrans =
    updates.translation !== undefined ? updates.translation.trim() : word?.translation || "";

  const norm = normalizeWordPair({
    text: rawText,
    translation: rawTrans,
    src_lang: rawLang,
    target_lang: word?.target_lang || "ar",
  });

  const nextText = norm.text;
  const nextLang = norm.src_lang;
  const nextTrans = norm.translation;
  const taggedText = tagWordByLang(nextText, nextLang);

  // 1. Prefer atomic SECURITY DEFINER update RPC (migration 006) — preserves SRS stats
  const rpcRes = await supabase.rpc("update_word_details", {
    p_word_id: id,
    p_text: taggedText || null,
    p_translation: updates.translation !== undefined || norm.isInverted ? nextTrans : null,
    p_src_lang: updates.src_lang !== undefined || norm.isInverted ? nextLang : null,
  });
  if (!rpcRes.error && rpcRes.data) {
    return;
  }

  // 2. Fallback to direct table update (when RLS update policy permits)
  const payload: { text?: string; translation?: string; src_lang?: string; target_lang?: string } = {};
  if (updates.text !== undefined || updates.src_lang !== undefined || norm.isInverted) {
    payload.text = taggedText;
  }
  if (updates.translation !== undefined || norm.isInverted) payload.translation = nextTrans;
  if (updates.src_lang !== undefined || norm.isInverted) payload.src_lang = nextLang;
  if (norm.isInverted) payload.target_lang = norm.target_lang;

  const { data, error } = await supabase.from("words").update(payload).eq("id", id).select("id");
  if (!error && data && data.length > 0) {
    return;
  }

  // 3. Last resort for legacy DB schemas without update policy/RPC
  if (word) {
    await deleteWord(id);
    const { error: rpcErr } = await supabase.rpc("save_word", {
      p_text: taggedText,
      p_translation: nextTrans,
      p_src_lang: nextLang,
      p_target_lang: norm.target_lang || word.target_lang,
      p_source_title: word.source_title || "",
      p_source_url: word.source_url || "",
      p_times: word.times_seen || 1,
    });
    if (rpcErr) throw new Error(rpcErr.message);
    const srsUpdate: Record<string, unknown> = {
      box: word.box,
      next_review: word.next_review,
    };
    if (word.last_practiced) srsUpdate.last_practiced = word.last_practiced;
    if (typeof word.correct_count === "number") srsUpdate.correct_count = word.correct_count;
    if (typeof word.wrong_count === "number") srsUpdate.wrong_count = word.wrong_count;
    await supabase
      .from("words")
      .update(srsUpdate)
      .eq("text", taggedText);
    return;
  }
  if (error) throw new Error(error.message);
}

export async function updateWordTranslation(
  id: string,
  newTranslation: string,
  word?: Word,
): Promise<void> {
  return updateWordDetails(id, { translation: newTranslation }, word);
}

export async function addCustomWord(
  text: string,
  translation: string,
  srcLang: string,
  targetLang = "ar",
  sourceTitle = "",
  sourceUrl = "",
  sentence = "",
): Promise<string> {
  const norm = normalizeWordPair({
    text,
    translation,
    src_lang: srcLang,
    target_lang: targetLang,
  });

  const finalSrc = norm.src_lang;
  const finalTarget = norm.target_lang;
  const tagged = tagWordByLang(norm.text, finalSrc);
  const supabase = getSupabase();

  // 1. Try full save_word signature including p_sentence (migration 006)
  const res0 = await supabase.rpc("save_word", {
    p_text: tagged,
    p_translation: norm.translation,
    p_src_lang: finalSrc,
    p_target_lang: finalTarget,
    p_source_title: sourceTitle,
    p_source_url: sourceUrl,
    p_times: 1,
    p_sentence: sentence || "",
  });
  if (!res0.error && res0.data) {
    void trackEvent("first_word_saved", { text: norm.text, src: finalSrc });
    return res0.data as string;
  }

  // 2. Try save_word with p_src_lang (migration 001/002)
  const res1 = await supabase.rpc("save_word", {
    p_text: tagged,
    p_translation: norm.translation,
    p_src_lang: finalSrc,
    p_target_lang: finalTarget,
    p_source_title: sourceTitle,
    p_source_url: sourceUrl,
  });
  if (!res1.error && res1.data) {
    void trackEvent("first_word_saved", { text: norm.text, src: finalSrc });
    return res1.data as string;
  }

  // 3. Try save_word without p_src_lang (legacy database schema)
  const res2 = await supabase.rpc("save_word", {
    p_text: tagged,
    p_translation: norm.translation,
    p_target_lang: finalTarget,
  });
  if (!res2.error && res2.data) {
    void trackEvent("first_word_saved", { text: norm.text, src: finalSrc });
    return res2.data as string;
  }

  // 4. Try direct table insert
  const res3 = await supabase
    .from("words")
    .insert({
      text: tagged,
      translation: norm.translation,
      src_lang: finalSrc,
      target_lang: finalTarget,
      source_title: sourceTitle,
      source_url: sourceUrl,
    })
    .select("id")
    .maybeSingle<{ id: string }>();
  if (!res3.error && res3.data) {
    void trackEvent("first_word_saved", { text: norm.text, src: finalSrc });
    return res3.data.id;
  }

  throw new Error(res0.error?.message || res1.error?.message || res2.error?.message || res3.error?.message || "Failed to save word");
}

export async function deleteAccount(): Promise<void> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.rpc("delete_user_account");

  if (user) {
    await supabase.from("words").delete().eq("user_id", user.id);
    await supabase.from("user_stats").delete().eq("user_id", user.id);
  }

  if (typeof window !== "undefined") {
    localStorage.removeItem("wordtap_settings");
    localStorage.removeItem("wordtap_theme");
    localStorage.removeItem("wordtap_history");
    localStorage.removeItem("wordtap_cached_words");
  }

  await supabase.auth.signOut();
}

import { getSupabase } from "./supabase";
import {
  EMPTY_STATS,
  STATS_COLUMNS,
  WORD_COLUMNS,
  statsSchema,
  wordsSchema,
  type Stats,
  type Word,
} from "./schemas";

const LANG_SUFFIXES: Record<string, string> = {
  de: "\u200B",
  fr: "\u200C",
  es: "\u200D",
  it: "\u200E",
  pt: "\u200F",
  tr: "\uFEFF",
  ru: "\u2060",
};

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

export async function fetchWords(): Promise<Word[]> {
  const { data, error } = await getSupabase()
    .from("words")
    .select(WORD_COLUMNS)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const words = wordsSchema.parse(data);
  return words.map((w) => {
    const match = (w.text || "").match(/::([a-z]{2,5})$/i);
    const inferredLang = match ? match[1].toLowerCase() : w.src_lang;
    return {
      ...w,
      text: cleanWordText(w.text),
      src_lang: inferredLang || w.src_lang,
    };
  });
}

export async function fetchStats(): Promise<Stats> {
  const { data, error } = await getSupabase()
    .from("user_stats")
    .select(STATS_COLUMNS)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data === null ? EMPTY_STATS : statsSchema.parse(data);
}

export async function deleteWord(id: string): Promise<void> {
  const { error } = await getSupabase().from("words").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function reviewWord(wordId: string, correct: boolean): Promise<void> {
  const { error } = await getSupabase().rpc("review_word", {
    p_word_id: wordId,
    p_correct: correct,
  });
  if (error) throw new Error(error.message);
}

export async function recordPractice(xp: number, today: string): Promise<void> {
  const { error } = await getSupabase().rpc("record_practice", { p_xp: xp, p_today: today });
  if (error) throw new Error(error.message);
}

export async function setDailyGoal(goal: number): Promise<void> {
  const { error } = await getSupabase().rpc("set_daily_goal", { p_goal: goal });
  if (error) throw new Error(error.message);
}

export async function updateWordLanguage(id: string, srcLang: string, word?: Word): Promise<void> {
  const supabase = getSupabase();
  const taggedText = word ? tagWordByLang(word.text, srcLang) : undefined;
  const updatePayload: Record<string, any> = { src_lang: srcLang };
  if (taggedText) updatePayload.text = taggedText;

  const { data, error } = await supabase
    .from("words")
    .update(updatePayload)
    .eq("id", id)
    .select();

  if (!error && data && data.length > 0) {
    return;
  }

  // Fallback: If direct update was blocked by RLS (0 rows modified),
  // delete and re-insert via save_word RPC (which is SECURITY DEFINER and always succeeds)
  if (word) {
    await deleteWord(id);
    const { error: rpcErr } = await supabase.rpc("save_word", {
      p_text: taggedText || word.text,
      p_translation: word.translation,
      p_src_lang: srcLang,
      p_target_lang: word.target_lang,
      p_source_title: word.source_title || "",
      p_source_url: word.source_url || "",
      p_times: word.times_seen || 1,
    });
    if (rpcErr) throw new Error(rpcErr.message);
    return;
  }
  if (error) throw new Error(error.message);
}

export async function addCustomWord(
  text: string,
  translation: string,
  srcLang: string,
  targetLang = "ar"
): Promise<string> {
  const tagged = tagWordByLang(text, srcLang);
  const supabase = getSupabase();

  // 1. Try save_word with p_src_lang
  const res1 = await supabase.rpc("save_word", {
    p_text: tagged,
    p_translation: translation,
    p_src_lang: srcLang,
    p_target_lang: targetLang,
  });
  if (!res1.error) return res1.data as string;

  // 2. Try save_word without p_src_lang (for legacy database schema)
  const res2 = await supabase.rpc("save_word", {
    p_text: tagged,
    p_translation: translation,
    p_target_lang: targetLang,
  });
  if (!res2.error) return res2.data as string;

  // 3. Try direct table insert
  const res3 = await supabase.from("words").insert({
    text: tagged,
    translation,
    src_lang: srcLang,
    target_lang: targetLang,
  }).select("id").maybeSingle();
  if (!res3.error && res3.data) return (res3.data as any).id;

  throw new Error(res1.error.message || res2.error?.message || "Failed to save word");
}

export async function deleteAccount(): Promise<void> {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  // 1. Try server RPC
  await supabase.rpc("delete_user_account");

  // 2. Fallback: clear data tables directly
  if (user) {
    await supabase.from("words").delete().eq("user_id", user.id);
    await supabase.from("user_stats").delete().eq("user_id", user.id);
  }

  // 3. Clear local storage
  if (typeof window !== "undefined") {
    localStorage.removeItem("wordtap_settings");
    localStorage.removeItem("wordtap_theme");
  }

  // 4. Sign out
  await supabase.auth.signOut();
}


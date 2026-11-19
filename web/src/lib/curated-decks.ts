import { getSupabase } from "./supabase";
import type { Word } from "./schemas";

export type CuratedDeckCategory = "all" | "tv_shows" | "career_tech" | "ielts_academic";

export type CuratedWordItem = {
  text: string;
  translation: string;
  meanings?: string[];
  definition: string;
  part_of_speech: string;
  sentence: string;
  source_title: string;
  source_url?: string;
};

export type CuratedDeck = {
  id: string;
  title: string;
  subtitle: string;
  category: "tv_shows" | "career_tech" | "ielts_academic";
  categoryLabel: string;
  emoji: string;
  badge: string;
  gradient: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  description: string;
  words: CuratedWordItem[];
};

export const CURATED_DECKS: CuratedDeck[] = [
  {
    id: "friends-conversational",
    title: "Friends: Everyday Conversation & Banter",
    subtitle: "Central Perk Wit, Relatable Slang & Social Idioms",
    category: "tv_shows",
    categoryLabel: "🎬 Netflix Classic",
    emoji: "☕",
    badge: "Most Popular",
    gradient: "from-amber-500/20 via-orange-500/10 to-transparent",
    level: "Intermediate",
    description:
      "Master natural American conversation, expressive adjectives, and everyday idioms directly from Chandler, Monica, Ross, and Rachel.",
    words: [
      {
        text: "Sarcastic",
        translation: "ساخر",
        meanings: ["ساخر", "متهكم", "لاذع"],
        definition: "Using irony or sharp mockery to convey contempt or humor.",
        part_of_speech: "adjective",
        sentence: "Could this meeting be any more boring, or are you just being sarcastic again?",
        source_title: "Friends · S02E14",
      },
      {
        text: "Vulnerable",
        translation: "ضعيف / عُرضة للجرح",
        meanings: ["ضعيف", "حساس", "مكشوف عاطفياً"],
        definition: "Susceptible to physical or emotional attack or harm.",
        part_of_speech: "adjective",
        sentence: "Opening up about how you really feel makes you feel vulnerable at first.",
        source_title: "Friends · S04E01",
      },
      {
        text: "Boundaries",
        translation: "حدود شخصية",
        meanings: ["حدود", "ضوابط", "خطوط فاصلة"],
        definition: "Guidelines, rules, or limits that a person creates to identify safe ways for others to behave around them.",
        part_of_speech: "noun",
        sentence: "You have to respect personal boundaries if you want a healthy relationship.",
        source_title: "Friends · S03E06",
      },
      {
        text: "Awkward",
        translation: "محرج / غير مريح",
        meanings: ["محرج", "مرتبك", "غير لائق"],
        definition: "Causing or feeling embarrassment or a lack of social ease.",
        part_of_speech: "adjective",
        sentence: "There was a really awkward silence when neither of them knew what to say.",
        source_title: "Friends · S01E03",
      },
      {
        text: "Commitment",
        translation: "التزام / تعهد",
        meanings: ["التزام", "تعهد", "إخلاص"],
        definition: "The state or quality of being dedicated to a cause or relationship.",
        part_of_speech: "noun",
        sentence: "He was terrified of commitment until he finally realized she was the one.",
        source_title: "Friends · S07E24",
      },
      {
        text: "Overwhelmed",
        translation: "مغمور / مجهد جداً",
        meanings: ["مغمور", "منهك", "مغلوب على أمره"],
        definition: "Defeated or completely overcome by superior force, numbers, or emotional stress.",
        part_of_speech: "adjective",
        sentence: "Starting a new job in a busy city can make anyone feel overwhelmed.",
        source_title: "Friends · S05E08",
      },
    ],
  },
  {
    id: "peaky-blinders-power",
    title: "Peaky Blinders: Power & Negotiation",
    subtitle: "High-Impact British English, Strategic Dialect & Grit",
    category: "tv_shows",
    categoryLabel: "🎩 British Drama",
    emoji: "🚬",
    badge: "Trending",
    gradient: "from-zinc-500/20 via-neutral-700/10 to-transparent",
    level: "Advanced",
    description:
      "Learn influential, decisive, and authoritative English used in high-stakes negotiations, leadership, and dramatic moments.",
    words: [
      {
        text: "Formidable",
        translation: "مهيب / يُحسب له حساب",
        meanings: ["مهيب", "مخيف", "هائل", "صعب المراس"],
        definition: "Inspiring fear or respect through being impressively large, powerful, or capable.",
        part_of_speech: "adjective",
        sentence: "Thomas Shelby built a formidable empire through patience and calculated risks.",
        source_title: "Peaky Blinders · S02E05",
      },
      {
        text: "Negotiate",
        translation: "يتفاوض / يناقش شروطاً",
        meanings: ["يتفاوض", "يساوم", "يحاور"],
        definition: "Try to reach an agreement or compromise by discussion with others.",
        part_of_speech: "verb",
        sentence: "We do not accept their first offer; we negotiate on our own terms.",
        source_title: "Peaky Blinders · S01E04",
      },
      {
        text: "Consequence",
        translation: "عاقبة / نتيجة حتمية",
        meanings: ["عاقبة", "نتيجة", "تبعة"],
        definition: "A result or effect of an action or condition, especially a negative one.",
        part_of_speech: "noun",
        sentence: "Every decision you make in this business carries a serious consequence.",
        source_title: "Peaky Blinders · S03E02",
      },
      {
        text: "Ruthless",
        translation: "قاسٍ / بلا رحمة",
        meanings: ["قاسٍ", "صارم", "بلا هوادة"],
        definition: "Having or showing no pity or compassion for others.",
        part_of_speech: "adjective",
        sentence: "In a world full of enemies, you cannot afford to be anything less than ruthless.",
        source_title: "Peaky Blinders · S04E06",
      },
      {
        text: "Allegiance",
        translation: "ولاء / عهد التزام",
        meanings: ["ولاء", "بيعة", "إخلاص"],
        definition: "Loyalty or commitment of a subordinate to a superior or of an individual to a group.",
        part_of_speech: "noun",
        sentence: "He swore his allegiance to the family before taking on the dangerous mission.",
        source_title: "Peaky Blinders · S05E01",
      },
      {
        text: "Reputation",
        translation: "سمعة / مكانة",
        meanings: ["سمعة", "صيت", "مكانة"],
        definition: "The beliefs or opinions that are generally held about someone or something.",
        part_of_speech: "noun",
        sentence: "It takes a lifetime to build a reputation and only one mistake to ruin it.",
        source_title: "Peaky Blinders · S02E01",
      },
    ],
  },
  {
    id: "silicon-valley-tech",
    title: "Silicon Valley & Tech Founders",
    subtitle: "Startups, Venture Pitching & Workplace Modern English",
    category: "career_tech",
    categoryLabel: "🚀 Career & Tech",
    emoji: "💻",
    badge: "Career Growth",
    gradient: "from-blue-500/20 via-cyan-500/10 to-transparent",
    level: "Intermediate",
    description:
      "Essential vocabulary for tech interviews, startup presentations, remote meetings, and software engineering teams.",
    words: [
      {
        text: "Leverage",
        translation: "يستفيد من / يوظّف ميزة",
        meanings: ["يوظّف", "يستغل ميزة", "يستثمر قدرة"],
        definition: "Use something to maximum advantage to accomplish a goal.",
        part_of_speech: "verb",
        sentence: "We need to leverage our existing user base to launch the new mobile application.",
        source_title: "Silicon Valley · S02E03",
      },
      {
        text: "Traction",
        translation: "إقبال / تفاعل في السوق",
        meanings: ["إقبال", "تجاوب السوق", "زخم"],
        definition: "The extent to which an idea, product, or company gains popularity or acceptance in the market.",
        part_of_speech: "noun",
        sentence: "The startup began gaining traction right after their viral demo on YouTube.",
        source_title: "Silicon Valley · S01E06",
      },
      {
        text: "Pivot",
        translation: "يُغيّر مسار العمل / يتجه لوجهة جديدة",
        meanings: ["يُغيّر المسار", "يعدّل النموذج", "يتحول استراتيجياً"],
        definition: "Change direction or strategy fundamentally, especially in response to market feedback.",
        part_of_speech: "verb",
        sentence: "When customer acquisition costs soared, the founders decided to pivot to B2B.",
        source_title: "Silicon Valley · S03E04",
      },
      {
        text: "Scalability",
        translation: "قابلية التوسع والنمو",
        meanings: ["قابلية التوسع", "المرونة الاستيعابية"],
        definition: "The capacity to change in size or scale to handle increasing demand effectively.",
        part_of_speech: "noun",
        sentence: "Our database architecture was chosen specifically for its long-term scalability.",
        source_title: "Silicon Valley · S04E02",
      },
      {
        text: "Monetize",
        translation: "يحقق أرباحاً من / يحوّل إلى دخل",
        meanings: ["يحقق دخلاً", "يجني أرباحاً", "يحوّل إلى مال"],
        definition: "Convert an asset or feature into legal tender or revenue.",
        part_of_speech: "verb",
        sentence: "You have millions of active users, but how exactly do you plan to monetize them?",
        source_title: "Silicon Valley · S01E02",
      },
      {
        text: "Friction",
        translation: "عقبة / صعوبة في تجربة المستخدم",
        meanings: ["صعوبة", "عقبة", "احتكاك"],
        definition: "Conflict, resistance, or barriers that slow down user onboarding or completion.",
        part_of_speech: "noun",
        sentence: "Removing sign-up friction immediately increased our daily conversion rate by 40%.",
        source_title: "Silicon Valley · S05E05",
      },
    ],
  },
  {
    id: "ielts-band-8",
    title: "IELTS Band 8+ & Academic Fluency",
    subtitle: "High-Scoring Academic & Essay Vocabulary",
    category: "ielts_academic",
    categoryLabel: "🎓 IELTS & Academic",
    emoji: "📚",
    badge: "Exam Ready",
    gradient: "from-emerald-500/20 via-teal-500/10 to-transparent",
    level: "Advanced",
    description:
      "Impress examiners in IELTS Writing Task 2 and Speaking Part 3 with sophisticated, precise lexical resource.",
    words: [
      {
        text: "Predominantly",
        translation: "بشكل غالب / أساسي",
        meanings: ["بشكل رئيسي", "غالباً", "في المقام الأول"],
        definition: "Mainly, for the most part, or to a greater degree.",
        part_of_speech: "adverb",
        sentence: "The local economy is predominantly driven by agricultural exports and tourism.",
        source_title: "IELTS Cambridge · Academic Task 2",
      },
      {
        text: "Inevitable",
        translation: "حتمي / لا مفر منه",
        meanings: ["حتمي", "لا مناص منه", "محتوم"],
        definition: "Certain to happen; unavoidable.",
        part_of_speech: "adjective",
        sentence: "Technological advancement in automation is an inevitable part of modern industry.",
        source_title: "IELTS Cambridge · Academic Task 2",
      },
      {
        text: "Substantial",
        translation: "كبير / جوهري / ذو شأن",
        meanings: ["كبير", "جوهري", "ملحوظ", "معتبر"],
        definition: "Of considerable importance, size, or worth.",
        part_of_speech: "adjective",
        sentence: "The government made a substantial investment in renewable energy projects this decade.",
        source_title: "IELTS Cambridge · Academic Task 2",
      },
      {
        text: "Counterpart",
        translation: "نظير / مثيل في منصب أو بلد آخر",
        meanings: ["نظير", "قرين", "مثيل"],
        definition: "A person or thing corresponding to or having the same function as another in a different place.",
        part_of_speech: "noun",
        sentence: "The foreign minister met with his French counterpart to discuss international trade.",
        source_title: "IELTS Cambridge · Speaking Part 3",
      },
      {
        text: "Fluctuate",
        translation: "يتذبذب / يتقلب صعوداً وهبوطاً",
        meanings: ["يتذبذب", "يتقلب", "يتغير باستمرار"],
        definition: "Rise and fall irregularly in number, level, or amount.",
        part_of_speech: "verb",
        sentence: "Consumer prices fluctuate significantly throughout the four seasons of the year.",
        source_title: "IELTS Cambridge · Academic Task 1",
      },
      {
        text: "Mitigate",
        translation: "يخفف من حدة / يقلل الضرر",
        meanings: ["يخفف", "يلطف", "يقلل من وطأة"],
        definition: "Make something bad less severe, serious, or painful.",
        part_of_speech: "verb",
        sentence: "Strict environmental regulations help mitigate the long-term impacts of climate change.",
        source_title: "IELTS Cambridge · Academic Task 2",
      },
    ],
  },
];

export function getCuratedDecks(category: CuratedDeckCategory = "all"): CuratedDeck[] {
  if (category === "all") return CURATED_DECKS;
  return CURATED_DECKS.filter((d) => d.category === category);
}

export function getCuratedDeckById(id: string): CuratedDeck | undefined {
  return CURATED_DECKS.find((d) => d.id === id);
}

/** Converts curated deck words into Word objects so users can practice them immediately */
export function deckWordsToPracticeWords(deck: CuratedDeck): Word[] {
  return deck.words.map((w, idx) => ({
    id: `curated-${deck.id}-${idx}`,
    user_id: "curated-guest",
    text: w.text,
    translation: w.translation,
    definition: w.definition,
    part_of_speech: w.part_of_speech,
    sentence: w.sentence,
    source_title: w.source_title,
    source_url: w.source_url || "",
    src_lang: "en",
    target_lang: "ar",
    learning_status: "new",
    current_stage: 1,
    completed_stages: [],
    fsrs_stability: 0,
    fsrs_difficulty: 0,
    fsrs_reps: 0,
    fsrs_lapses: 0,
    interval_days: 0,
    times_seen: 0,
    box: 0,
    correct_count: 0,
    wrong_count: 0,
    last_practiced: null,
    next_review: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));
}

/**
 * Clones words from a curated deck into the user's personal vocabulary table in Supabase.
 */
export async function importDeckToUserVocabulary(
  deckId: string,
): Promise<{ success: boolean; count: number; error?: string }> {
  const deck = getCuratedDeckById(deckId);
  if (!deck) return { success: false, count: 0, error: "Deck not found" };

  try {
    const supabase = getSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        success: false,
        count: 0,
        error: "Please sign in to add this deck to your vocabulary library.",
      };
    }

    const rowsToInsert = deck.words.map((w) => ({
      user_id: user.id,
      text: w.text,
      translation: w.translation,
      definition: w.definition,
      part_of_speech: w.part_of_speech,
      sentence: w.sentence,
      source_title: w.source_title,
      src_lang: "en",
      target_lang: "ar",
      learning_status: "new",
      fsrs_state: 0,
      next_review: new Date().toISOString(),
    }));

    const { error } = await supabase.from("words").upsert(rowsToInsert, {
      onConflict: "user_id,text,src_lang,target_lang",
      ignoreDuplicates: true,
    });

    if (error) {
      return { success: false, count: 0, error: error.message };
    }

    return { success: true, count: deck.words.length };
  } catch (err) {
    return {
      success: false,
      count: 0,
      error: err instanceof Error ? err.message : "Failed to import deck",
    };
  }
}

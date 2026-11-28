import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders, guardApiRequestShared, handleCorsPreflight } from "@/lib/api-guard";
import { callAiJson } from "@/lib/ai-server";

export async function OPTIONS(req: Request) {
  return handleCorsPreflight(req);
}

const requestSchema = z.object({
  word: z.string().trim().min(1).max(160),
  expectedTranslation: z.string().trim().min(1).max(320),
  userTranslation: z.string().trim().min(1).max(320),
  srcLang: z.string().trim().max(20).optional().default("en"),
  targetLang: z.string().trim().max(20).optional().default("ar"),
  allowSimpleTypos: z.boolean().optional().default(false),
});

const aiEvalSchema = z.object({
  isCorrect: z.boolean(),
  reason: z.string().max(240).optional().default(""),
});

function normalizeText(value: string): string {
  return value
    .trim()
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/[ؤئ]/g, "ء")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")
    .toLowerCase();
}

function stripArabicAlPrefix(value: string): string {
  return value
    .split(/\s+/)
    .map((tok) => (tok.startsWith("ال") && tok.length > 3 ? tok.slice(2) : tok))
    .join(" ");
}

function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    Array<number>(b.length + 1).fill(0),
  );
  for (let i = 0; i <= a.length; i++) dp[i]![0] = i;
  for (let j = 0; j <= b.length; j++) dp[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + cost,
      );
    }
  }
  return dp[a.length]![b.length]!;
}

function isLocalMatch(
  expectedTranslation: string,
  userTranslation: string,
  allowSimpleTypos: boolean,
): boolean {
  const userNorm = normalizeText(userTranslation);
  const userNoAl = stripArabicAlPrefix(userNorm);
  if (!userNorm) return false;

  const full = normalizeText(expectedTranslation);
  const parts = expectedTranslation
    .split(/[,،;/]+/)
    .map((p) => normalizeText(p))
    .filter(Boolean);
  const candidates = Array.from(new Set(full ? [full, ...parts] : parts));

  return candidates.some((cand) => {
    const candNoAl = stripArabicAlPrefix(cand);
    if (userNorm === cand || userNoAl === candNoAl) return true;
    if (allowSimpleTypos && candNoAl.length >= 4) {
      return levenshtein(userNoAl, candNoAl) <= 1;
    }
    return false;
  });
}

function isFuzzyPhraseMatch(expectedTranslation: string, userTranslation: string): boolean {
  const userTokens = stripArabicAlPrefix(normalizeText(userTranslation))
    .split(/\s+/)
    .filter(Boolean);
  if (userTokens.length === 0) return false;

  const full = normalizeText(expectedTranslation);
  const parts = expectedTranslation
    .split(/[,،;/]+/)
    .map((p) => normalizeText(p))
    .filter(Boolean);
  const candidates = Array.from(new Set(full ? [full, ...parts] : parts));

  for (const cand of candidates) {
    const candTokens = stripArabicAlPrefix(cand).split(/\s+/).filter(Boolean);
    if (candTokens.length === 0) continue;

    // Whole-string similarity for close spelling / minor hamza/taa-marbuta variations
    const userJoined = userTokens.join(" ");
    const candJoined = candTokens.join(" ");
    const maxLen = Math.max(userJoined.length, candJoined.length);
    if (maxLen >= 5) {
      const dist = levenshtein(userJoined, candJoined);
      if (dist / maxLen <= 0.22) return true;
    }

    // Multi-word phrase token overlap (e.g. "منشاء علاج مياه الصرف الصحي" vs "منشأة معالجة مياه الصرف الصحي")
    if (candTokens.length >= 2 && userTokens.length >= 2) {
      let matched = 0;
      for (const ct of candTokens) {
        const hit = userTokens.some((ut) => {
          if (ut === ct) return true;
          const m = Math.max(ut.length, ct.length);
          return m >= 4 && levenshtein(ut, ct) <= 2;
        });
        if (hit) matched++;
      }
      if (matched / Math.max(candTokens.length, userTokens.length) >= 0.65) {
        return true;
      }
    }
  }
  return false;
}

async function checkBackTranslationMatch(
  word: string,
  userTranslation: string,
  srcLang: string,
  targetLang: string,
): Promise<boolean> {
  try {
    const url = new URL("https://translate.googleapis.com/translate_a/single");
    url.searchParams.set("client", "gtx");
    url.searchParams.set("sl", targetLang || "auto");
    url.searchParams.set("tl", srcLang || "en");
    url.searchParams.set("dt", "t");
    url.searchParams.set("q", userTranslation);

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return false;
    const data = (await res.json()) as [Array<[string, string]>];
    const backTranslated = (data?.[0] || []).map((chunk) => chunk?.[0] || "").join(" ").trim();
    if (!backTranslated) return false;

    const normWord = normalizeText(word);
    const normBack = normalizeText(backTranslated);
    if (normWord === normBack) return true;

    const wordTokens = normWord.split(/\s+/).filter((t) => t.length > 2);
    const backTokens = normBack.split(/\s+/).filter((t) => t.length > 2);
    if (wordTokens.length === 0 || backTokens.length === 0) return false;

    let overlap = 0;
    for (const wt of wordTokens) {
      if (backTokens.some((bt) => bt === wt || (bt.length >= 4 && wt.length >= 4 && levenshtein(bt, wt) <= 1))) {
        overlap++;
      }
    }
    if (overlap / Math.max(wordTokens.length, backTokens.length) >= 0.6) {
      return true;
    }

    // Check English synonym / related-meaning overlap via Datamuse (no API key needed)
    if ((srcLang || "en") === "en" && wordTokens.length === 1 && backTokens.length <= 3) {
      const dmUrl = new URL("https://api.datamuse.com/words");
      dmUrl.searchParams.set("ml", wordTokens[0]!);
      dmUrl.searchParams.set("max", "40");
      const dmRes = await fetch(dmUrl.toString(), { signal: AbortSignal.timeout(3500) });
      if (dmRes.ok) {
        const related = (await dmRes.json()) as Array<{ word?: string }>;
        const relatedSet = new Set(
          related.map((r) => (r.word || "").toLowerCase().trim()).filter(Boolean),
        );
        if (backTokens.some((bt) => relatedSet.has(bt))) {
          return true;
        }
      }
    }

    return false;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const blocked = await guardApiRequestShared(req, "learn-evaluate-translation", 60);
  if (blocked) return blocked;
  const corsHeaders = getCorsHeaders(req);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400, headers: corsHeaders });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid translation check payload." },
      { status: 400, headers: corsHeaders },
    );
  }

  const { word, expectedTranslation, userTranslation, srcLang, targetLang, allowSimpleTypos } =
    parsed.data;

  if (isLocalMatch(expectedTranslation, userTranslation, allowSimpleTypos)) {
    return NextResponse.json(
      { isCorrect: true, source: "local", reason: "" },
      { status: 200, headers: corsHeaders },
    );
  }

  const systemPrompt = [
    "You are a fair, encouraging bilingual vocabulary grader.",
    "Decide whether the learner's typed translation accurately conveys the meaning of the source word or phrase.",
    "Accept valid synonyms in the target language (e.g. Arabic علاج vs معالجة), definite/indefinite forms (with or without Arabic 'ال'), singular/plural variations, common hamza/taa-marbuta/spelling variations (e.g. منشاء vs منشأة), and natural phrasing.",
    "Reject clearly unrelated meanings, opposites, or random guesses.",
    'Return strict JSON: {"isCorrect": boolean, "reason": "brief 1-sentence feedback"}.',
  ].join(" ");

  const userPrompt = [
    `Source word (${srcLang}): "${word}"`,
    `Reference translation (${targetLang}): "${expectedTranslation}"`,
    `Learner typed (${targetLang}): "${userTranslation}"`,
  ].join("\n");

  const aiResult = await callAiJson<unknown>(systemPrompt, userPrompt, 10_000);
  if (aiResult) {
    const validated = aiEvalSchema.safeParse(aiResult.data);
    if (validated.success) {
      if (validated.data.isCorrect) {
        return NextResponse.json(
          {
            isCorrect: true,
            source: aiResult.provider,
            reason: validated.data.reason,
          },
          { status: 200, headers: corsHeaders },
        );
      }
      // If AI rejected, double-check fuzzy phrase match for minor Arabic spelling variants
      if (isFuzzyPhraseMatch(expectedTranslation, userTranslation)) {
        return NextResponse.json(
          {
            isCorrect: true,
            source: "fuzzy",
            reason: "Accepted close spelling / phrasing.",
          },
          { status: 200, headers: corsHeaders },
        );
      }
      return NextResponse.json(
        {
          isCorrect: false,
          source: aiResult.provider,
          reason: validated.data.reason,
        },
        { status: 200, headers: corsHeaders },
      );
    }
  }

  // Fallback when AI provider is unavailable: fuzzy phrase similarity + back-translation check
  if (
    isFuzzyPhraseMatch(expectedTranslation, userTranslation) ||
    (await checkBackTranslationMatch(word, userTranslation, srcLang, targetLang))
  ) {
    return NextResponse.json(
      { isCorrect: true, source: "semantic-fallback", reason: "" },
      { status: 200, headers: corsHeaders },
    );
  }

  return NextResponse.json(
    { isCorrect: false, source: "fallback", reason: "" },
    { status: 200, headers: corsHeaders },
  );
}

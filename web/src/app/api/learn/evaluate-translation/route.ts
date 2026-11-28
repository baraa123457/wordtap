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
    "You are a fair bilingual vocabulary grader.",
    "Decide whether the learner's typed translation accurately conveys the meaning of the source word.",
    "Accept valid synonyms in the target language, definite/indefinite forms (e.g. Arabic 'ال' prefix or without it), singular/plural variations, and common dialect/MSA equivalents.",
    allowSimpleTypos
      ? "Minor spelling typos (1 character off) should be accepted as correct."
      : "Reject clearly misspelled words unless it is just standard hamza/taa-marbuta/alef-maqsura variation.",
    "Reject unrelated meanings, opposites, or random guesses.",
    'Return strict JSON: {"isCorrect": boolean, "reason": "brief 1-sentence feedback"}.',
  ].join(" ");

  const userPrompt = [
    `Source word (${srcLang}): "${word}"`,
    `Reference translation (${targetLang}): "${expectedTranslation}"`,
    `Learner typed (${targetLang}): "${userTranslation}"`,
  ].join("\n");

  const aiResult = await callAiJson<unknown>(systemPrompt, userPrompt, 8_000);
  if (aiResult) {
    const validated = aiEvalSchema.safeParse(aiResult.data);
    if (validated.success) {
      return NextResponse.json(
        {
          isCorrect: validated.data.isCorrect,
          source: aiResult.provider,
          reason: validated.data.reason,
        },
        { status: 200, headers: corsHeaders },
      );
    }
  }

  return NextResponse.json(
    { isCorrect: false, source: "fallback", reason: "" },
    { status: 200, headers: corsHeaders },
  );
}

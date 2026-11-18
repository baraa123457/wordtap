import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders, guardApiRequest, handleCorsPreflight } from "@/lib/api-guard";
import { callAiJson } from "@/lib/ai-server";
import { buildTargetWordPattern } from "@/lib/placeholder";

export async function OPTIONS(req: Request) {
  return handleCorsPreflight(req);
}

const requestSchema = z.object({
  word: z.string().trim().min(1).max(120),
  sentence: z.string().trim().min(1).max(600),
  definition: z.string().trim().max(600).optional().default(""),
  partOfSpeech: z.string().trim().max(60).optional().default(""),
  level: z.enum(["beginner", "intermediate", "advanced"]).optional().default("intermediate"),
});

const aiEvalSchema = z.object({
  isCorrect: z.boolean(),
  usageCorrect: z.boolean(),
  grammarScore: z.number().min(0).max(100),
  grammarCorrections: z.array(z.string().max(240)).max(5).default([]),
  naturalAlternative: z.string().max(320).nullable().optional().default(null),
  naturalnessFeedback: z.string().max(320),
  explanation: z.string().max(500),
});

type LanguageToolMatch = {
  message?: string;
  shortMessage?: string;
  replacements?: Array<{ value?: string }>;
  offset?: number;
  length?: number;
  rule?: {
    id?: string;
    issueType?: string;
    category?: { id?: string };
  };
};

const IGNORED_LT_CATEGORIES = new Set([
  "CASING",
  "PUNCTUATION",
  "TYPOGRAPHY",
  "COLLOQUIALISMS",
  "STYLE",
  "REDUNDANCY",
  "PLAIN_ENGLISH",
]);

const IGNORED_LT_RULE_RE =
  /CASE|UPPER|LOWER|CAPITAL|PUNCT|COMMA|PERIOD|APOSTROPHE|QUOT|INFORMAL|COLLOQ|SLANG|WANNA|GONNA|GOTTA|DUNNO|KINDA|SORTA|WHITESPACE/i;

const IGNORED_LT_MESSAGE_RE =
  /capitaliz|uppercase|lowercase|punctuation|informal|colloquial|slang|apostrophe|comma|period|question mark|exclamation|full stop|quotation|whitespace/i;

const INFORMAL_WORDS = new Set([
  "wanna",
  "gonna",
  "gotta",
  "kinda",
  "sorta",
  "dunno",
  "lemme",
  "gimme",
  "outta",
  "ya",
  "yall",
  "ain't",
  "aint",
  "cause",
  "cuz",
  "coz",
  "prolly",
  "bro",
  "dude",
  "ok",
  "okay",
  "plz",
  "pls",
  "u",
  "ur",
  "im",
  "ive",
  "id",
  "dont",
  "doesnt",
  "didnt",
  "cant",
  "wont",
  "isnt",
  "arent",
  "wasnt",
  "werent",
  "havent",
  "hasnt",
  "hadnt",
  "couldnt",
  "wouldnt",
  "shouldnt",
  "thats",
  "whats",
  "heres",
  "theres",
  "youre",
  "theyre",
  "were",
  "its",
]);

function isIgnoredLanguageToolMatch(match: LanguageToolMatch, originalSentence: string): boolean {
  const catId = (match.rule?.category?.id || "").toUpperCase();
  if (IGNORED_LT_CATEGORIES.has(catId)) return true;

  const issueType = (match.rule?.issueType || "").toLowerCase();
  if (
    issueType === "style" ||
    issueType === "typographical" ||
    issueType === "whitespace" ||
    issueType === "register"
  ) {
    return true;
  }

  const ruleId = match.rule?.id || "";
  if (IGNORED_LT_RULE_RE.test(ruleId)) return true;

  const combinedMsg = `${match.shortMessage || ""} ${match.message || ""}`;
  if (IGNORED_LT_MESSAGE_RE.test(combinedMsg)) return true;

  if (typeof match.offset === "number" && typeof match.length === "number") {
    const snippet = originalSentence.slice(match.offset, match.offset + match.length).trim();
    const suggestion = (match.replacements?.[0]?.value || "").trim();

    // Ignore pure capitalization-only changes (e.g. "i" -> "I")
    if (snippet && suggestion && snippet.toLowerCase() === suggestion.toLowerCase()) {
      return true;
    }
    // Ignore pure punctuation/apostrophe-only changes (e.g. "dont" -> "don't", "word" -> "word.")
    const stripPunct = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
    if (snippet && suggestion && stripPunct(snippet) === stripPunct(suggestion)) {
      return true;
    }
    // Ignore casual/informal spoken words (e.g. "wanna", "gonna", "gotta")
    if (INFORMAL_WORDS.has(snippet.toLowerCase())) {
      return true;
    }
  }

  return false;
}

function normalizeForGrammarCheck(sentence: string): string {
  // Normalize casing & trailing period only for the parser so it evaluates real grammar,
  // without penalizing the learner for capitalization or missing end punctuation.
  let s = sentence.replace(/\bi\b/g, "I");
  if (/^[a-z]/.test(s)) {
    s = s[0]!.toUpperCase() + s.slice(1);
  }
  if (!/[.!?]$/.test(s)) {
    s = `${s}.`;
  }
  return s;
}

async function checkWithLanguageTool(sentence: string): Promise<LanguageToolMatch[] | null> {
  try {
    const normalized = normalizeForGrammarCheck(sentence);
    const body = new URLSearchParams({
      text: normalized,
      language: "en-US",
      disabledCategories: Array.from(IGNORED_LT_CATEGORIES).join(","),
      disabledRules: "UPPERCASE_SENTENCE_START,I_LOWERCASE,EN_CONTRACTION_SPELLING",
    });
    const res = await fetch("https://api.languagetool.org/v2/check", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { matches?: LanguageToolMatch[] };
    const matches = Array.isArray(data.matches) ? data.matches : [];
    return matches.filter((m) => !isIgnoredLanguageToolMatch(m, normalized));
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const blocked = guardApiRequest(req, "learn-evaluate-sentence", 40);
  if (blocked) return blocked;
  const corsHeaders = getCorsHeaders(req);

  try {
    const raw = await req.json();
    const parsed = requestSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please write a sentence to evaluate." },
        { status: 400, headers: corsHeaders },
      );
    }

    const { word, sentence, definition, partOfSpeech, level } = parsed.data;
    const cleanSentence = sentence.replace(/\s+/g, " ").trim();
    const wordTokens = cleanSentence.split(/\s+/).filter(Boolean);
    const containsTargetWord = buildTargetWordPattern(word).test(cleanSentence);

    // Quick guard: sentence must have at least 3 words and actually attempt to use the target word
    if (wordTokens.length < 3) {
      return NextResponse.json(
        {
          isCorrect: false,
          usageCorrect: containsTargetWord,
          grammarScore: 25,
          grammarCorrections: ["Write a complete sentence with a subject and verb (at least 3-4 words)."],
          naturalAlternative: null,
          naturalnessFeedback: "Too short to evaluate as a full sentence.",
          explanation: `Try writing a complete thought that shows what "${word}" means in a real situation.`,
          provider: "validator",
        },
        { headers: corsHeaders },
      );
    }

    if (!containsTargetWord) {
      return NextResponse.json(
        {
          isCorrect: false,
          usageCorrect: false,
          grammarScore: 40,
          grammarCorrections: [`Your sentence must include the target word "${word}" (or a valid grammatical form of it).`],
          naturalAlternative: null,
          naturalnessFeedback: `Make sure "${word}" appears naturally in your sentence.`,
          explanation: `We didn't spot "${word}" in your sentence. Include it and submit again!`,
          provider: "validator",
        },
        { headers: corsHeaders },
      );
    }

    // 1. Primary: Server-side AI Evaluation (Gemini or OpenAI)
    const systemPrompt = `You are a supportive, fair English teacher evaluating a student's original sentence for an ${level}-level learner.
Evaluate the sentence on:
1. Core grammar correctness (verb tense, subject-verb agreement, word order)
2. Correct usage and meaning of the target vocabulary word
3. Naturalness in everyday spoken or written English
4. Clarity of meaning

CRITICAL FAIRNESS & LENIENCY RULES:
- COMPLETELY IGNORE capitalization (e.g., lowercase "i", lowercase sentence start, or mixed case). NEVER deduct points or mention capitalization.
- COMPLETELY IGNORE informal / conversational English (e.g., "wanna", "gonna", "gotta", "kinda", "dunno", casual phrasing). Everyday spoken English is 100% valid and correct.
- COMPLETELY IGNORE punctuation marks (e.g., missing period, question mark, exclamation mark, commas, or missing apostrophes like "dont"/"im"/"cant"). NEVER deduct points or mention punctuation.
- Do NOT reject a valid sentence simply because it is casual or differs from a textbook example. Accept any natural context where the target word is used accurately.

Return ONLY valid JSON with these exact keys:
{
  "isCorrect": boolean,
  "usageCorrect": boolean,
  "grammarScore": integer 0..100,
  "grammarCorrections": ["specific concise correction for real grammar/usage errors ONLY, empty array if none"],
  "naturalAlternative": "a more natural phrasing ONLY if helpful, else null",
  "naturalnessFeedback": "1 short sentence on how natural the sentence sounds",
  "explanation": "1-3 clear, encouraging sentences explaining what worked well or what to fix"
}`;

    const userPrompt = `Target word: "${word}"${partOfSpeech ? ` (${partOfSpeech})` : ""}${definition ? `\nMeaning: ${definition}` : ""}\nLearner's sentence: "${cleanSentence}"`;

    const aiRes = await callAiJson<unknown>(systemPrompt, userPrompt);
    if (aiRes) {
      const checked = aiEvalSchema.safeParse(aiRes.data);
      if (checked.success) {
        return NextResponse.json(
          {
            ...checked.data,
            grammarScore: Math.round(checked.data.grammarScore),
            provider: aiRes.provider,
          },
          { headers: corsHeaders },
        );
      }
    }

    // 2. Legitimate Fallback: LanguageTool real grammar API (filtering out casing, informal, & punctuation)
    const normalizedForLt = normalizeForGrammarCheck(cleanSentence);
    const ltMatches = await checkWithLanguageTool(cleanSentence);
    const grammarCorrections: string[] = [];
    let penalty = 0;

    if (ltMatches && ltMatches.length > 0) {
      for (const m of ltMatches.slice(0, 4)) {
        const msg = m.shortMessage || m.message || "Grammar issue detected";
        const suggestion = m.replacements?.[0]?.value;
        const snippet =
          typeof m.offset === "number" && typeof m.length === "number"
            ? normalizedForLt.slice(m.offset, m.offset + m.length)
            : "";

        if (snippet && suggestion) {
          grammarCorrections.push(`${msg}: try "${suggestion}" instead of "${snippet}".`);
        } else {
          grammarCorrections.push(msg);
        }
        penalty += m.rule?.category?.id === "TYPOS" ? 10 : 15;
      }
    }

    const grammarScore = Math.max(30, Math.min(100, 100 - penalty));
    const isCorrect = containsTargetWord && grammarScore >= 75;

    return NextResponse.json(
      {
        isCorrect,
        usageCorrect: containsTargetWord,
        grammarScore,
        grammarCorrections,
        naturalAlternative: null,
        naturalnessFeedback: isCorrect
          ? `Nice work! Your sentence uses "${word}" in a complete structure.`
          : "Review the grammar notes below and try rewriting for an even smoother sentence.",
        explanation: isCorrect
          ? `Your sentence is clear and grammatically sound (${grammarScore}/100).`
          : `Good effort using "${word}"! Fix the suggested grammar points and try again to strengthen your mastery.`,
        provider: ltMatches !== null ? "languagetool" : "validator",
      },
      { headers: corsHeaders },
    );
  } catch (err) {
    console.error("Sentence evaluation API error:", err);
    return NextResponse.json(
      { error: "Could not evaluate sentence right now." },
      { status: 500, headers: corsHeaders },
    );
  }
}

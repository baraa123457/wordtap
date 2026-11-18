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
  rule?: { category?: { id?: string } };
};

async function checkWithLanguageTool(sentence: string): Promise<LanguageToolMatch[] | null> {
  try {
    const body = new URLSearchParams({
      text: sentence,
      language: "en-US",
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
    return Array.isArray(data.matches) ? data.matches : [];
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
1. Grammar correctness
2. Correct usage and meaning of the target vocabulary word
3. Naturalness in everyday English
4. Sentence structure
5. Clarity of meaning

CRITICAL FAIRNESS RULE:
Do NOT reject a grammatically correct sentence simply because it differs from your preferred example. Accept any valid structure, tense, or context where the word is used accurately.

Return ONLY valid JSON with these exact keys:
{
  "isCorrect": boolean,
  "usageCorrect": boolean,
  "grammarScore": integer 0..100,
  "grammarCorrections": ["specific concise correction if any, empty array if none"],
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

    // 2. Legitimate Fallback: LanguageTool real grammar API + structural validation
    const ltMatches = await checkWithLanguageTool(cleanSentence);
    const grammarCorrections: string[] = [];
    let penalty = 0;

    if (ltMatches && ltMatches.length > 0) {
      for (const m of ltMatches.slice(0, 4)) {
        const msg = m.shortMessage || m.message || "Grammar issue detected";
        const suggestion = m.replacements?.[0]?.value;
        const snippet =
          typeof m.offset === "number" && typeof m.length === "number"
            ? cleanSentence.slice(m.offset, m.offset + m.length)
            : "";

        if (snippet && suggestion) {
          grammarCorrections.push(`${msg}: try "${suggestion}" instead of "${snippet}".`);
        } else {
          grammarCorrections.push(msg);
        }
        penalty += m.rule?.category?.id === "TYPOS" ? 10 : 15;
      }
    } else {
      // Minimal structural checks if LanguageTool is unreachable
      if (!/^[A-Z]/.test(cleanSentence)) {
        grammarCorrections.push("Start your sentence with a capital letter.");
        penalty += 5;
      }
      if (!/[.!?]$/.test(cleanSentence)) {
        grammarCorrections.push("End your sentence with punctuation (., !, or ?).");
        penalty += 5;
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

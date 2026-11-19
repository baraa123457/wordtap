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
  definition: z.string().trim().max(600).optional().default(""),
  partOfSpeech: z.string().trim().max(60).optional().default(""),
});

const aiResponseSchema = z.object({
  examples: z.array(z.string().min(10).max(300)).min(3),
});

async function fetchDictionaryExamples(word: string): Promise<string[]> {
  const clean = word.toLowerCase().trim();
  const forms = [clean];
  if (clean.endsWith("s") && clean.length > 3) forms.push(clean.slice(0, -1));
  if (clean.endsWith("ed") && clean.length > 4) forms.push(clean.slice(0, -2));
  if (clean.endsWith("ing") && clean.length > 5) forms.push(clean.slice(0, -3));

  const results: string[] = [];
  for (const form of forms) {
    if (results.length >= 3) break;
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=en&dt=ex&q=${encodeURIComponent(
        form,
      )}`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(3000),
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });
      if (res.ok) {
        const d = (await res.json()) as unknown[];
        const exGroup = (d?.[13] as Array<Array<Array<unknown>>>)?.[0];
        if (Array.isArray(exGroup)) {
          for (const item of exGroup) {
            const raw = item?.[0];
            if (typeof raw === "string") {
              const cleaned = raw.replace(/<[^>]+>/g, "").trim();
              const capitalized = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
              const withPeriod = capitalized.endsWith(".") ? capitalized : `${capitalized}.`;
              if (!results.includes(withPeriod) && withPeriod.length >= 15) {
                results.push(withPeriod);
                if (results.length >= 3) break;
              }
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }
  return results;
}

function buildTemplateExamples(word: string, pos: string): string[] {
  const p = pos.toLowerCase();
  const clean = word.trim();
  if (p.includes("verb")) {
    return [
      `It took them several hours to ${clean} all the information they needed.`,
      `You should always ${clean} this carefully before moving forward.`,
      `She was able to ${clean} the situation with calm confidence.`,
    ];
  }
  if (p.includes("noun")) {
    return [
      `We need to examine every ${clean} of the project before reaching a conclusion.`,
      `This is a crucial ${clean} that should not be overlooked.`,
      `Her report highlighted several key ${clean} for the team to focus on.`,
    ];
  }
  if (p.includes("adj")) {
    return [
      `The manager provided a very clear and ${clean} summary of the quarterly results.`,
      `She remained remarkably ${clean} throughout the entire process.`,
      `Finding a truly ${clean} solution requires patience and creativity.`,
    ];
  }
  return [
    `Understanding how to use "${clean}" naturally will make your English sound more fluent.`,
    `Our teacher shared a wonderful practical example of "${clean}" in today's class.`,
    `Practice using "${clean}" in your everyday conversations with friends or coworkers.`,
  ];
}

export async function POST(req: Request) {
  const blocked = guardApiRequest(req, "learn-examples", 60);
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

    const { word, definition, partOfSpeech } = parsed.data;

    // 0. High-speed cache check (zero AI token cost, sub-25ms response)
    const cached = await getCachedWordExercise(word, "ar");
    if (cached?.examples && cached.examples.length >= 3) {
      return NextResponse.json(
        {
          word,
          examples: cached.examples.slice(0, 3),
          provider: "cache",
        },
        { headers: corsHeaders },
      );
    }

    // 1. Primary: AI-generated authentic examples (Gemini / OpenAI)
    const systemPrompt = `You are an expert English language teacher creating sentence examples for an English learner.
Generate exactly 3 diverse, natural, practical example sentences using the target word.
Return ONLY valid JSON with this exact key:
{
  "examples": [
    "Sentence 1 showing everyday usage.",
    "Sentence 2 showing a workplace or study context.",
    "Sentence 3 showing another natural situation."
  ]
}
Rules:
- Each sentence must be between 8 and 20 words.
- Use clear, modern English that an intermediate learner can understand.
- The target word (or its natural grammatical inflection) must appear in each sentence.
- The 3 sentences must cover different contexts (e.g. work/study, daily conversation, life experience).`;

    const userPrompt = `Target English word: "${word}"\nPart of speech: ${partOfSpeech || "unspecified"}\nDefinition hint: ${definition || "general meaning"}`;

    const aiRes = await callAiJson<unknown>(systemPrompt, userPrompt);
    if (aiRes) {
      const checked = aiResponseSchema.safeParse(aiRes.data);
      if (checked.success) {
        const exs = checked.data.examples.slice(0, 3);
        void saveWordExerciseToCache({
          word,
          targetLang: "ar",
          examples: exs,
          definition,
          partOfSpeech,
        });

        return NextResponse.json(
          {
            word,
            examples: exs,
            provider: aiRes.provider,
          },
          { headers: corsHeaders },
        );
      }
    }

    // 2. Secondary fallback: Authentic Google Translate dictionary example sentences
    const dictExamples = await fetchDictionaryExamples(word);
    if (dictExamples.length >= 3) {
      const exs = dictExamples.slice(0, 3);
      void saveWordExerciseToCache({
        word,
        targetLang: "ar",
        examples: exs,
        definition,
        partOfSpeech,
      });

      return NextResponse.json(
        {
          word,
          examples: exs,
          provider: "dictionary",
        },
        { headers: corsHeaders },
      );
    }

    // 3. Fallback: Curated structural templates
    const templates = buildTemplateExamples(word, partOfSpeech);
    const combined = Array.from(new Set([...dictExamples, ...templates])).slice(0, 3);

    void saveWordExerciseToCache({
      word,
      targetLang: "ar",
      examples: combined,
      definition,
      partOfSpeech,
    });

    return NextResponse.json(
      {
        word,
        examples: combined,
        provider: "templates",
      },
      { headers: corsHeaders },
    );
  } catch (err) {
    console.error("Sentence examples API error:", err);
    return NextResponse.json(
      { error: "Failed to generate sentence examples." },
      { status: 500, headers: corsHeaders },
    );
  }
}

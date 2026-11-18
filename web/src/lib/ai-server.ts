/**
 * Server-only AI provider helper (Gemini or OpenAI) using native fetch.
 * NEVER import this module in client components.
 */

export type AiJsonResult<T> = {
  data: T;
  provider: "gemini" | "openai";
};

export function getConfiguredAiProvider(): "gemini" | "openai" | null {
  if (process.env.GEMINI_API_KEY?.trim()) return "gemini";
  if (process.env.OPENAI_API_KEY?.trim()) return "openai";
  return null;
}

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  // Strip markdown code fences if present
  const cleaned = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  return JSON.parse(cleaned);
}

export async function callAiJson<T>(
  systemPrompt: string,
  userPrompt: string,
  timeoutMs = 12_000,
): Promise<AiJsonResult<T> | null> {
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (geminiKey) {
    try {
      const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(geminiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(timeoutMs),
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            generationConfig: {
              temperature: 0.4,
              responseMimeType: "application/json",
            },
          }),
        },
      );

      if (res.ok) {
        const payload = (await res.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          return { data: extractJsonObject(text) as T, provider: "gemini" };
        }
      }
    } catch (err) {
      console.warn("Gemini AI call failed, checking fallback:", err instanceof Error ? err.message : err);
    }
  }

  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  if (openaiKey) {
    try {
      const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify({
          model,
          temperature: 0.4,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });

      if (res.ok) {
        const payload = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const text = payload.choices?.[0]?.message?.content;
        if (text) {
          return { data: extractJsonObject(text) as T, provider: "openai" };
        }
      }
    } catch (err) {
      console.warn("OpenAI AI call failed, checking fallback:", err instanceof Error ? err.message : err);
    }
  }

  return null;
}

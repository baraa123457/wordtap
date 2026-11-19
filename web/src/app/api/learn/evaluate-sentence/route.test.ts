import { describe, it, expect } from "vitest";
import { POST } from "./route";

describe("POST /api/learn/evaluate-sentence", () => {
  it("rejects 'i will study portion of lesson' with low score and corrections", { timeout: 15000 }, async () => {
    const req = new Request("http://localhost:3000/api/learn/evaluate-sentence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        word: "Portion",
        sentence: "i will study portion of lesson",
        partOfSpeech: "Noun · اسم",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.isCorrect).toBe(false);
    expect(data.grammarScore).toBeLessThan(75);
    expect(data.grammarCorrections.length).toBeGreaterThanOrEqual(2);
    expect(data.grammarCorrections.some((c: string) => c.includes("portion"))).toBe(true);
    expect(data.grammarCorrections.some((c: string) => c.includes("lesson"))).toBe(true);
    expect(data.naturalAlternative).toBe("I will study a portion of the lesson.");
  });

  it("accepts 'i will study a portion of the lesson' with 100/100", { timeout: 15000 }, async () => {
    const req = new Request("http://localhost:3000/api/learn/evaluate-sentence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        word: "Portion",
        sentence: "i will study a portion of the lesson",
        partOfSpeech: "Noun · اسم",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.isCorrect).toBe(true);
    expect(data.grammarScore).toBe(100);
    expect(data.grammarCorrections).toHaveLength(0);
  });

  it("accepts informal 'i wanna study a portion of the lesson' with 100/100", { timeout: 15000 }, async () => {
    const req = new Request("http://localhost:3000/api/learn/evaluate-sentence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        word: "Portion",
        sentence: "i wanna study a portion of the lesson",
        partOfSpeech: "Noun · اسم",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.isCorrect).toBe(true);
    expect(data.grammarScore).toBe(100);
    expect(data.grammarCorrections).toHaveLength(0);
  });

  it("accepts 'I accumulated a lot of English vocabulary last Thursday' with 100/100", { timeout: 15000 }, async () => {
    const req = new Request("http://localhost:3000/api/learn/evaluate-sentence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        word: "accumulated",
        sentence: "I accumulated a lot of English vocabulary last Thursday",
        partOfSpeech: "Verb · فعل",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.isCorrect).toBe(true);
    expect(data.grammarScore).toBe(100);
    expect(data.grammarCorrections).toHaveLength(0);
  });
});

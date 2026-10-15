import { describe, expect, it } from "vitest";
import type { Word } from "./schemas";
import { buildSession, selectWords, shuffle } from "./session";

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function makeWord(i: number, patch: Partial<Word> = {}): Word {
  return {
    id: `w${i}`,
    text: `word${i}`,
    translation: `trans${i}`,
    src_lang: "en",
    target_lang: "ar",
    source_title: "Some show",
    source_url: "",
    times_seen: 1,
    box: 0,
    next_review: "2020-01-01T00:00:00Z",
    correct_count: 0,
    wrong_count: 0,
    last_practiced: null,
    created_at: "2020-01-01T00:00:00Z",
    ...patch,
  };
}

const NOW = new Date("2026-01-01T00:00:00Z");

describe("shuffle", () => {
  it("keeps every item and does not mutate the input", () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffle(input, seeded(1));
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("selectWords", () => {
  it("puts due words before words that are not due yet", () => {
    const words = [
      makeWord(1, { next_review: "2030-01-01T00:00:00Z" }),
      makeWord(2),
      makeWord(3, { next_review: "2030-01-01T00:00:00Z" }),
      makeWord(4),
    ];
    const picked = selectWords(words, 2, NOW, seeded(2)).map((w) => w.id);
    expect(picked.sort()).toEqual(["w2", "w4"]);
  });

  it("prefers weaker boxes among due words", () => {
    const words = [makeWord(1, { box: 4 }), makeWord(2, { box: 0 }), makeWord(3, { box: 2 })];
    expect(selectWords(words, 1, NOW, seeded(3))[0]?.id).toBe("w2");
  });
});

describe("buildSession", () => {
  const words = Array.from({ length: 10 }, (_, i) => makeWord(i));

  it("asks about at most `size` words and adds one matching round", () => {
    const qs = buildSession(words, { size: 6, now: NOW, rng: seeded(4) });
    const single = qs.filter((q) => q.type !== "match");
    expect(single).toHaveLength(6);
    expect(qs.filter((q) => q.type === "match")).toHaveLength(1);
  });

  it("never repeats a word across single questions", () => {
    const qs = buildSession(words, { size: 8, now: NOW, rng: seeded(5) });
    const ids = qs.flatMap((q) => (q.type === "match" ? [] : [q.wordId]));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("always includes the correct answer exactly once in choice options", () => {
    for (let seed = 1; seed <= 25; seed++) {
      const qs = buildSession(words, { size: 8, canSpeak: true, now: NOW, rng: seeded(seed) });
      for (const q of qs) {
        if (q.type !== "choice") continue;
        expect(q.options.filter((o) => o === q.answer)).toHaveLength(1);
        expect(new Set(q.options).size).toBe(q.options.length);
        expect(q.options.length).toBeGreaterThanOrEqual(2);
        expect(q.options.length).toBeLessThanOrEqual(4);
      }
    }
  });

  it("falls back to typing when there is nothing to pick as a wrong option", () => {
    const qs = buildSession([makeWord(1)], { now: NOW, rng: seeded(6) });
    expect(qs).toHaveLength(1);
    expect(qs[0]?.type).toBe("type");
  });

  it("skips the matching round for fewer than three words", () => {
    const qs = buildSession([makeWord(1), makeWord(2)], { now: NOW, rng: seeded(7) });
    expect(qs.some((q) => q.type === "match")).toBe(false);
  });

  it("only offers listening when speech is available and the language is known", () => {
    const noSpeech = buildSession(words, { size: 10, canSpeak: false, now: NOW, rng: seeded(8) });
    expect(noSpeech.some((q) => q.type === "choice" && q.variant === "listen")).toBe(false);

    const unknownLang = words.map((w) => ({ ...w, src_lang: "auto" }));
    for (let seed = 1; seed <= 20; seed++) {
      const qs = buildSession(unknownLang, { size: 10, canSpeak: true, now: NOW, rng: seeded(seed) });
      expect(qs.some((q) => q.type === "choice" && q.variant === "listen")).toBe(false);
    }
  });

  it("returns nothing for an empty library", () => {
    expect(buildSession([], { now: NOW })).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import type { Word } from "./schemas";
import { buildSession, makeClozePrompt, makeScrambleTiles, selectWords, shuffle } from "./session";

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

  it("always presents English word as prompt and Arabic as choices for recognition questions", () => {
    const arabicWords = [
      makeWord(1, { text: "humble", translation: "متواضع", src_lang: "en", target_lang: "ar", box: 0 }),
      makeWord(2, { text: "proud", translation: "فخور", src_lang: "en", target_lang: "ar", box: 0 }),
      makeWord(3, { text: "polite", translation: "مهذب", src_lang: "en", target_lang: "ar", box: 0 }),
      makeWord(4, { text: "brave", translation: "شجاع", src_lang: "en", target_lang: "ar", box: 0 }),
    ];
    const qs = buildSession(arabicWords, { size: 4, canSpeak: true, mode: "choice", now: NOW });
    const choiceQuestions = qs.filter((q) => q.type === "choice");
    for (const q of choiceQuestions) {
      if (q.type === "choice") {
        expect(q.variant).toBe("to-translation");
        expect(q.prompt).not.toMatch(/[\u0600-\u06FF]/); // English prompt
        expect(q.answer).toMatch(/[\u0600-\u06FF]/); // Arabic answer
        expect(q.speak?.text).toBe(q.prompt);
        expect(q.speak?.lang).toBe("en");
      }
    }
  });

  it("returns nothing for an empty library", () => {
    expect(buildSession([], { now: NOW })).toEqual([]);
  });

  describe("Pedagogical Practice Ladder", () => {
    it("assigns multiple choice (to-translation) for new words in box 0 and 1", () => {
      const newWords = [
        makeWord(1, { box: 0, text: "novel", translation: "رواية" }),
        makeWord(2, { box: 1, text: "story", translation: "قصة" }),
      ];
      const qs = buildSession(newWords, { size: 2, now: NOW, rng: seeded(10) });
      const nonMatch = qs.filter((q) => q.type !== "match");
      for (const q of nonMatch) {
        expect(q.type).toBe("choice");
        if (q.type === "choice") {
          expect(q.variant).toBe("to-translation");
        }
      }
    });

    it("assigns cloze fill-in-the-blank for learning words in box 2 with sentence", () => {
      const box2Words = [
        makeWord(1, {
          box: 2,
          text: "wondering",
          translation: "أتساءل",
          source_title: '"I was wondering if you could help" — YouTube',
        }),
        makeWord(2, {
          box: 2,
          text: "helping",
          translation: "مساعدة",
          source_title: '"Thank you for helping me" — YouTube',
        }),
      ];
      const qs = buildSession(box2Words, { size: 1, canSpeak: false, now: NOW, rng: seeded(11) });
      expect(qs[0]?.type).toBe("choice");
      if (qs[0]?.type === "choice") {
        expect(qs[0].variant).toBe("cloze");
        expect(qs[0].prompt).toContain("______");
      }
    });

    it("assigns scramble letter tiles for almost-known words in box 3", () => {
      const box3Words = [
        makeWord(1, { box: 3, text: "puzzle", translation: "لغز" }),
      ];
      const qs = buildSession(box3Words, { size: 1, now: NOW, rng: seeded(12) });
      expect(qs[0]?.type).toBe("scramble");
      if (qs[0]?.type === "scramble") {
        expect(qs[0].answer).toBe("puzzle");
        expect(qs[0].tiles).toHaveLength(6);
      }
    });

    it("assigns production typing for known words in box 4 and 5", () => {
      const box4Words = [
        makeWord(1, { box: 4, text: "mastered", translation: "متقن" }),
        makeWord(2, { box: 5, text: "fluent", translation: "فصيح" }),
      ];
      const qs = buildSession(box4Words, { size: 2, now: NOW, rng: seeded(13) });
      const nonMatch = qs.filter((q) => q.type !== "match");
      for (const q of nonMatch) {
        expect(q.type).toBe("type");
        if (q.type === "type") {
          expect(q.variant).toBe("to-word");
        }
      }
    });
  });

  describe("makeClozePrompt and makeScrambleTiles", () => {
    it("replaces target word with blank in sentence", () => {
      expect(makeClozePrompt("I was wondering if you could help", "wondering")).toBe(
        "I was ______ if you could help",
      );
    });

    it("creates shuffled letter tiles with unique IDs", () => {
      const tiles = makeScrambleTiles("word", seeded(14));
      expect(tiles).toHaveLength(4);
      expect(tiles.map((t) => t.char).sort()).toEqual(["d", "o", "r", "w"]);
      expect(new Set(tiles.map((t) => t.id)).size).toBe(4);
    });
  });
});

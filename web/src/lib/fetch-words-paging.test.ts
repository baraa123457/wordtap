import { describe, expect, it, vi } from "vitest";

// A fake Supabase that behaves like the real one: it never returns more than 1000 rows per request.
const TOTAL = 2500;
const calls: Array<[number, number]> = [];

vi.mock("./supabase", () => ({
  getSupabase: () => ({
    from: () => {
      let range: [number, number] = [0, 999];
      const q = {
        select: () => q,
        order: () => q,
        range: (from: number, to: number) => {
          range = [from, to];
          calls.push(range);
          const end = Math.min(to, from + 999, TOTAL - 1);
          const data = [];
          for (let i = from; i <= end; i++) {
            data.push({ id: `w${i}`, text: `word${i}`, translation: `t${i}`, src_lang: "en", target_lang: "ar",
              times_seen: 0, box: 0, next_review: "2026-01-01", correct_count: 0, wrong_count: 0, last_practiced: null, created_at: "2026-01-01" });
          }
          return Promise.resolve({ data, error: null });
        },
      };
      return q;
    },
  }),
}));

import { fetchWords } from "./api";

describe("fetchWords paging", () => {
  it("returns ALL words, not just the first 1000", async () => {
    const words = await fetchWords();
    expect(words).toHaveLength(TOTAL);
    expect(new Set(words.map((w) => w.id)).size).toBe(TOTAL); // no duplicates
    expect(calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });
});

/**
 * Normalizes text for answer checking: lower-case, no diacritics (including Arabic
 * tashkeel), unified Arabic letter variants, no punctuation, single spaces.
 */
export function normalizeAnswer(input: string): string {
  return input
    .normalize("NFKD")
    .toLowerCase()
    .replace(/ـ/g, "") // tatweel
    .replace(/\p{M}/gu, "") // combining marks and Arabic diacritics
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min((cur[j - 1] ?? 0) + 1, (prev[j] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
    }
    prev = cur;
  }
  return prev[b.length] ?? 0;
}

export type TypedResult = "correct" | "typo" | "wrong";

/** A one-letter slip is accepted as a typo for answers of five or more characters. */
export function checkTyped(input: string, answer: string): TypedResult {
  const given = normalizeAnswer(input);
  const wanted = normalizeAnswer(answer);
  if (given === "" || wanted === "") return "wrong";
  if (given === wanted) return "correct";
  if (wanted.length >= 5 && levenshtein(given, wanted) <= 1) return "typo";
  return "wrong";
}

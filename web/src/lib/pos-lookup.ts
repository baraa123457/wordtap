"use client";

import { useEffect, useState } from "react";
import type { Word } from "./schemas";

const posCache = new Map<string, string>();

async function lookupEnglishPos(text: string): Promise<string> {
  const clean = text.trim().toLowerCase();
  if (!clean || clean.includes(" ")) return "";
  if (posCache.has(clean)) return posCache.get(clean) || "";

  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(clean)}`,
      { signal: AbortSignal.timeout(3000) },
    );
    if (!res.ok) {
      posCache.set(clean, "");
      return "";
    }
    const data = (await res.json()) as Array<{
      meanings?: Array<{ partOfSpeech?: string }>;
    }>;
    const pos = data?.[0]?.meanings?.[0]?.partOfSpeech?.trim() || "";
    posCache.set(clean, pos);
    return pos;
  } catch {
    return "";
  }
}

export function usePartOfSpeech(word: Pick<Word, "text" | "part_of_speech" | "src_lang"> | undefined): string {
  const existing = (word?.part_of_speech || "").trim();
  const text = word?.text || "";
  const srcLang = word?.src_lang || "en";
  const [fetchedPos, setFetchedPos] = useState("");

  useEffect(() => {
    setFetchedPos("");
    if (existing || !text || srcLang !== "en") return;
    const cached = posCache.get(text.trim().toLowerCase());
    if (cached !== undefined) {
      setFetchedPos(cached);
      return;
    }
    let active = true;
    void lookupEnglishPos(text).then((pos) => {
      if (active && pos) setFetchedPos(pos);
    });
    return () => {
      active = false;
    };
  }, [existing, text, srcLang]);

  return existing || fetchedPos;
}

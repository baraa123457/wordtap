import { NextResponse } from "next/server";
import { guardApiRequest } from "@/lib/api-guard";
import { getVerbConjugation } from "@/lib/verbs";

const MAX_TRANSLATE_CHARS = 2000;

type GoogleTranslateData = unknown[];

type SpellCorrection = {
  originalText: string;
  correctedText: string;
  autoCorrected: boolean;
};

function getErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export async function GET(req: Request) {
  const blocked = guardApiRequest(req, "translate", 60);
  if (blocked) return blocked;

  const url = new URL(req.url);
  const text = (url.searchParams.get("text") || "").trim().slice(0, MAX_TRANSLATE_CHARS);
  const src = url.searchParams.get("src") || "auto";
  const target = url.searchParams.get("target") || "ar";
  const forceExact = url.searchParams.get("forceExact") === "true";
  const provider = (url.searchParams.get("provider") || "google").toLowerCase();
  return handleTranslate(text, src, target, forceExact, provider);
}

export async function POST(req: Request) {
  const blocked = guardApiRequest(req, "translate", 60);
  if (blocked) return blocked;

  try {
    const body = (await req.json()) as {
      text?: string;
      src?: string;
      target?: string;
      forceExact?: boolean;
      provider?: string;
    };
    const text = (body.text || "").trim().slice(0, MAX_TRANSLATE_CHARS);
    const src = body.src || "auto";
    const target = body.target || "ar";
    const forceExact = Boolean(body.forceExact);
    const provider = (body.provider || "google").toLowerCase();
    return handleTranslate(text, src, target, forceExact, provider);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(err, "Invalid JSON") },
      { status: 400 },
    );
  }
}

function levenshtein(a: string, b: string): number {
  const an = a.length;
  const bn = b.length;
  if (an === 0) return bn;
  if (bn === 0) return an;
  const matrix: number[][] = Array.from({ length: bn + 1 }, () => Array<number>(an + 1).fill(0));
  for (let i = 0; i <= an; ++i) matrix[0]![i] = i;
  for (let i = 1; i <= bn; ++i) matrix[i]![0] = i;
  for (let i = 1; i <= bn; ++i) {
    for (let j = 1; j <= an; ++j) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i]![j] = matrix[i - 1]![j - 1]!;
      } else {
        matrix[i]![j] = Math.min(
          matrix[i - 1]![j - 1]! + 1,
          Math.min(matrix[i]![j - 1]! + 1, matrix[i - 1]![j]! + 1),
        );
      }
    }
  }
  return matrix[bn]![an]!;
}

async function findSuggestCorrection(text: string): Promise<string | null> {
  const clean = text.trim();
  if (!clean || clean.length < 3 || clean.length > 50) return null;
  const lowerInput = clean.toLowerCase();

  try {
    const suggestUrl = `https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(clean)}`;
    const sRes = await fetch(suggestUrl, {
      signal: AbortSignal.timeout(2000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    if (!sRes.ok) return null;
    const sData = (await sRes.json()) as unknown[];
    const suggestions = Array.isArray(sData?.[1]) ? sData[1] : [];

    let bestCandidate: string | null = null;
    let lowestDist = 999;

    for (const raw of suggestions) {
      if (typeof raw !== "string") continue;
      const stripped = raw
        .replace(/[\u0600-\u06FF]+/g, "")
        .replace(
          /\b(meaning|translate|translation|definition|synonyms?|antonyms?|in python|in java|movie|film)\b/gi,
          "",
        )
        .replace(/[^a-zA-Z\s'-]/g, "")
        .trim();
      if (!stripped) continue;

      const tokens = stripped.split(/\s+/).filter(Boolean);
      const isSingle = !lowerInput.includes(" ");
      const candidateList = isSingle ? [tokens[0]].filter(Boolean) : [stripped, tokens[0]];

      for (const cand of candidateList) {
        if (!cand) continue;
        const candLower = cand.toLowerCase();
        if (!candLower || candLower === lowerInput) continue;
        const dist = levenshtein(lowerInput, candLower);
        const maxLen = Math.max(lowerInput.length, candLower.length);
        const similarity = 1 - dist / maxLen;

        const maxAllowedDist = maxLen >= 7 ? 4 : 3;
        if (dist <= maxAllowedDist && similarity >= 0.55) {
          if (dist < lowestDist) {
            lowestDist = dist;
            bestCandidate = candLower;
          }
        }
      }
    }

    return bestCandidate;
  } catch {
    return null;
  }
}

function normalizePartOfSpeech(raw: string): string {
  const p = raw.toLowerCase().replace(/[^a-z_-]/g, "");
  if (p === "n" || p === "noun") return "noun";
  if (p === "v" || p === "verb" || p.startsWith("v-") || p === "vt" || p === "vi") return "verb";
  if (p === "adj" || p === "adjective") return "adjective";
  if (p === "adv" || p === "adverb") return "adverb";
  if (p === "prep" || p === "preposition") return "preposition";
  if (p === "conj" || p === "conjunction") return "conjunction";
  if (p === "pron" || p === "pronoun") return "pronoun";
  if (p === "phrase" || p === "phr") return "phrase";
  if (p === "idiom") return "idiom";
  if (p === "past") return "past";
  if (p === "present") return "present";
  if (p === "past_participle") return "past_participle";
  if (p === "continuous") return "continuous";
  return "";
}

async function handleTranslate(
  text: string,
  src: string,
  target: string,
  forceExact = false,
  provider = "google",
) {
  try {
    if (!text) {
      return NextResponse.json({
        text: "",
        translation: "",
        detectedSrcLang: src === "auto" ? "en" : src,
        sourcePronunciation: "",
        targetPronunciation: "",
        definitions: [],
        sourceDefinitions: [],
        correction: null,
        provider,
      });
    }

    // -------------------------------------------------------------------------
    // Provider: U-Dictionary (Youdao Deep Dictionary API)
    // -------------------------------------------------------------------------
    if (provider === "udictionary") {
      try {
        const udictUrl = `https://dict.youdao.com/jsonapi?q=${encodeURIComponent(text)}`;
        const udictRes = await fetch(udictUrl, {
          signal: AbortSignal.timeout(6000),
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
        });

        let uData = udictRes.ok ? ((await udictRes.json()) as Record<string, unknown>) : null;

        // Dynamic Did-You-Mean Spell Suggestion
        let correction: SpellCorrection | null = null;
        let queryWord = text;
        const hasDirectDefs = Boolean(uData?.ee || uData?.collins);

        if (!forceExact) {
          const candidate = await findSuggestCorrection(text);
          if (candidate && candidate.toLowerCase() !== text.trim().toLowerCase()) {
            correction = {
              correctedText: candidate,
              originalText: text,
              autoCorrected: false,
            };

            // If the original misspelled query has no direct dictionary entry, load definitions for the suggested word!
            if (!hasDirectDefs) {
              queryWord = candidate;
              try {
                const candRes = await fetch(
                  `https://dict.youdao.com/jsonapi?q=${encodeURIComponent(candidate)}`,
                  {
                    signal: AbortSignal.timeout(4000),
                    headers: {
                      "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    },
                  },
                );
                if (candRes.ok) {
                  uData = (await candRes.json()) as Record<string, unknown>;
                }
              } catch {}
            }
          }
        }

        if (uData) {
          const simple = uData.simple as { word?: Array<{ usphone?: string; ukphone?: string }> } | undefined;
          const usphone = simple?.word?.[0]?.usphone || simple?.word?.[0]?.ukphone || "";
          const sourcePronunciation = usphone ? `/${usphone}/` : "";

          // 1. Extract Monolingual Source Definitions (English definitions of the source word)
          const sourceDefinitions: Array<{ partOfSpeech: string; text: string }> = [];
          const ee = uData.ee as {
            word?: {
              trs?: Array<{
                pos?: string;
                tr?: Array<{ l?: { i?: string }; i?: string }>;
              }>;
            };
          } | undefined;

          if (Array.isArray(ee?.word?.trs)) {
            for (const item of ee.word.trs) {
              const pos = normalizePartOfSpeech(item.pos || "") || "noun";
              if (Array.isArray(item.tr)) {
                for (const t of item.tr) {
                  const m = t.l?.i || (typeof t.i === "string" ? t.i : "");
                  if (m && typeof m === "string") {
                    const clean = m.trim();
                    if (clean && !sourceDefinitions.some((sd) => sd.text === clean)) {
                      sourceDefinitions.push({ partOfSpeech: pos, text: clean });
                    }
                  }
                }
              }
            }
          }

          // Extract Collins English definitions if available
          const collins = uData.collins as {
            collins_entries?: Array<{
              entries?: {
                entry?: Array<{
                  pos_entry?: { pos?: string };
                  tran_entry?: Array<{ tran?: string }>;
                }>;
              };
            }>;
          } | undefined;

          const cEntries = collins?.collins_entries?.[0]?.entries?.entry || [];
          for (const ce of cEntries) {
            const pos = normalizePartOfSpeech(ce.pos_entry?.pos || "") || "verb";
            for (const te of ce.tran_entry || []) {
              if (te.tran) {
                const clean = String(te.tran).replace(/<[^>]+>/g, "").trim();
                if (clean && !sourceDefinitions.some((sd) => sd.text === clean)) {
                  sourceDefinitions.push({ partOfSpeech: pos, text: clean });
                }
              }
            }
          }

          // Extract authentic example sentences
          const authSents = uData.auth_sents_part as {
            sent?: Array<{ foreign?: string; source?: string }>;
          } | undefined;

          const examples = (authSents?.sent || [])
            .slice(0, 3)
            .map((s) => ({
              sentence: String(s.foreign || "").replace(/<[^>]+>/g, "").trim(),
              source: String(s.source || "").replace(/<[^>]+>/g, "").trim(),
            }))
            .filter((ex) => Boolean(ex.sentence));

          // 2. Extract Bilingual Target Alternative Translations (e.g. Arabic words)
          let translation = "";
          const targetAlternatives: Array<{ partOfSpeech: string; meanings: string[] }> = [];

          const ec = uData.ec as {
            word?: Array<{ trs?: Array<{ tr?: Array<{ l?: { i?: string[] } }> }> }>;
          } | undefined;

          if (target.startsWith("zh")) {
            translation = ec?.word?.[0]?.trs?.[0]?.tr?.[0]?.l?.i?.[0] || "";
          }

          const translateQuery = !hasDirectDefs && queryWord ? queryWord : text;
          try {
            const transUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(
              src,
            )}&tl=${encodeURIComponent(target)}&dt=t&dt=bd&q=${encodeURIComponent(translateQuery)}`;
            const transRes = await fetch(transUrl, { signal: AbortSignal.timeout(4000) });
            if (transRes.ok) {
              const transData = await transRes.json();
              if (!translation) {
                translation = Array.isArray(transData?.[0])
                  ? transData[0].map((p: [string]) => p[0]).join("")
                  : "";
              }
              if (Array.isArray(transData?.[1])) {
                for (const g of transData[1]) {
                  if (Array.isArray(g) && typeof g[0] === "string" && Array.isArray(g[1])) {
                    const pos = normalizePartOfSpeech(g[0]) || g[0].toLowerCase();
                    const meanings = g[1]
                      .filter((m: unknown): m is string => typeof m === "string" && Boolean(m.trim()))
                      .slice(0, 8);
                    if (meanings.length > 0) {
                      targetAlternatives.push({ partOfSpeech: pos, meanings });
                    }
                  }
                }
              }
            }
          } catch {}

          const verbInfo = getVerbConjugation(queryWord);
          const posSet = new Set<string>();
          for (const sd of sourceDefinitions) {
            if (sd.partOfSpeech) posSet.add(sd.partOfSpeech);
          }
          for (const alt of targetAlternatives) {
            if (alt.partOfSpeech) posSet.add(alt.partOfSpeech);
          }
          if (verbInfo) posSet.add("verb");
          const partsOfSpeech = Array.from(posSet);

          return NextResponse.json({
            text,
            translation: translation || text,
            detectedSrcLang: src === "auto" ? "en" : src,
            sourcePronunciation,
            targetPronunciation: "",
            definitions: targetAlternatives,
            sourceDefinitions,
            partsOfSpeech,
            primaryPartOfSpeech: partsOfSpeech[0] || null,
            correction,
            verbInfo,
            examples,
            provider: "udictionary",
          });
        }
      } catch (uErr) {
        console.warn("U-Dictionary lookup failed, falling back to Google:", uErr);
      }
    }

    // -------------------------------------------------------------------------
    // Provider: Google Translate (Default primary)
    // -------------------------------------------------------------------------
    const dtParams = forceExact
      ? "&dt=t&dt=bd&dt=rm&dt=at&dt=rw"
      : "&dt=t&dt=bd&dt=rm&dt=qca&dt=sp&dt=at&dt=rw";

    const url = `https://translate.googleapis.com/translate_a/single?client=dict-chrome-ex&sl=${encodeURIComponent(
      src,
    )}&tl=${encodeURIComponent(target)}${dtParams}&q=${encodeURIComponent(text)}`;

    let data: GoogleTranslateData | null = null;
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(6000),
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });

      if (res.ok) {
        data = (await res.json()) as GoogleTranslateData;
      }
    } catch (err: unknown) {
      console.warn("Google translate primary fetch error, trying gtx fallback:", err);
    }

    // Resilient fallback to secondary gtx client if primary was throttled or failed
    if (!data) {
      try {
        const fallbackUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(
          src,
        )}&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(text)}`;
        const fbRes = await fetch(fallbackUrl, {
          signal: AbortSignal.timeout(5000),
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
        });
        if (fbRes.ok) {
          data = (await fbRes.json()) as GoogleTranslateData;
        }
      } catch (fbErr: unknown) {
        console.warn("Google translate fallback error:", fbErr);
      }
    }

    let correction: {
      correctedText: string;
      originalText: string;
      autoCorrected: boolean;
    } | null = null;

    const isLatinInput = /^[a-zA-Z\s'-]+$/.test(text);

    if (
      !forceExact &&
      data &&
      Array.isArray(data[7]) &&
      data[7].length >= 2 &&
      typeof data[7][1] === "string" &&
      data[7][1].trim()
    ) {
      const clean = data[7][1].replace(/<[^>]+>/g, "").trim();
      const isLatinCorrection = /^[a-zA-Z\s'-]+$/.test(clean);
      if ((!isLatinInput || isLatinCorrection) && clean.toLowerCase() !== text.toLowerCase()) {
        correction = {
          correctedText: clean,
          originalText: text,
          autoCorrected: Boolean(data[7][5]),
        };
      }
    }

    // Retry with sl=en to surface spell correction when auto-detect misclassifies an English typo
    if (
      !forceExact &&
      !correction &&
      (src === "auto" || src === "en") &&
      isLatinInput
    ) {
      try {
        const enUrl = `https://translate.googleapis.com/translate_a/single?client=dict-chrome-ex&sl=en&tl=${encodeURIComponent(
          target,
        )}&dt=t&dt=bd&dt=rm&dt=qca&dt=sp&q=${encodeURIComponent(text)}`;
        const enRes = await fetch(enUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
        });
        if (enRes.ok) {
          const enData = (await enRes.json()) as GoogleTranslateData;
          if (
            Array.isArray(enData[7]) &&
            enData[7].length >= 2 &&
            typeof enData[7][1] === "string" &&
            enData[7][1].trim()
          ) {
            const clean = enData[7][1].replace(/<[^>]+>/g, "").trim();
            const isLatinCorrection = /^[a-zA-Z\s'-]+$/.test(clean);
            if ((!isLatinInput || isLatinCorrection) && clean.toLowerCase() !== text.toLowerCase()) {
              data = enData;
              correction = {
                correctedText: clean,
                originalText: text,
                autoCorrected: Boolean(enData[7][5]),
              };
            }
          }
        }
      } catch {
        // ignore retry error
      }
    }

    if (data && Array.isArray(data[0])) {
      let translation = "";
      let sourcePronunciation = "";
      let targetPronunciation = "";

      for (const item of data[0]) {
        if (!Array.isArray(item)) continue;
        if (typeof item[0] === "string") {
          translation += item[0];
        }
        if (item[0] === null) {
          if (typeof item[2] === "string") targetPronunciation = item[2];
          if (typeof item[3] === "string") sourcePronunciation = item[3];
        }
      }

      const definitions: Array<{ partOfSpeech: string; meanings: string[] }> = [];
      if (Array.isArray(data[1])) {
        for (const entry of data[1]) {
          if (Array.isArray(entry) && typeof entry[0] === "string" && Array.isArray(entry[1])) {
            definitions.push({
              partOfSpeech: entry[0],
              meanings: entry[1]
                .filter((m: unknown): m is string => typeof m === "string")
                .slice(0, 5),
            });
          }
        }
      }

      const headword = Array.isArray(data[1]) && Array.isArray(data[1][0]) ? data[1][0][3] : undefined;
      const hasDict = Array.isArray(data[1]) && data[1].length > 0;
      const isEcho = translation.trim().toLowerCase() === text.trim().toLowerCase();
      const headwordDiffers =
        hasDict &&
        typeof headword === "string" &&
        headword.trim().toLowerCase() !== text.trim().toLowerCase();

      if (!forceExact && !correction && headwordDiffers && typeof headword === "string") {
        correction = {
          correctedText: headword.trim(),
          originalText: text,
          autoCorrected: false,
        };
      }

      const isLikelyTypo = !hasDict || isEcho || headwordDiffers;
      if (!forceExact && !correction && isLikelyTypo) {
        const candidate = await findSuggestCorrection(text);
        if (candidate) {
          correction = {
            correctedText: candidate,
            originalText: text,
            autoCorrected: false,
          };

          if (isEcho) {
            try {
              const candUrl = `https://translate.googleapis.com/translate_a/single?client=dict-chrome-ex&sl=auto&tl=${encodeURIComponent(
                target,
              )}&dt=t&dt=bd&dt=rm&q=${encodeURIComponent(candidate)}`;
              const candRes = await fetch(candUrl, {
                signal: AbortSignal.timeout(2500),
                headers: {
                  "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                },
              });
              if (candRes.ok) {
                const candData = (await candRes.json()) as GoogleTranslateData;
                if (
                  candData &&
                  Array.isArray(candData[0]) &&
                  Array.isArray(candData[0][0]) &&
                  typeof candData[0][0][0] === "string"
                ) {
                  translation = candData[0][0][0];
                  if (Array.isArray(candData[0][1])) {
                    if (typeof candData[0][1][2] === "string") targetPronunciation = candData[0][1][2];
                    if (typeof candData[0][1][3] === "string") sourcePronunciation = candData[0][1][3];
                  }
                  correction.autoCorrected = true;
                }
              }
            } catch {
              // ignore candidate translation error
            }
          }
        }
      }

      if (Array.isArray(data[5])) {
        for (const group of data[5]) {
          if (Array.isArray(group) && Array.isArray(group[2])) {
            const altMeanings: string[] = [];
            for (const item of group[2]) {
              if (Array.isArray(item) && typeof item[0] === "string" && item[0].trim()) {
                const alt = item[0].trim();
                if (!altMeanings.includes(alt) && alt.toLowerCase() !== translation.trim().toLowerCase()) {
                  altMeanings.push(alt);
                }
              }
            }
            if (altMeanings.length > 0) {
              const existingAlt = definitions.find((d) => d.partOfSpeech === "alternatives");
              if (existingAlt) {
                for (const m of altMeanings) {
                  if (!existingAlt.meanings.includes(m)) existingAlt.meanings.push(m);
                }
              } else {
                definitions.push({
                  partOfSpeech: "alternatives",
                  meanings: altMeanings.slice(0, 6),
                });
              }
            }
          }
        }
      }

      const detectedSrcLang =
        correction && correction.autoCorrected
          ? "en"
          : typeof data[2] === "string"
          ? data[2]
          : src === "auto"
          ? "en"
          : src;

      if (
        definitions.length === 0 &&
        text.trim().length >= 2 &&
        text.trim().length <= 40 &&
        !text.trim().includes(" ")
      ) {
        try {
          const dictUrl = `https://translate.googleapis.com/translate_a/single?client=dict-chrome-ex&sl=auto&tl=en&dt=bd&q=${encodeURIComponent(
            text.trim(),
          )}`;
          const dRes = await fetch(dictUrl, {
            signal: AbortSignal.timeout(2000),
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
          });
          if (dRes.ok) {
            const dJson = (await dRes.json()) as GoogleTranslateData;
            if (Array.isArray(dJson[1])) {
              for (const entry of dJson[1]) {
                if (Array.isArray(entry) && typeof entry[0] === "string" && Array.isArray(entry[1])) {
                  definitions.push({
                    partOfSpeech: entry[0],
                    meanings: entry[1]
                      .filter((m: unknown): m is string => typeof m === "string")
                      .slice(0, 5),
                  });
                }
              }
            }
          }
        } catch {
          // ignore dict error
        }
      }

      let verbBaseHint: string | undefined;
      if (Array.isArray(data[14]) && Array.isArray(data[14][0]) && typeof data[14][0][0] === "string") {
        verbBaseHint = data[14][0][0];
      } else if (typeof headword === "string") {
        verbBaseHint = headword;
      }

      let hasVerbInGoogleDef = false;
      const sourceDefinitions: Array<{ partOfSpeech: string; text: string }> = [];
      if (Array.isArray(data[12])) {
        for (const group of data[12]) {
          if (Array.isArray(group) && typeof group[0] === "string" && Array.isArray(group[1])) {
            const pos = normalizePartOfSpeech(group[0]) || group[0].toLowerCase();
            if (pos === "verb") hasVerbInGoogleDef = true;
            for (const item of group[1]) {
              if (Array.isArray(item) && typeof item[0] === "string" && item[0].trim()) {
                sourceDefinitions.push({ partOfSpeech: pos, text: item[0].trim() });
              }
            }
          }
        }
      }

      const verbInfo = getVerbConjugation(text, verbBaseHint);

      const posSet = new Set<string>();
      for (const d of definitions) {
        const norm = normalizePartOfSpeech(d.partOfSpeech);
        if (norm) posSet.add(norm);
      }
      for (const sd of sourceDefinitions) {
        const norm = normalizePartOfSpeech(sd.partOfSpeech);
        if (norm) posSet.add(norm);
      }
      if (verbInfo || hasVerbInGoogleDef) {
        posSet.add("verb");
        if (verbInfo) {
          for (const t of verbInfo.currentTenses) {
            if (t === "past") posSet.add("past");
            if (t === "past_participle") posSet.add("past_participle");
            if (t === "present_participle") posSet.add("continuous");
            if (t === "base") posSet.add("present");
          }
        }
      }
      const partsOfSpeech = Array.from(posSet);
      const primaryPartOfSpeech = partsOfSpeech[0] || null;

      return NextResponse.json({
        text,
        translation: translation || text,
        detectedSrcLang,
        sourcePronunciation,
        targetPronunciation,
        definitions,
        sourceDefinitions,
        partsOfSpeech,
        primaryPartOfSpeech,
        correction,
        verbInfo,
        provider: "google",
      });
    }

    // Secondary fallback: Free Google GTX single endpoint
    const gtxUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(
      src,
    )}&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(text)}`;
    const gtxRes = await fetch(gtxUrl, { signal: AbortSignal.timeout(4000) });
    if (gtxRes.ok) {
      const gtxData = await gtxRes.json();
      const translation = Array.isArray(gtxData?.[0])
        ? gtxData[0].map((p: [string]) => p[0]).join("")
        : text;
      return NextResponse.json({
        text,
        translation,
        detectedSrcLang: src === "auto" ? "en" : src,
        sourcePronunciation: "",
        targetPronunciation: "",
        definitions: [],
        sourceDefinitions: [],
        correction: null,
      });
    }

    throw new Error("All translation providers failed");
  } catch (err: unknown) {
    console.error("Translation API error:", err);
    return NextResponse.json(
      { error: getErrorMessage(err, "Translation failed") },
      { status: 500 },
    );
  }
}

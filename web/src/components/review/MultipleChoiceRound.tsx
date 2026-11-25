"use client";

import { useEffect, useMemo, useState } from "react";
import { canSpeak, speak } from "@/lib/speech";
import type { Word } from "@/lib/schemas";
import { SpeakerIcon } from "@/components/Icons";

function splitTranslations(raw: string): string[] {
  return raw
    .split(/[,،;/]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function shuffleItems<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

const FALLBACK_DISTRACTORS = [
  "تنظيم دقيق",
  "إلغاء رسمي",
  "تعبير واضح",
  "تحليل شامل",
];

function buildOptions(target: Word, allWords: Word[]): string[] {
  const targetMeanings = new Set(splitTranslations(target.translation));
  const targetPos = (target.part_of_speech || "").trim().toLowerCase();

  const candidates = allWords.filter((w) => {
    if (w.id === target.id) return false;
    const trans = w.translation.trim();
    if (!trans) return false;
    const parts = splitTranslations(trans);
    return !parts.some((p) => targetMeanings.has(p));
  });

  const samePos = targetPos
    ? shuffleItems(
        candidates.filter((w) => (w.part_of_speech || "").trim().toLowerCase() === targetPos),
      )
    : [];
  const otherPos = shuffleItems(
    candidates.filter((w) => !targetPos || (w.part_of_speech || "").trim().toLowerCase() !== targetPos),
  );

  const picked: string[] = [];
  const seen = new Set<string>([target.translation.trim().toLowerCase()]);

  for (const w of [...samePos, ...otherPos]) {
    if (picked.length >= 3) break;
    const clean = w.translation.trim();
    if (!seen.has(clean.toLowerCase())) {
      seen.add(clean.toLowerCase());
      picked.push(clean);
    }
  }

  for (const fb of FALLBACK_DISTRACTORS) {
    if (picked.length >= 3) break;
    if (!seen.has(fb.toLowerCase())) {
      seen.add(fb.toLowerCase());
      picked.push(fb);
    }
  }

  return shuffleItems([target.translation.trim(), ...picked.slice(0, 3)]);
}

export function MultipleChoiceRound({
  words,
  allWords,
  onComplete,
}: {
  words: Word[];
  allWords: Word[];
  onComplete: (results: Record<string, boolean>) => void;
}) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, boolean>>({});

  const current = words[index];

  const options = useMemo(
    () => (current ? buildOptions(current, allWords) : []),
    [current, allWords],
  );

  useEffect(() => {
    if (!current || !canSpeak()) return;
    const t = window.setTimeout(() => {
      speak(current.text, current.src_lang || "en");
    }, 80);
    return () => window.clearTimeout(t);
  }, [current]);

  if (!current) return null;

  const correctAnswer = current.translation.trim();

  const handleChoose = (opt: string) => {
    if (selected !== null) return;
    const isCorrect = opt.trim().toLowerCase() === correctAnswer.toLowerCase();
    setSelected(opt);
    const nextResults = { ...results, [current.id]: isCorrect };
    setResults(nextResults);

    window.setTimeout(() => {
      if (index + 1 >= words.length) {
        onComplete(nextResults);
      } else {
        setSelected(null);
        setIndex((i) => i + 1);
      }
    }, 650);
  };

  return (
    <section className="apple-card p-5 sm:p-7 grid gap-5 min-w-0">
      <div className="flex items-center justify-between gap-2 text-xs font-bold text-muted">
        <span className="rounded-full bg-subtitle/20 border border-subtitle/30 px-3 py-0.5 text-ink">
          Round 1 · Multiple Choice
        </span>
        <span className="tabular-nums">
          {index + 1} / {words.length}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <h2 dir="auto" className="text-2xl sm:text-3xl font-extrabold text-ink break-words">
          {current.text}
        </h2>
        {canSpeak() ? (
          <button
            type="button"
            onClick={() => speak(current.text, current.src_lang || "en")}
            aria-label={`Pronounce ${current.text}`}
            className="btn btn-quiet w-10 h-10 min-h-10 p-0 rounded-full flex items-center justify-center cursor-pointer"
          >
            <SpeakerIcon size={17} />
          </button>
        ) : null}
        {current.part_of_speech ? (
          <span className="rounded-full border border-line bg-black/[0.03] dark:bg-white/[0.05] px-2.5 py-0.5 text-xs font-semibold text-muted capitalize">
            {current.part_of_speech}
          </span>
        ) : null}
      </div>

      <div className="grid gap-2.5">
        {options.map((opt, idx) => {
          const isPicked = selected === opt;
          const isRightOption = opt.trim().toLowerCase() === correctAnswer.toLowerCase();
          let cardCls =
            "border-line bg-surface hover:border-subtitle hover:bg-subtitle/10 text-ink";
          if (selected !== null) {
            if (isRightOption) {
              cardCls = "border-emerald-500 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300";
            } else if (isPicked) {
              cardCls = "border-bad bg-bad-soft text-bad-ink";
            } else {
              cardCls = "border-line bg-surface opacity-55 text-muted";
            }
          }

          return (
            <button
              key={`${current.id}-opt-${idx}`}
              type="button"
              disabled={selected !== null}
              onClick={() => handleChoose(opt)}
              dir="auto"
              className={`w-full min-h-12 rounded-2xl border px-4 py-3 text-start text-sm sm:text-base font-semibold transition-all flex items-center justify-between gap-3 cursor-pointer ${cardCls}`}
            >
              <span className="min-w-0 break-words flex-1">{opt}</span>
              <span className="text-xs font-bold shrink-0 opacity-60">{idx + 1}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

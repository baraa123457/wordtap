"use client";

import { useState } from "react";

// A fixed sample line for the landing page, so visitors can try the idea before signing up.
const DEMO_WORDS = [
  { word: "I", translation: "أنا" },
  { word: "never", translation: "أبدًا" },
  { word: "thought", translation: "ظننتُ" },
  { word: "you'd", translation: "أنك سوف" },
  { word: "come", translation: "تأتي" },
  { word: "back", translation: "تعود" },
] as const;

export function SubtitleDemo() {
  const [picked, setPicked] = useState<number | null>(null);
  const current = picked === null ? null : DEMO_WORDS[picked];

  return (
    <figure className="frame" aria-label="Interactive demo of tapping a subtitle word">
      <div className="frame-bar">
        <span>Demo: tap a word in the subtitle</span>
      </div>
      <div className="frame-stage" style={{ minHeight: "13rem" }}>
        <p className="sub flex max-w-xl flex-wrap justify-center gap-x-[0.35em] text-3xl sm:text-4xl">
          {DEMO_WORDS.map((item, i) => (
            <button
              key={item.word}
              type="button"
              onClick={() => setPicked(i)}
              aria-pressed={picked === i}
              className="sub-word font-[inherit]"
            >
              {item.word}
            </button>
          ))}
        </p>
      </div>
      <div className="frame-bar" aria-live="polite" style={{ minHeight: "3rem" }}>
        {current ? (
          <>
            <span className="text-base text-white">
              <span className="opacity-70">{current.word}</span>
              <span className="mx-2 opacity-40">=</span>
              <span dir="rtl" className="font-semibold text-[var(--subtitle)]">
                {current.translation}
              </span>
            </span>
            <span>Saved to your word list</span>
          </>
        ) : (
          <span>Tap any word to see it translated and saved.</span>
        )}
      </div>
    </figure>
  );
}

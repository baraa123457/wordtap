"use client";

import { useEffect } from "react";
import type { ChoiceQuestion } from "@/lib/session";
import { canSpeak, speak } from "@/lib/speech";
import { SpeakerIcon, TrashIcon } from "../Icons";
import type { Phase } from "./types";

const INSTRUCTION: Record<ChoiceQuestion["variant"], string> = {
  "to-translation": "Choose the translation",
  "to-word": "Which word means this?",
  listen: "Listen, then choose the word",
};

type Props = {
  q: ChoiceQuestion;
  selected: string | null;
  phase: Phase;
  onSelect: (option: string) => void;
  onDeleteWord?: (wordId: string) => void;
};

export function ChoiceView({ q, selected, phase, onSelect, onDeleteWord }: Props) {
  const locked = phase !== "answering";
  const speakable = q.speak !== null && canSpeak();

  // Listening questions start playing as soon as they appear.
  useEffect(() => {
    if (q.variant === "listen" && q.speak) speak(q.speak.text, q.speak.lang);
  }, [q]);

  const speakOption = (option: string) => {
    if (!canSpeak()) return;
    const hasArabic = /[\u0600-\u06FF]/.test(option);
    const optLang = hasArabic ? "ar" : q.optionsLang || (q.variant === "to-translation" ? "ar" : "en");
    speak(option, optLang);
  };

  const handleSelect = (option: string) => {
    onSelect(option);
    speakOption(option);
  };

  // Keys 1-4 pick an option.
  useEffect(() => {
    if (locked) return;
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const index = Number(e.key) - 1;
      const option = q.options[index];
      if (option !== undefined) handleSelect(option);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [locked, q, handleSelect]);

  function stateOf(option: string): string | undefined {
    if (locked) {
      if (option === q.answer) return "right";
      if (option === selected) return "wrong";
      return "done";
    }
    return option === selected ? "selected" : undefined;
  }

  return (
    <div className="grid gap-6">
      <div className="frame">
        <div className="frame-bar">
          <span>{INSTRUCTION[q.variant]}</span>
        </div>
        <div className="frame-stage gap-4" style={{ minHeight: "12rem" }}>
          {q.variant === "listen" ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => q.speak && speak(q.speak.text, q.speak.lang)}
            >
              <SpeakerIcon size={22} /> Play again
            </button>
          ) : (
            <p className="sub flex items-center justify-center gap-3 text-4xl sm:text-5xl" dir="auto">
              <span className="sub-hl">{q.prompt}</span>
              {speakable && q.speak ? (
                <button
                  type="button"
                  aria-label="Hear it"
                  className="rounded-full p-2 text-white/80 hover:text-white"
                  style={{ WebkitTextStroke: 0 }}
                  onClick={() => q.speak && speak(q.speak.text, q.speak.lang)}
                >
                  <SpeakerIcon size={24} />
                </button>
              ) : null}
            </p>
          )}
        </div>
        <div className="frame-bar flex items-center justify-between gap-2">
          <span className="truncate">{q.context ? `From ${q.context}` : ""}</span>
          {onDeleteWord ? (
            <button
              type="button"
              title="Delete this word from My Words (saved by accident)"
              aria-label="Delete word"
              className="inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-red-400 py-1 px-2.5 rounded-lg hover:bg-white/10 transition-colors shrink-0 ms-auto cursor-pointer"
              onClick={() => onDeleteWord(q.wordId)}
            >
              <TrashIcon size={14} />
              <span>Delete word</span>
            </button>
          ) : null}
        </div>
      </div>

      <div role="radiogroup" aria-label="Answers" className="grid gap-3 sm:grid-cols-2">
        {q.options.map((option, i) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={option === selected}
            className="option group relative flex items-center justify-between"
            data-state={stateOf(option)}
            data-flash={locked && option === selected && option !== q.answer}
            disabled={locked}
            onClick={() => handleSelect(option)}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="kbd shrink-0" aria-hidden>
                {i + 1}
              </span>
              <span dir="auto" className="min-w-0 break-words text-start">
                {option}
              </span>
            </div>

            {canSpeak() ? (
              <span
                role="button"
                tabIndex={-1}
                aria-label={`Hear “${option}”`}
                title={`Pronounce “${option}”`}
                className="p-1 rounded-full text-muted hover:text-ink hover:bg-black/10 dark:hover:bg-white/10 shrink-0 transition-opacity opacity-60 group-hover:opacity-100 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  speakOption(option);
                }}
              >
                <SpeakerIcon size={18} />
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}

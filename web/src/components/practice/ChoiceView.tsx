"use client";

import { useEffect } from "react";
import type { ChoiceQuestion } from "@/lib/session";
import { canSpeak, speak } from "@/lib/speech";
import { SpeakerIcon } from "../Icons";
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
};

export function ChoiceView({ q, selected, phase, onSelect }: Props) {
  const locked = phase !== "answering";
  const speakable = q.speak !== null && canSpeak();

  // Listening questions start playing as soon as they appear.
  useEffect(() => {
    if (q.variant === "listen" && q.speak) speak(q.speak.text, q.speak.lang);
  }, [q]);

  // Keys 1-4 pick an option.
  useEffect(() => {
    if (locked) return;
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const index = Number(e.key) - 1;
      const option = q.options[index];
      if (option !== undefined) onSelect(option);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [locked, q, onSelect]);

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
        <div className="frame-bar">
          <span className="truncate">{q.context ? `From ${q.context}` : ""}</span>
        </div>
      </div>

      <div role="radiogroup" aria-label="Answers" className="grid gap-3 sm:grid-cols-2">
        {q.options.map((option, i) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={option === selected}
            className="option"
            data-state={stateOf(option)}
            data-flash={locked && option === selected && option !== q.answer}
            disabled={locked}
            onClick={() => onSelect(option)}
          >
            <span className="kbd" aria-hidden>
              {i + 1}
            </span>
            <span dir="auto" className="min-w-0 break-words">
              {option}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

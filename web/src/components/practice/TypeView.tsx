"use client";

import { useEffect, useRef, type FormEvent } from "react";
import type { TypeQuestion } from "@/lib/session";
import { canSpeak, speak } from "@/lib/speech";
import { SpeakerIcon, TrashIcon } from "../Icons";
import type { Phase } from "./types";

type Props = {
  q: TypeQuestion;
  value: string;
  phase: Phase;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onDeleteWord?: (wordId: string) => void;
};

export function TypeView({ q, value, phase, onChange, onSubmit, onDeleteWord }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const locked = phase !== "answering";

  useEffect(() => {
    input.current?.focus();
  }, [q.id]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!locked && value.trim() !== "") onSubmit();
  }

  const instruction = q.variant === "to-translation" ? "Type the translation" : "Write this word";

  return (
    <div className="grid gap-6">
      <div className="frame">
        <div className="frame-bar">
          <span>{instruction}</span>
        </div>
        <div className="frame-stage" style={{ minHeight: "12rem" }}>
          <p className="sub flex items-center justify-center gap-3 text-4xl sm:text-5xl" dir="auto">
            <span className="sub-hl">{q.prompt}</span>
            {canSpeak() ? (
              <button
                type="button"
                aria-label={`Hear “${q.prompt}”`}
                title={`Hear “${q.prompt}”`}
                className="rounded-full p-2 text-white/80 hover:text-white cursor-pointer"
                style={{ WebkitTextStroke: 0 }}
                onClick={() => {
                  const hasAr = /[\u0600-\u06FF]/.test(q.prompt);
                  speak(q.prompt, hasAr ? "ar" : "en");
                }}
              >
                <SpeakerIcon size={24} />
              </button>
            ) : null}
          </p>
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

      <form onSubmit={submit}>
        <label className="sr-only" htmlFor="typed-answer">
          Your answer
        </label>
        <input
          ref={input}
          id="typed-answer"
          className="field text-xl"
          dir="auto"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder={q.variant === "to-translation" ? "Type translation..." : "Type the word..."}
          value={value}
          disabled={locked}
          onChange={(e) => onChange(e.target.value)}
          style={{ minHeight: "3.75rem" }}
        />
      </form>
    </div>
  );
}

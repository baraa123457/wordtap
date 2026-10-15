"use client";

import { useEffect, useRef, type FormEvent } from "react";
import type { TypeQuestion } from "@/lib/session";
import type { Phase } from "./types";

type Props = {
  q: TypeQuestion;
  value: string;
  phase: Phase;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

export function TypeView({ q, value, phase, onChange, onSubmit }: Props) {
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
          <p className="sub text-4xl sm:text-5xl" dir="auto">
            <span className="sub-hl">{q.prompt}</span>
          </p>
        </div>
        <div className="frame-bar">
          <span className="truncate">{q.context ? `From ${q.context}` : ""}</span>
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

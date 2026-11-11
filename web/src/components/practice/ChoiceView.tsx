"use client";

import { useCallback, useEffect } from "react";
import type { ChoiceQuestion } from "@/lib/session";
import { canSpeak, speak } from "@/lib/speech";
import { parseSourceContext } from "@/lib/format";
import { SpeakerIcon, TrashIcon } from "../Icons";
import type { Phase } from "./types";

const INSTRUCTION: Record<ChoiceQuestion["variant"], string> = {
  "to-translation": "Choose the translation",
  "to-word": "Which word means this?",
  listen: "Listen, then choose the word",
  cloze: "Fill in the blank in the sentence",
};

function highlightInSentence(sentence: string, targetWord: string) {
  if (!sentence || !targetWord) return sentence;
  const escaped = targetWord.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!escaped) return sentence;
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = sentence.split(regex);
  if (parts.length === 1) return sentence;
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark
        key={i}
        className="bg-subtitle/30 text-subtitle font-bold px-1 rounded-sm not-italic border-b-2 border-subtitle"
      >
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

type Props = {
  q: ChoiceQuestion;
  selected: string | null;
  phase: Phase;
  onSelect: (option: string | null) => void;
  onDeleteWord?: (wordId: string) => void;
};

export function ChoiceView({ q, selected, phase, onSelect, onDeleteWord }: Props) {
  const locked = phase !== "answering";
  const speakable = q.speak !== null && canSpeak();
  const { sentence, sourceTitle } = parseSourceContext(q.context);
  const isPromptArabic = /[\u0600-\u06FF]/.test(q.prompt);

  // Auto-play the English word pronunciation as soon as the card appears!
  useEffect(() => {
    if (q.speak && canSpeak()) {
      speak(q.speak.text, q.speak.lang);
    }
  }, [q.id, q.speak]);

  const speakOption = useCallback(
    (option: string) => {
      if (!canSpeak()) return;
      const hasArabic = /[\u0600-\u06FF]/.test(option);
      const optLang = hasArabic ? "ar" : q.optionsLang || (q.variant === "to-translation" ? "ar" : "en");
      speak(option, optLang);
    },
    [q.optionsLang, q.variant],
  );

  const handleSelect = useCallback(
    (option: string) => {
      if (selected === option) {
        onSelect(null);
        return;
      }
      onSelect(option);
      speakOption(option);
    },
    [onSelect, speakOption, selected],
  );

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
  }, [locked, q.options, handleSelect]);

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
        <div className="frame-stage gap-3" style={{ minHeight: "12rem" }}>
          {q.variant === "listen" ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => q.speak && speak(q.speak.text, q.speak.lang)}
            >
              <SpeakerIcon size={22} /> Play again
            </button>
          ) : q.variant === "cloze" ? (
            <div className="space-y-3 px-4 max-w-xl mx-auto text-center">
              <p className="text-xl sm:text-2xl text-white font-medium leading-relaxed" dir="auto">
                “
                {q.prompt.split("______").map((part, idx, arr) => (
                  <span key={idx}>
                    {part}
                    {idx < arr.length - 1 && (
                      <span className="inline-block border-b-3 border-subtitle text-subtitle px-2 mx-1 font-mono font-bold tracking-wider animate-pulse">
                        [ ___ ]
                      </span>
                    )}
                  </span>
                ))}
                ”
              </p>
              {speakable && q.speak ? (
                <button
                  type="button"
                  aria-label="Hear the missing word"
                  className="btn btn-quiet min-h-8 text-xs text-white/80 hover:text-white inline-flex items-center gap-1.5"
                  onClick={() => q.speak && speak(q.speak.text, q.speak.lang)}
                >
                  <SpeakerIcon size={16} /> Listen to audio hint
                </button>
              ) : null}
            </div>
          ) : (
            <>
              <p
                className={`sub flex items-center justify-center gap-3 text-4xl sm:text-5xl ${
                  isPromptArabic ? "sub-ar" : ""
                }`}
                dir="auto"
                lang={isPromptArabic ? "ar" : q.speak?.lang || "en"}
              >
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
              {sentence ? (
                <p className="text-xs sm:text-sm text-white/80 max-w-lg mx-auto text-center font-normal px-4 italic line-clamp-3 leading-relaxed" dir="auto">
                  “{highlightInSentence(sentence, q.prompt)}”
                </p>
              ) : null}
            </>
          )}
        </div>
        <div className="frame-bar flex items-center justify-between gap-2">
          <span className="truncate">
            {q.sourceUrl ? (
              <a
                href={q.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline hover:text-white transition-colors inline-flex items-center gap-1"
                title="Jump to scene in video"
              >
                From {sourceTitle || "video"} ↗
              </a>
            ) : sourceTitle ? (
              `From ${sourceTitle}`
            ) : (
              ""
            )}
          </span>
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

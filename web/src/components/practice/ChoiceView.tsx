"use client";

import { useCallback, useEffect, useState } from "react";
import type { ChoiceQuestion } from "@/lib/session";
import { canSpeak, speak, cancelSpeech } from "@/lib/speech";
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
    i % 2 === 1 ? (
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
  const parsed = parseSourceContext(q.context);
  const sentence = q.sentence || parsed.sentence;
  const sourceTitle = parsed.sourceTitle;
  const isPromptArabic = /[\u0600-\u06FF]/.test(q.prompt);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Auto-play the English word pronunciation with safe delay and speech cleanup
  useEffect(() => {
    if (!q.speak || !canSpeak()) return;
    let stopTimer: ReturnType<typeof setTimeout> | null = null;
    const timer = setTimeout(() => {
      setIsSpeaking(true);
      speak(q.speak!.text, q.speak!.lang);
      stopTimer = setTimeout(() => setIsSpeaking(false), 1400);
    }, 70);

    return () => {
      clearTimeout(timer);
      if (stopTimer) clearTimeout(stopTimer);
      cancelSpeech();
    };
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
      if (document.querySelector('[aria-modal="true"]')) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
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
                className={`sub flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-2xl sm:text-4xl md:text-5xl break-words max-w-full ${
                  isPromptArabic ? "sub-ar" : ""
                }`}
                dir="auto"
                lang={isPromptArabic ? "ar" : q.speak?.lang || "en"}
              >
                <span className="sub-hl break-words">{q.prompt}</span>
                {speakable && q.speak ? (
                  <button
                    type="button"
                    aria-label="Hear it"
                    className={`rounded-full p-1.5 sm:p-2 transition-all cursor-pointer ${
                      isSpeaking
                        ? "text-subtitle scale-115 drop-shadow-[0_0_10px_rgba(250,204,59,0.8)]"
                        : "text-white/80 hover:text-white"
                    }`}
                    style={{ WebkitTextStroke: 0 }}
                    onClick={() => {
                      if (q.speak) {
                        setIsSpeaking(true);
                        speak(q.speak.text, q.speak.lang);
                        setTimeout(() => setIsSpeaking(false), 1400);
                      }
                    }}
                  >
                    <SpeakerIcon size={22} />
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
        <div className="frame-bar flex flex-wrap items-center justify-between gap-2">
          <span className="truncate min-w-0">
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
              className="inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-red-400 min-h-9 py-1 px-2.5 rounded-lg hover:bg-white/10 transition-colors shrink-0 ms-auto cursor-pointer"
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
          <div key={option} className="group relative flex items-stretch min-w-0">
            <div
              role="radio"
              tabIndex={locked ? -1 : 0}
              aria-checked={option === selected}
              aria-disabled={locked || undefined}
              className={`option flex-1 min-w-0 flex items-center justify-between select-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-subtitle ${
                canSpeak() ? "pr-11" : ""
              } ${locked ? "cursor-text" : "cursor-pointer"}`}
              data-state={stateOf(option)}
              data-flash={locked && option === selected && option !== q.answer}
              onClick={() => {
                if (locked) return;
                if (typeof window !== "undefined" && window.getSelection()?.toString().trim()) return;
                handleSelect(option);
              }}
              onKeyDown={(e) => {
                if (!locked && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  handleSelect(option);
                }
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="kbd shrink-0" aria-hidden>
                  {i + 1}
                </span>
                <span dir="auto" className="min-w-0 break-words text-start select-text">
                  {option}
                </span>
              </div>
            </div>

            {canSpeak() ? (
              <button
                type="button"
                aria-label={`Hear “${option}”`}
                title={`Pronounce “${option}”`}
                className="absolute right-2 top-1/2 -translate-y-1/2 min-h-9 min-w-9 inline-flex items-center justify-center rounded-full text-muted hover:text-ink hover:bg-black/10 dark:hover:bg-white/10 transition-opacity opacity-70 group-hover:opacity-100 focus-visible:opacity-100 cursor-pointer"
                onClick={() => speakOption(option)}
              >
                <SpeakerIcon size={18} />
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

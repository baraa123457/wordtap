"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { TypeQuestion } from "@/lib/session";
import { canSpeak, speak, cancelSpeech } from "@/lib/speech";
import { parseSourceContext } from "@/lib/format";
import { SpeakerIcon, TrashIcon } from "../Icons";
import type { Phase } from "./types";

type Props = {
  q: TypeQuestion;
  value: string;
  phase: Phase;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onDeleteWord?: (wordId: string) => void;
  onHintUsed?: () => void;
};

export function TypeView({ q, value, phase, onChange, onSubmit, onDeleteWord, onHintUsed }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const locked = phase !== "answering";
  const [hintUsed, setHintUsed] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const parsed = parseSourceContext(q.context);
  const sentence = q.sentence || parsed.sentence;
  const sourceTitle = parsed.sourceTitle;
  const isDictation = q.variant === "dictation";
  const isPromptArabic = /[\u0600-\u06FF]/.test(q.prompt);
  const cleanAnswer = q.answer.trim();

  useEffect(() => {
    input.current?.focus();
    setHintUsed(false);
    if (!q.speak || !canSpeak()) return;
    const timer = setTimeout(() => {
      setIsSpeaking(true);
      speak(q.speak!.text, q.speak!.lang);
      const stopTimer = setTimeout(() => setIsSpeaking(false), 1400);
      return () => clearTimeout(stopTimer);
    }, 70);

    return () => {
      clearTimeout(timer);
      cancelSpeech();
    };
  }, [q.id, q.speak]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!locked && value.trim() !== "") onSubmit();
  }

  function revealFirstLetter() {
    if (hintUsed || locked) return;
    setHintUsed(true);
    onHintUsed?.();
    const firstChar = cleanAnswer[0] || "";
    if (!value.startsWith(firstChar)) {
      onChange(firstChar);
    }
    input.current?.focus();
  }

  const instruction = isDictation
    ? "Listen and type what you hear"
    : q.variant === "to-translation"
    ? "Type the translation"
    : "Write this word";

  return (
    <div className="grid gap-6">
      <div className="frame">
        <div className="frame-bar">
          <span>{instruction}</span>
        </div>
        <div className="frame-stage gap-3" style={{ minHeight: "12rem" }}>
          {isDictation && phase === "answering" ? (
            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                aria-label={`Hear “${q.answer}”`}
                title="Replay pronunciation"
                className={`rounded-full p-5 bg-white/10 hover:bg-white/20 transition-all cursor-pointer ${
                  isSpeaking
                    ? "text-subtitle scale-110 ring-2 ring-subtitle drop-shadow-[0_0_12px_rgba(250,204,59,0.8)]"
                    : "text-white"
                }`}
                onClick={() => {
                  setIsSpeaking(true);
                  if (q.speak) speak(q.speak.text, q.speak.lang);
                  else speak(q.answer, "en");
                  setTimeout(() => setIsSpeaking(false), 1400);
                }}
              >
                <SpeakerIcon size={36} />
              </button>
              <span className="text-xs text-white/60">
                Click the speaker to hear again ({q.speak?.lang?.toUpperCase() || "AUDIO"})
              </span>
            </div>
          ) : (
            <p
              className={`sub flex items-center justify-center gap-3 text-4xl sm:text-5xl ${
                isPromptArabic ? "sub-ar" : ""
              }`}
              dir="auto"
              lang={isPromptArabic ? "ar" : "en"}
            >
              <span className="sub-hl">{q.prompt}</span>
              {canSpeak() ? (
                <button
                  type="button"
                  aria-label={`Hear “${q.prompt}”`}
                  title={`Hear “${q.prompt}”`}
                  className={`rounded-full p-2 transition-all cursor-pointer ${
                    isSpeaking
                      ? "text-subtitle scale-115 drop-shadow-[0_0_10px_rgba(250,204,59,0.8)]"
                      : "text-white/80 hover:text-white"
                  }`}
                  style={{ WebkitTextStroke: 0 }}
                  onClick={() => {
                    setIsSpeaking(true);
                    if (q.speak) speak(q.speak.text, q.speak.lang);
                    else {
                      const hasAr = /[\u0600-\u06FF]/.test(q.prompt);
                      speak(q.prompt, hasAr ? "ar" : "en");
                    }
                    setTimeout(() => setIsSpeaking(false), 1400);
                  }}
                >
                  <SpeakerIcon size={24} />
                </button>
              ) : null}
            </p>
          )}
          {sentence && (!isDictation || phase !== "answering") ? (
            <p className="text-xs sm:text-sm text-white/70 max-w-lg mx-auto text-center font-normal px-4 italic line-clamp-2" dir="auto">
              “{sentence}”
            </p>
          ) : null}
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

      <form onSubmit={submit} className="grid gap-3">
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

        {/* Answer length indicator and first-letter hint */}
        <div className="flex items-center justify-between px-2 text-xs text-muted">
          <div className="flex items-center gap-1 font-mono tracking-widest select-none">
            {cleanAnswer.split("").map((ch, idx) => (
              <span
                key={idx}
                className="inline-block border-b-2 border-line w-3.5 text-center font-bold text-ink"
              >
                {hintUsed && idx === 0 ? ch : " "}
              </span>
            ))}
            <span className="ms-2 font-sans text-xs text-muted/70 tracking-normal">
              ({cleanAnswer.length} letters)
            </span>
          </div>

          {!hintUsed && !locked ? (
            <button
              type="button"
              className="btn btn-quiet min-h-7 px-2.5 py-0.5 text-xs text-subtitle-edge dark:text-subtitle font-semibold hover:bg-subtitle/10 transition-colors cursor-pointer"
              onClick={revealFirstLetter}
            >
              💡 Show first letter
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}

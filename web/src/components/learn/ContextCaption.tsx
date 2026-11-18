"use client";

import { useMemo, useState } from "react";
import { maskWordInSentence, type MaskedSentence } from "@/lib/placeholder";
import {
  buildTimedCaptionLayout,
  getTokenSpeechState,
  type WordSpeechState,
} from "@/lib/caption-sync";
import type { CaptionCue } from "@/lib/video/types";
import { normalizeLookupWord, WordLookupPopover } from "./WordLookupPopover";

function wordClassForState(state: WordSpeechState, isSelected: boolean): string {
  const base =
    "inline rounded-md px-0.5 cursor-pointer hover:underline hover:decoration-subtitle hover:decoration-2 hover:underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-subtitle";
  if (isSelected) {
    return `${base} bg-subtitle/35 text-ink font-bold underline decoration-subtitle decoration-2 underline-offset-4 transition-colors duration-75`;
  }
  switch (state) {
    case "speaking":
      return `${base} bg-subtitle/45 text-amber-700 dark:text-amber-300 font-bold transition-colors duration-75`;
    case "spoken":
      return `${base} text-amber-600 dark:text-amber-400 transition-colors duration-100`;
    case "upcoming":
      return `${base} text-ink/55 dark:text-ink/50 transition-colors duration-100`;
    default:
      return `${base} text-ink transition-colors duration-100`;
  }
}

function targetBlankClassForState(state: WordSpeechState): string {
  switch (state) {
    case "speaking":
      return "inline-block rounded-lg border-b-2 border-amber-600 bg-subtitle px-2 py-0.5 font-mono font-extrabold tracking-[0.2em] text-ink ring-2 ring-amber-400/70 shadow-sm transition-all duration-75";
    case "spoken":
      return "inline-block rounded-lg border-b-2 border-amber-500 bg-amber-500/20 px-2 py-0.5 font-mono font-bold tracking-[0.2em] text-amber-800 dark:text-amber-200 transition-all duration-100";
    default:
      return "inline-block rounded-lg border-b-2 border-subtitle bg-subtitle/10 px-2 py-0.5 font-mono font-bold tracking-[0.2em] text-ink transition-all duration-100";
  }
}

function revealedTargetClassForState(state: WordSpeechState): string {
  if (state === "speaking") {
    return "rounded-lg bg-subtitle px-2 py-0.5 font-extrabold text-ink ring-2 ring-amber-500/70 shadow-sm transition-all duration-75";
  }
  return "rounded-lg bg-subtitle/40 px-2 py-0.5 font-extrabold text-ink transition-all duration-100";
}

function splitSentenceWords(text: string): Array<{ id: string; text: string; isSpace: boolean }> {
  if (!text) return [];
  return text
    .split(/(\s+)/)
    .filter((p) => p.length > 0)
    .map((p, idx) => ({ id: `fb-${idx}`, text: p, isSpace: /^\s+$/.test(p) }));
}

export function ContextCaption({
  masked,
  fullSentence,
  targetWord,
  srcLang = "en",
  targetLang,
  sourceTitle,
  sourceUrl,
  revealed,
  hint,
  captionCues,
  currentTimeSec,
  label,
  onWordLookupOpen,
}: {
  masked: MaskedSentence;
  fullSentence: string;
  targetWord: string;
  srcLang?: string;
  targetLang?: string;
  sourceTitle?: string;
  sourceUrl?: string;
  revealed: boolean;
  hint: string | null;
  captionCues?: CaptionCue[];
  currentTimeSec?: number;
  label: string;
  onWordLookupOpen?: () => void;
}) {
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [savedWords, setSavedWords] = useState<Set<string>>(() => new Set());

  // Word-by-word karaoke timing layout synced to real SRT / transcript cues
  const timedLayout = useMemo(
    () => buildTimedCaptionLayout(masked, captionCues),
    [masked, captionCues],
  );

  const fallbackBeforeTokens = useMemo(() => splitSentenceWords(masked.before), [masked.before]);
  const fallbackAfterTokens = useMemo(() => splitSentenceWords(masked.after), [masked.after]);

  const handleWordClick = (rawToken: string) => {
    const clean = normalizeLookupWord(rawToken);
    if (!clean || clean.length < 2) return;
    // Never look up the hidden target word before solving
    if (!revealed && clean.toLowerCase() === targetWord.trim().toLowerCase()) return;
    setSelectedWord((prev) => {
      const next = prev?.toLowerCase() === clean.toLowerCase() ? null : clean;
      if (next) onWordLookupOpen?.();
      return next;
    });
  };

  // Synchronized surrounding cue indicator when playback moves outside the target sentence
  const syncedLiveCue = useMemo(() => {
    if (!captionCues || captionCues.length <= 1 || typeof currentTimeSec !== "number") {
      return null;
    }
    if (
      timedLayout &&
      currentTimeSec >= timedLayout.sentenceStart - 0.1 &&
      currentTimeSec <= timedLayout.sentenceEnd + 0.2
    ) {
      return null;
    }
    const active = captionCues.find(
      (c) => currentTimeSec >= c.start - 0.2 && currentTimeSec <= c.end + 0.3,
    );
    if (!active) return null;
    if (revealed) return active.text;

    const maskedCue = maskWordInSentence(active.text, targetWord);
    if (!maskedCue) return active.text;
    return `${maskedCue.before}${maskedCue.placeholder}${maskedCue.after}`;
  }, [captionCues, currentTimeSec, revealed, targetWord, timedLayout]);

  const renderClickableToken = (
    key: string,
    rawText: string,
    speechState: WordSpeechState,
  ) => {
    const clean = normalizeLookupWord(rawText);
    const clickable = clean.length >= 2;
    const isSelected =
      clickable && selectedWord !== null && selectedWord.toLowerCase() === clean.toLowerCase();

    if (!clickable) {
      return (
        <span key={key} data-speech-state={speechState}>
          {rawText}
        </span>
      );
    }

    return (
      <button
        key={key}
        type="button"
        onClick={() => handleWordClick(rawText)}
        data-speech-state={speechState}
        title={`Click to translate & save "${clean}"`}
        className={wordClassForState(speechState, isSelected)}
      >
        {rawText}
      </button>
    );
  };

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-muted">{label}</span>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-[11px] text-muted">
            Click any word for meaning
          </span>
          <span
            data-testid="stage2-letter-count"
            className="rounded-full bg-black/5 dark:bg-white/10 px-2.5 py-0.5 text-[11px] font-bold text-muted tabular-nums"
          >
            {masked.letterCount} {masked.letterCount === 1 ? "letter" : "letters"}
          </span>
        </div>
      </div>

      {/* Custom WordTap Caption Display: real-time speaker color sync + click-any-word lookup */}
      <blockquote
        data-testid="stage2-caption-quote"
        className="text-base sm:text-xl font-medium leading-relaxed text-ink"
      >
        &ldquo;
        {timedLayout ? (
          timedLayout.tokens.map((tok) => {
            if (tok.isSpace) return <span key={tok.id}>{tok.text}</span>;

            const speechState = getTokenSpeechState(
              tok,
              currentTimeSec,
              timedLayout.sentenceStart,
            );

            if (tok.isTarget) {
              return revealed ? (
                <mark
                  key={tok.id}
                  data-speech-state={speechState}
                  className={revealedTargetClassForState(speechState)}
                >
                  {masked.hiddenWord}
                </mark>
              ) : (
                <span
                  key={tok.id}
                  data-testid="stage2-missing-placeholder"
                  data-speech-state={speechState}
                  aria-label={`${masked.letterCount} missing letters`}
                  className={targetBlankClassForState(speechState)}
                >
                  {hint || masked.placeholder}
                </span>
              );
            }

            return renderClickableToken(tok.id, tok.text, speechState);
          })
        ) : (
          <>
            {fallbackBeforeTokens.map((tok) =>
              tok.isSpace ? (
                <span key={tok.id}>{tok.text}</span>
              ) : (
                renderClickableToken(tok.id, tok.text, "idle")
              ),
            )}
            {revealed ? (
              <mark className="rounded-lg bg-subtitle/40 px-2 py-0.5 font-extrabold text-ink">
                {masked.hiddenWord}
              </mark>
            ) : (
              <span
                data-testid="stage2-missing-placeholder"
                aria-label={`${masked.letterCount} missing letters`}
                className="inline-block rounded-lg border-b-2 border-subtitle bg-subtitle/10 px-2 py-0.5 font-mono font-bold tracking-[0.2em] text-ink"
              >
                {hint || masked.placeholder}
              </span>
            )}
            {fallbackAfterTokens.map((tok) =>
              tok.isSpace ? (
                <span key={tok.id}>{tok.text}</span>
              ) : (
                renderClickableToken(tok.id, tok.text, "idle")
              ),
            )}
          </>
        )}
        &rdquo;
      </blockquote>

      {/* Inline WordTap Extension-Style Lookup & Save Popup */}
      {selectedWord ? (
        <WordLookupPopover
          word={selectedWord}
          srcLang={srcLang}
          targetLang={targetLang}
          contextSentence={fullSentence}
          sourceTitle={sourceTitle}
          sourceUrl={sourceUrl}
          alreadySaved={savedWords.has(selectedWord.toLowerCase())}
          onSaved={(savedKey) =>
            setSavedWords((prev) => {
              const next = new Set(prev);
              next.add(savedKey);
              return next;
            })
          }
          onClose={() => setSelectedWord(null)}
        />
      ) : null}

      {/* Live synchronized surrounding caption cue when speaker is before/after the target sentence */}
      {syncedLiveCue ? (
        <p
          aria-live="polite"
          className="rounded-xl bg-black/[0.03] dark:bg-white/[0.04] px-3 py-1.5 text-xs text-muted"
        >
          <span className="font-semibold text-ink/70 mr-1.5">Now speaking:</span>
          <span>&ldquo;{syncedLiveCue}&rdquo;</span>
        </p>
      ) : null}
    </div>
  );
}

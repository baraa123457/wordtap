"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ScrambleQuestion } from "@/lib/session";
import { canSpeak, speak, cancelSpeech } from "@/lib/speech";
import { parseSourceContext } from "@/lib/format";
import { SpeakerIcon, TrashIcon } from "../Icons";
import type { Phase } from "./types";

type Props = {
  q: ScrambleQuestion;
  value: string;
  phase: Phase;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onDeleteWord?: (wordId: string) => void;
};

export function ScrambleView({ q, value, phase, onChange, onSubmit, onDeleteWord }: Props) {
  const locked = phase !== "answering";
  const { sentence, sourceTitle } = parseSourceContext(q.context);
  const isPromptArabic = /[\u0600-\u06FF]/.test(q.prompt);
  const [placedTileIds, setPlacedTileIds] = useState<string[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);

  // Reset placed tiles and pronounce the word when card appears
  useEffect(() => {
    setPlacedTileIds([]);
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

  const tileMap = useMemo(() => new Map(q.tiles.map((t) => [t.id, t])), [q.tiles]);

  // Sync current assembled word string with parent state
  const handlePlacedChange = useCallback(
    (newPlacedIds: string[]) => {
      setPlacedTileIds(newPlacedIds);
      const assembled = newPlacedIds.map((id) => tileMap.get(id)?.char ?? "").join("");
      onChange(assembled);
    },
    [onChange, tileMap],
  );

  const placeTile = useCallback(
    (tileId: string) => {
      if (locked || placedTileIds.includes(tileId)) return;
      const next = [...placedTileIds, tileId];
      handlePlacedChange(next);
    },
    [locked, placedTileIds, handlePlacedChange],
  );

  const removeTileAt = useCallback(
    (index: number) => {
      if (locked) return;
      const next = placedTileIds.filter((_, i) => i !== index);
      handlePlacedChange(next);
    },
    [locked, placedTileIds, handlePlacedChange],
  );

  const undoLast = useCallback(() => {
    if (locked || placedTileIds.length === 0) return;
    const next = placedTileIds.slice(0, -1);
    handlePlacedChange(next);
  }, [locked, placedTileIds, handlePlacedChange]);

  const clearAll = useCallback(() => {
    if (locked || placedTileIds.length === 0) return;
    handlePlacedChange([]);
  }, [locked, placedTileIds, handlePlacedChange]);

  // Hint feature: automatically places first letter tile
  const useHint = useCallback(() => {
    if (locked || hintUsed) return;
    setHintUsed(true);
    const firstChar = q.answer[0]?.toLowerCase();
    if (!firstChar) return;
    // Find unplaced tile matching first character
    const match = q.tiles.find(
      (t) => t.char.toLowerCase() === firstChar && !placedTileIds.includes(t.id),
    );
    if (match) {
      handlePlacedChange([match.id]);
    }
  }, [locked, hintUsed, q.answer, q.tiles, placedTileIds, handlePlacedChange]);

  // Keyboard support: type letters directly or press Backspace/Enter
  useEffect(() => {
    if (locked) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === "Backspace") {
        e.preventDefault();
        undoLast();
        return;
      }

      if (e.key === "Enter") {
        if (placedTileIds.length === q.tiles.length && value.trim() !== "") {
          e.preventDefault();
          onSubmit();
        }
        return;
      }

      if (e.key.length === 1) {
        const char = e.key.toLowerCase();
        // Find first available tile in bank matching pressed character
        const available = q.tiles.find(
          (t) => t.char.toLowerCase() === char && !placedTileIds.includes(t.id),
        );
        if (available) {
          e.preventDefault();
          placeTile(available.id);
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [locked, placedTileIds, q.tiles, undoLast, placeTile, onSubmit, value]);

  const speakPrompt = () => {
    if (!canSpeak()) return;
    setIsSpeaking(true);
    if (q.speak) speak(q.speak.text, q.speak.lang);
    else {
      const hasAr = /[\u0600-\u06FF]/.test(q.prompt);
      speak(q.prompt, hasAr ? "ar" : "en");
    }
    setTimeout(() => setIsSpeaking(false), 1400);
  };

  const totalTiles = q.tiles.length;
  const isLongWord = totalTiles > 9;
  const isExtraLongWord = totalTiles > 12;

  const tileSizeClass = isExtraLongWord
    ? "h-9 w-8 sm:h-10 sm:w-9 text-base"
    : isLongWord
    ? "h-10 w-9 sm:h-12 sm:w-11 text-lg sm:text-xl"
    : "h-12 w-11 sm:h-13 sm:w-12 text-xl sm:text-2xl";

  return (
    <div className="grid gap-6">
      <div className="frame">
        <div className="frame-bar">
          <span>Tap the letters to build the word</span>
        </div>
        <div className="frame-stage gap-3" style={{ minHeight: "12rem" }}>
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
                onClick={speakPrompt}
              >
                <SpeakerIcon size={24} />
              </button>
            ) : null}
          </p>
          {sentence ? (
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

      {/* Answer Slots Row */}
      <div className="apple-card p-4 sm:p-5 bg-surface border border-line flex flex-col items-center gap-3">
        <div className="w-full flex items-center justify-between text-xs text-muted px-1">
          <span>Formed word ({placedTileIds.length}/{totalTiles}):</span>
          <div className="flex items-center gap-2">
            {!hintUsed && placedTileIds.length === 0 && !locked ? (
              <button
                type="button"
                onClick={useHint}
                className="btn btn-quiet min-h-7 px-2.5 py-0.5 text-xs text-subtitle-edge dark:text-subtitle font-semibold hover:bg-subtitle/10 cursor-pointer"
              >
                💡 Hint (first letter)
              </button>
            ) : null}
            {placedTileIds.length > 0 && !locked ? (
              <>
                <button
                  type="button"
                  onClick={undoLast}
                  className="btn btn-quiet min-h-7 px-2.5 py-0.5 text-xs text-muted hover:text-ink cursor-pointer"
                >
                  ⌫ Undo
                </button>
                <button
                  type="button"
                  onClick={clearAll}
                  className="btn btn-quiet min-h-7 px-2.5 py-0.5 text-xs text-muted hover:text-ink cursor-pointer"
                >
                  Clear
                </button>
              </>
            ) : null}
          </div>
        </div>

        {/* Tiles in Answer */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 min-h-14 w-full py-1">
          {Array.from({ length: totalTiles }).map((_, idx) => {
            const tileId = placedTileIds[idx];
            const tile = tileId ? tileMap.get(tileId) : undefined;
            if (tile) {
              return (
                <button
                  key={`placed-${idx}-${tile.id}`}
                  type="button"
                  disabled={locked}
                  onClick={() => removeTileAt(idx)}
                  aria-label={`Remove letter ${tile.char}`}
                  className={`flex ${tileSizeClass} items-center justify-center rounded-xl bg-subtitle text-subtitle-ink font-black shadow-md border border-subtitle-edge active:scale-90 transition-all cursor-pointer`}
                >
                  {tile.char}
                </button>
              );
            }
            return (
              <div
                key={`empty-${idx}`}
                className={`flex ${tileSizeClass} items-center justify-center rounded-xl border-2 border-dashed border-line/70 bg-black/[0.02] dark:bg-white/[0.02]`}
              />
            );
          })}
        </div>
      </div>

      {/* Letter Bank */}
      <div className="flex flex-col items-center gap-2.5">
        <p className="text-xs text-muted select-none">Tap letters or type on keyboard:</p>
        <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 max-w-lg mx-auto">
          {q.tiles.map((tile) => {
            const isPlaced = placedTileIds.includes(tile.id);
            return (
              <button
                key={tile.id}
                type="button"
                disabled={locked || isPlaced}
                onClick={() => placeTile(tile.id)}
                aria-label={`Letter ${tile.char}`}
                className={`flex ${tileSizeClass} items-center justify-center rounded-xl font-bold transition-all shadow-xs ${
                  isPlaced
                    ? "opacity-20 pointer-events-none scale-90 border border-line bg-surface/50 text-muted"
                    : "bg-surface border-2 border-line text-ink hover:border-subtitle hover:scale-105 active:scale-95 cursor-pointer shadow-sm"
                }`}
              >
                {tile.char}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

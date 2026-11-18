"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Word } from "@/lib/schemas";
import {
  contributeVerifiedVideo,
  fetchVerifiedVideos,
  type VerifiedVideoClip,
  type VideoDiscoveryResponse,
} from "@/lib/learn-api";
import {
  buildProgressiveHint,
  maskWordInSentence,
  validateMissingWordAnswer,
} from "@/lib/placeholder";
import { canSpeak, speak } from "@/lib/speech";
import { SpeakerIcon } from "@/components/Icons";
import { YouTubeClipPlayer } from "./YouTubeClipPlayer";

export function Stage2ContextualVideo({
  word,
  onComplete,
}: {
  word: Word;
  onComplete: (result: {
    passedFirstTry: boolean;
    typedAnswer: string;
    usedVideo: boolean;
  }) => void;
}) {
  const [discovery, setDiscovery] = useState<VideoDiscoveryResponse | null>(null);
  const [clips, setClips] = useState<VerifiedVideoClip[]>([]);
  const [clipIndex, setClipIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Missing-word exercise state
  const [answer, setAnswer] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [exerciseState, setExerciseState] = useState<"answering" | "wrong" | "correct">("answering");
  const [completedAnyClip, setCompletedAnyClip] = useState(false);
  const [firstTryPassed, setFirstTryPassed] = useState(true);

  // Optional user-contributed YouTube clip verification form
  const [showAddClip, setShowAddClip] = useState(false);
  const [contribUrl, setContribUrl] = useState("");
  const [contribTime, setContribTime] = useState("0");
  const [contribTranscript, setContribTranscript] = useState("");
  const [contribBusy, setContribBusy] = useState(false);
  const [contribError, setContribError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setClipIndex(0);
    setAnswer("");
    setAttempts(0);
    setExerciseState("answering");
    setCompletedAnyClip(false);
    setFirstTryPassed(true);

    fetchVerifiedVideos(word)
      .then((res) => {
        if (!active) return;
        setDiscovery(res);
        setClips(res.videos);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : "Could not load video examples.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [word]);

  const activeClip = clips[clipIndex] || null;
  const activeSentence = activeClip?.contextSentence || discovery?.fallbackContext?.sentence || "";

  const masked = useMemo(
    () => (activeSentence ? maskWordInSentence(activeSentence, word.text) : null),
    [activeSentence, word.text],
  );

  const hint = useMemo(
    () => (masked ? buildProgressiveHint(masked.hiddenWord, attempts) : null),
    [masked, attempts],
  );

  const resetExerciseForClip = () => {
    setAnswer("");
    setAttempts(0);
    setExerciseState("answering");
  };

  const handlePrevClip = () => {
    if (clips.length <= 1) return;
    setClipIndex((i) => (i - 1 + clips.length) % clips.length);
    resetExerciseForClip();
  };

  const handleNextClip = () => {
    if (clips.length <= 1) return;
    setClipIndex((i) => (i + 1) % clips.length);
    resetExerciseForClip();
  };

  const handleUnavailableClip = (clipId: string) => {
    setClips((prev) => {
      const next = prev.filter((c) => c.id !== clipId);
      setClipIndex((idx) => (next.length === 0 ? 0 : idx % next.length));
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!masked || !answer.trim()) return;

    const ok = validateMissingWordAnswer(answer, masked.hiddenWord, word.text);
    if (ok) {
      setExerciseState("correct");
      setCompletedAnyClip(true);
    } else {
      setAttempts((a) => a + 1);
      setFirstTryPassed(false);
      setExerciseState("wrong");
      inputRef.current?.focus();
    }
  };

  const handleContributeClip = async (e: React.FormEvent) => {
    e.preventDefault();
    setContribError(null);
    setContribBusy(true);
    try {
      const seconds = Math.max(0, Math.floor(Number(contribTime) || 0));
      const newClip = await contributeVerifiedVideo({
        word: word.text,
        youtubeUrl: contribUrl,
        timestampSeconds: seconds,
        transcript: contribTranscript,
      });
      setClips((prev) => [newClip, ...prev]);
      setClipIndex(0);
      resetExerciseForClip();
      setShowAddClip(false);
      setContribUrl("");
      setContribTime("0");
      setContribTranscript("");
    } catch (err) {
      setContribError(err instanceof Error ? err.message : "Could not verify clip.");
    } finally {
      setContribBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="apple-card p-5 sm:p-8 grid gap-4 animate-pulse">
        <div className="h-4 w-48 rounded bg-line/60" />
        <div className="aspect-video w-full rounded-2xl bg-line/50" />
        <div className="h-14 w-full rounded-2xl bg-line/40" />
      </div>
    );
  }

  return (
    <section aria-labelledby="stage2-heading" className="apple-card p-4 sm:p-7 grid gap-5 min-w-0">
      {/* TOP: Target word & clip count */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1 min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-subtitle/20 border border-subtitle/30 px-3 py-0.5 text-xs font-bold text-ink">
            Stage 2 · Contextual Learning
          </span>
          <div className="flex items-center gap-2">
            <h2 id="stage2-heading" className="text-lg sm:text-2xl font-extrabold text-ink">
              Hear &amp; complete in real context
            </h2>
          </div>
        </div>
        {clips.length > 0 ? (
          <span className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-bold text-ink tabular-nums">
            Video {clipIndex + 1} of {clips.length}
          </span>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="rounded-xl bg-bad-soft px-4 py-3 text-xs sm:text-sm text-bad">
          {error}
        </p>
      ) : null}

      {/* MIDDLE: Responsive YouTube Player (if verified video clips exist) OR Honest Graceful Fallback */}
      {activeClip ? (
        <YouTubeClipPlayer
          clip={activeClip}
          index={clipIndex}
          total={clips.length}
          onPrev={handlePrevClip}
          onNext={handleNextClip}
          onUnavailable={handleUnavailableClip}
        />
      ) : (
        <div className="rounded-2xl border border-line bg-black/[0.02] dark:bg-white/[0.03] p-4 sm:p-5 grid gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1 min-w-0 flex-1">
              <p className="text-sm font-bold text-ink">
                No verified YouTube caption clip cached for &ldquo;{word.text}&rdquo; yet
              </p>
              <p className="text-xs text-muted leading-relaxed">
                WordTap never fabricates fake video clips or timestamps.{" "}
                {discovery?.capabilities &&
                !discovery.capabilities.filmotConfigured &&
                !(discovery.capabilities.youtubeApiConfigured && discovery.capabilities.supadataConfigured)
                  ? "Configure YouTube + Supadata (or Filmot) API keys for automatic real-time video discovery, save this word while watching YouTube with the extension, or attach a verified clip below."
                  : "You can still hear real pronunciation on YouGlish or attach a verified YouTube clip below."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <a
                href={`https://youglish.com/pronounce/${encodeURIComponent(word.text)}/english`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn min-h-9 px-3 text-xs font-semibold"
              >
                Hear on YouGlish ↗
              </a>
              <button
                type="button"
                onClick={() => setShowAddClip((s) => !s)}
                className="btn btn-quiet min-h-9 px-3 text-xs font-semibold cursor-pointer"
              >
                {showAddClip ? "Close" : "+ Attach YouTube clip"}
              </button>
            </div>
          </div>

          {showAddClip ? (
            <form
              onSubmit={(e) => void handleContributeClip(e)}
              className="grid gap-3 border-t border-line pt-3"
            >
              <div className="grid gap-2 sm:grid-cols-[1fr_130px]">
                <input
                  type="url"
                  required
                  value={contribUrl}
                  onChange={(e) => setContribUrl(e.target.value)}
                  placeholder="YouTube URL (e.g. https://youtube.com/watch?v=...)"
                  className="field text-xs sm:text-sm"
                />
                <input
                  type="number"
                  min={0}
                  required
                  value={contribTime}
                  onChange={(e) => setContribTime(e.target.value)}
                  placeholder="Start (sec)"
                  aria-label="Timestamp in seconds"
                  className="field text-xs sm:text-sm"
                />
              </div>
              <input
                type="text"
                required
                value={contribTranscript}
                onChange={(e) => setContribTranscript(e.target.value)}
                placeholder={`Exact spoken sentence containing "${word.text}"`}
                className="field text-xs sm:text-sm"
              />
              {contribError ? (
                <p role="alert" className="text-xs font-medium text-bad">
                  {contribError}
                </p>
              ) : null}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={contribBusy}
                  className="btn btn-primary min-h-9 px-4 text-xs font-bold cursor-pointer"
                >
                  {contribBusy ? "Verifying embed & transcript…" : "Verify & Add Clip"}
                </button>
              </div>
            </form>
          ) : null}
        </div>
      )}

      {/* BOTTOM: Interactive Missing-Word Completion Exercise (1 dot = 1 exact missing letter) */}
      {masked ? (
        <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5 grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-muted">
              {activeClip
                ? "Type the missing word spoken in the clip:"
                : discovery?.fallbackContext?.sourceLabel || "Complete the real context sentence:"}
            </span>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-black/5 dark:bg-white/10 px-2.5 py-0.5 text-[11px] font-bold text-muted tabular-nums">
                {masked.letterCount} {masked.letterCount === 1 ? "letter" : "letters"}
              </span>
              {canSpeak() ? (
                <button
                  type="button"
                  onClick={() => speak(activeSentence, word.src_lang || "en")}
                  className="btn btn-quiet min-h-8 px-2.5 py-1 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                  title="Listen to sentence"
                >
                  <SpeakerIcon size={14} />
                  <span>Listen</span>
                </button>
              ) : null}
            </div>
          </div>

          {/* Sentence with exact 1-dot-per-character placeholder */}
          <blockquote className="text-base sm:text-xl font-medium leading-relaxed text-ink">
            &ldquo;
            {masked.before}
            {exerciseState === "correct" ? (
              <mark className="rounded-lg bg-subtitle/35 px-2 py-0.5 font-extrabold text-ink">
                {masked.hiddenWord}
              </mark>
            ) : (
              <span
                aria-label={`${masked.letterCount} missing letters`}
                className="inline-block rounded-lg border-b-2 border-subtitle bg-subtitle/10 px-2 py-0.5 font-mono font-bold tracking-[0.2em] text-ink"
              >
                {hint || masked.placeholder}
              </span>
            )}
            {masked.after}
            &rdquo;
          </blockquote>

          {exerciseState !== "correct" ? (
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2.5">
              <input
                ref={inputRef}
                type="text"
                value={answer}
                onChange={(e) => {
                  setAnswer(e.target.value);
                  if (exerciseState === "wrong") setExerciseState("answering");
                }}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder={`Type the ${masked.letterCount}-letter word…`}
                aria-label="Type the missing word"
                className="field flex-1 text-base font-semibold"
              />
              <button
                type="submit"
                disabled={!answer.trim()}
                className="btn btn-primary min-h-11 px-6 text-sm font-bold cursor-pointer disabled:opacity-50"
              >
                Submit
              </button>
            </form>
          ) : null}

          {exerciseState === "wrong" ? (
            <div role="alert" className="rounded-xl border border-bad/30 bg-bad-soft px-3.5 py-2.5 text-xs sm:text-sm text-bad font-medium">
              Not quite! Listen closely to the sentence and count the dots ({masked.letterCount} letters).
              {hint ? (
                <span className="block mt-1 text-ink">
                  Hint: <span className="font-mono font-bold tracking-widest">{hint}</span>
                </span>
              ) : null}
            </div>
          ) : null}

          {exerciseState === "correct" ? (
            <div
              role="status"
              className="rounded-2xl border border-ok/30 bg-ok/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-150"
            >
              <div>
                <p className="text-sm font-bold text-ok">
                  Spot on! &ldquo;{masked.hiddenWord}&rdquo; fits naturally here.
                </p>
                <p className="text-xs text-muted mt-0.5">
                  {clips.length > 1
                    ? "Explore another real video example or move on to Stage 3."
                    : "Now try using this word in your own original sentence."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {clips.length > 1 ? (
                  <button
                    type="button"
                    onClick={handleNextClip}
                    className="btn min-h-10 px-4 text-xs sm:text-sm font-semibold cursor-pointer"
                  >
                    Another video →
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() =>
                    onComplete({
                      passedFirstTry: firstTryPassed,
                      typedAnswer: masked.hiddenWord,
                      usedVideo: Boolean(activeClip),
                    })
                  }
                  className="btn btn-primary min-h-10 px-5 text-xs sm:text-sm font-bold cursor-pointer"
                >
                  Continue to Stage 3 →
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-bold text-ink">Ready to practice &ldquo;{word.text}&rdquo; in context</p>
            <p className="text-xs text-muted">
              No verified caption sentence was found for this rare term yet. Attach a YouTube clip above or proceed directly to creating your own sentence.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              onComplete({
                passedFirstTry: true,
                typedAnswer: word.text,
                usedVideo: false,
              })
            }
            className="btn btn-primary shrink-0 min-h-10 px-5 text-xs sm:text-sm font-bold cursor-pointer"
          >
            Continue to Stage 3 →
          </button>
        </div>
      )}

      {/* Allow advancing after completing at least one clip even if user explored a 2nd clip */}
      {completedAnyClip && exerciseState !== "correct" ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() =>
              onComplete({
                passedFirstTry: firstTryPassed,
                typedAnswer: masked?.hiddenWord || word.text,
                usedVideo: Boolean(activeClip),
              })
            }
            className="btn btn-primary min-h-10 px-5 text-xs sm:text-sm font-bold cursor-pointer"
          >
            Continue to Stage 3 →
          </button>
        </div>
      ) : null}
    </section>
  );
}

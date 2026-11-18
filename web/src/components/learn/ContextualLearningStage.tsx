"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Word } from "@/lib/schemas";
import {
  fetchContextualVideos,
  markVideoUnavailable,
  type FallbackContextExample,
  type VerifiedVideoExample,
  type VideoDiscoveryResponse,
} from "@/lib/learn-api";
import { maskWordInSentence } from "@/lib/placeholder";
import {
  WordTabVideoPlayer,
  type WordTabPlaybackSpeed,
  type WordTabVideoPlayerHandle,
} from "./WordTabVideoPlayer";
import { VideoExampleNavigation } from "./VideoExampleNavigation";
import { MissingWordExercise } from "./MissingWordExercise";

export type Stage2CompletionResult = {
  passedFirstTry: boolean;
  typedAnswer: string;
  usedVideo: boolean;
  attempts: number;
};

export function ContextualLearningStage({
  word,
  onComplete,
}: {
  word: Word;
  onComplete: (result: Stage2CompletionResult) => void;
}) {
  const playerRef = useRef<WordTabVideoPlayerHandle>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [discovery, setDiscovery] = useState<VideoDiscoveryResponse | null>(null);
  const [videos, setVideos] = useState<VerifiedVideoExample[]>([]);
  const [videoIndex, setVideoIndex] = useState(0);
  const [fallbackIndex, setFallbackIndex] = useState(0);

  // Player state synchronized with WordTabVideoPlayer
  const [playerReady, setPlayerReady] = useState(false);
  const [playerPlaying, setPlayerPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<WordTabPlaybackSpeed>(1);
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(0);

  // Exercise completion tracking across examples
  const [solvedCurrent, setSolvedCurrent] = useState(false);
  const [solvedAny, setSolvedAny] = useState(false);
  const [firstTryPassed, setFirstTryPassed] = useState(true);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [lastTypedAnswer, setLastTypedAnswer] = useState(word.text);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setDiscovery(null);
    setVideos([]);
    setVideoIndex(0);
    setFallbackIndex(0);
    setPlayerReady(false);
    setPlayerPlaying(false);
    setCurrentTimeSec(0);
    setSolvedCurrent(false);
    setSolvedAny(false);
    setFirstTryPassed(true);
    setTotalAttempts(0);
    setLastTypedAnswer(word.text);

    fetchContextualVideos(word)
      .then((res) => {
        if (!active) return;
        setDiscovery(res);
        setVideos(res.videos);
        if (res.videos[0]) {
          setCurrentTimeSec(res.videos[0].timestampSeconds);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Could not search verified videos.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [word]);

  const fallbackList: FallbackContextExample[] = useMemo(() => {
    if (discovery?.fallbackContexts && discovery.fallbackContexts.length > 0) {
      return discovery.fallbackContexts;
    }
    return discovery?.fallbackContext ? [discovery.fallbackContext] : [];
  }, [discovery]);

  const activeClip = videos[videoIndex] ?? null;
  const activeFallback = !activeClip ? fallbackList[fallbackIndex] ?? null : null;
  const activeSentence = activeClip?.contextSentence || activeFallback?.sentence || "";

  const masked = useMemo(
    () => (activeSentence ? maskWordInSentence(activeSentence, word.text) : null),
    [activeSentence, word.text],
  );

  const handlePrevVideo = useCallback(() => {
    if (videos.length <= 1) return;
    setVideoIndex((i) => (i - 1 + videos.length) % videos.length);
    setSolvedCurrent(false);
  }, [videos.length]);

  const handleNextVideo = useCallback(() => {
    if (videos.length <= 1) return;
    setVideoIndex((i) => (i + 1) % videos.length);
    setSolvedCurrent(false);
  }, [videos.length]);

  const handleNextFallback = useCallback(() => {
    if (fallbackList.length <= 1) return;
    setFallbackIndex((i) => (i + 1) % fallbackList.length);
    setSolvedCurrent(false);
  }, [fallbackList.length]);

  const handleUnavailableClip = useCallback((unavailable: VerifiedVideoExample) => {
    void markVideoUnavailable(unavailable.youtubeVideoId);
    setVideos((prev) => prev.filter((c) => c.id !== unavailable.id));
    setSolvedCurrent(false);
  }, []);

  useEffect(() => {
    setVideoIndex((idx) => (videos.length === 0 ? 0 : idx % videos.length));
  }, [videos.length]);

  const handleSolved = useCallback(
    (details: { hiddenWord: string; attempts: number; passedFirstTry: boolean }) => {
      setSolvedCurrent(true);
      setSolvedAny(true);
      setLastTypedAnswer(details.hiddenWord);
      setTotalAttempts((prev) => prev + details.attempts);
      if (!details.passedFirstTry) setFirstTryPassed(false);
    },
    [],
  );

  const finishStage = useCallback(
    (usedVideo: boolean) => {
      onComplete({
        passedFirstTry: firstTryPassed,
        typedAnswer: lastTypedAnswer || word.text,
        usedVideo,
        attempts: Math.max(1, totalAttempts),
      });
    },
    [firstTryPassed, lastTypedAnswer, onComplete, totalAttempts, word.text],
  );

  if (loading) {
    return (
      <section aria-busy="true" className="apple-card w-full p-5 sm:p-7 grid gap-5">
        <div className="flex items-center gap-3">
          <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-subtitle border-t-transparent shrink-0" />
          <div className="space-y-0.5">
            <p className="text-sm sm:text-base font-bold text-ink">
              Finding verified video examples…
            </p>
            <p className="text-xs text-muted">
              Checking your video library and verifying spoken transcripts
            </p>
          </div>
        </div>
        <div className="aspect-video w-full rounded-2xl bg-line/40 animate-pulse" />
        <div className="h-14 w-full rounded-2xl bg-line/30 animate-pulse" />
      </section>
    );
  }

  return (
    <section
      aria-labelledby="stage2-heading"
      className="apple-card w-full max-w-full overflow-x-clip p-4 sm:p-7 grid gap-5 min-w-0"
    >
      {/* HEADER: Stage progress, non-spoiler prompt & real example count */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1 min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-subtitle/20 border border-subtitle/30 px-3 py-0.5 text-xs font-bold text-ink">
            Stage 2 · Contextual Learning
          </span>
          <h2 id="stage2-heading" className="text-lg sm:text-2xl font-extrabold text-ink">
            {solvedCurrent || solvedAny
              ? `You practiced “${word.text}” in context`
              : activeClip
              ? "Watch the clip & type the missing word"
              : "Complete the missing word in context"}
          </h2>
        </div>

        {videos.length > 0 ? (
          <span
            data-testid="video-example-badge"
            className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-bold text-ink tabular-nums"
          >
            Example {videoIndex + 1} of {videos.length}
          </span>
        ) : fallbackList.length > 1 ? (
          <span className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-bold text-ink tabular-nums">
            Text Example {fallbackIndex + 1} of {fallbackList.length}
          </span>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="rounded-xl bg-bad-soft px-4 py-3 text-xs sm:text-sm text-bad">
          {error}
        </p>
      ) : null}

      {/* VIDEO: Custom WordTap YouTube Player + Navigation (when verified videos exist) */}
      {activeClip ? (
        <div className="grid gap-3 min-w-0">
          <WordTabVideoPlayer
            ref={playerRef}
            clip={activeClip}
            total={videos.length}
            speed={playbackSpeed}
            onReadyChange={setPlayerReady}
            onPlayingChange={setPlayerPlaying}
            onTimeUpdate={setCurrentTimeSec}
            onUnavailable={handleUnavailableClip}
            onSkipNext={handleNextVideo}
          />
          <VideoExampleNavigation
            index={videoIndex}
            total={videos.length}
            timestampSeconds={activeClip.timestampSeconds}
            ready={playerReady}
            playing={playerPlaying}
            speed={playbackSpeed}
            onTogglePlay={() => playerRef.current?.togglePlay()}
            onReplay={() => playerRef.current?.replay()}
            onRewind={() => playerRef.current?.rewind(3)}
            onSpeedChange={setPlaybackSpeed}
            onPrev={handlePrevVideo}
            onNext={handleNextVideo}
          />
        </div>
      ) : (
        /* FALLBACK (Section 5): Smooth, clearly labeled text & audio fallback — never feels broken */
        <div
          data-testid="stage2-fallback-notice"
          className="rounded-2xl border border-line bg-black/[0.02] dark:bg-white/[0.03] px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="space-y-0.5 min-w-0">
            <p className="text-sm font-bold text-ink">
              Contextual text &amp; audio practice
            </p>
            <p className="text-xs text-muted">
              {masked
                ? "No verified video clip matched this word yet — listen to the pronunciation and complete the real context sentence below."
                : "No verified video clip matched this word yet — continue directly to Stage 3 to practice writing your own sentence."}
            </p>
          </div>
          {!masked ? (
            <button
              type="button"
              onClick={() => finishStage(false)}
              className="btn btn-primary shrink-0 min-h-10 px-5 text-xs sm:text-sm font-bold cursor-pointer"
            >
              Continue to Stage 3 →
            </button>
          ) : null}
        </div>
      )}

      {/* CAPTIONS & MISSING-WORD EXERCISE */}
      {masked ? (
        <MissingWordExercise
          key={`${word.id}-${activeClip ? activeClip.id : `fallback-${fallbackIndex}`}`}
          masked={masked}
          fullSentence={activeSentence}
          targetWord={word.text}
          srcLang={word.src_lang || "en"}
          targetLang={word.target_lang || undefined}
          sourceTitle={activeClip?.videoTitle || activeFallback?.sourceLabel || "Stage 2 Context"}
          sourceUrl={activeClip?.youtubeUrl || ""}
          captionLabel={
            activeClip
              ? "Listen to the clip and type the missing word:"
              : activeFallback?.sourceLabel || "Text example (non-video fallback):"
          }
          captionCues={activeClip?.captionCues}
          currentTimeSec={activeClip ? currentTimeSec : undefined}
          isVideoMode={Boolean(activeClip)}
          hasMoreExamples={activeClip ? videos.length > 1 : fallbackList.length > 1}
          onWordLookupOpen={activeClip ? () => playerRef.current?.pause() : undefined}
          onReplay={activeClip ? () => playerRef.current?.replay() : undefined}
          onNextExample={activeClip ? handleNextVideo : handleNextFallback}
          onSolved={handleSolved}
          onContinue={() => finishStage(Boolean(activeClip))}
        />
      ) : null}

      {/* Allow continuing if user already completed an example and switched to explore another */}
      {solvedAny && !solvedCurrent ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => finishStage(Boolean(activeClip))}
            className="btn btn-primary min-h-10 px-5 text-xs sm:text-sm font-bold cursor-pointer"
          >
            Continue to Stage 3 →
          </button>
        </div>
      ) : null}

      {/* Fallback skip option so user is never stuck when no video exists */}
      {!activeClip && masked && !solvedAny ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => finishStage(false)}
            className="btn btn-quiet min-h-9 px-3.5 text-xs font-semibold cursor-pointer"
          >
            Skip fallback &amp; continue to Stage 3 →
          </button>
        </div>
      ) : null}
    </section>
  );
}

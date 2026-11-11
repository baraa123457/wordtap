import Link from "next/link";
import type { Word } from "@/lib/schemas";
import { canSpeak, speak } from "@/lib/speech";
import { FireIcon, SpeakerIcon } from "../Icons";

export type SaveState = "idle" | "saving" | "saved" | "error";

type Props = {
  xp: number;
  asked: number;
  right: number;
  missed: Word[];
  save: SaveState;
  reviewFailed: boolean;
  onRetrySave: () => void;
  onAgain: () => void;
};

export function Summary({ xp, asked, right, missed, save, reviewFailed, onRetrySave, onAgain }: Props) {
  const accuracy = asked === 0 ? 100 : Math.round((right / asked) * 100);

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-8">
      <section className="frame" aria-label="Session summary">
        <div className="frame-bar">
          <span className="flex items-center gap-1.5 font-semibold">
            <FireIcon size={16} className="text-orange-500" />
            <span>Practice complete</span>
          </span>
          <span>
            {asked} {asked === 1 ? "question" : "questions"}
          </span>
        </div>
        <div className="frame-stage gap-2" style={{ minHeight: "11rem" }}>
          <p className="sub text-5xl">
            +<span className="sub-hl">{xp}</span> XP
          </p>
          <p className="text-xs sm:text-sm text-white/70">
            {accuracy >= 80 ? "Great memory retention!" : "Good practice session!"}
          </p>
        </div>
        <div className="frame-bar flex items-center justify-between">
          <span>{accuracy}% right on the first try</span>
          <span aria-live="polite">
            {save === "saving" ? "Saving…" : save === "saved" ? "Progress saved ✓" : save === "error" ? "Not saved" : ""}
          </span>
        </div>
      </section>

      {/* Spaced repetition schedule preview */}
      <div className="apple-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm">
        <div className="space-y-0.5">
          <p className="font-semibold text-ink">Spaced Repetition Updated</p>
          <p className="text-muted">Mastered words move to longer intervals. Review words return tomorrow.</p>
        </div>
        <div className="shrink-0 flex items-center gap-1.5 text-xs text-subtitle-edge dark:text-subtitle font-bold bg-subtitle/10 px-3 py-1.5 rounded-full">
          <span>Streak maintained 🔥</span>
        </div>
      </div>

      {save === "error" ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-bad-soft px-4 py-3 text-bad">
          <span>Your XP and streak could not be saved.</span>
          <button type="button" className="btn min-h-9 px-3 py-1 text-sm" onClick={onRetrySave}>
            Try again
          </button>
        </div>
      ) : null}
      {reviewFailed ? (
        <p role="alert" className="rounded-2xl bg-bad-soft px-4 py-3 text-bad">
          Some answers could not be saved, so those words may come back sooner than planned.
        </p>
      ) : null}

      {missed.length > 0 ? (
        <section aria-labelledby="missed" className="grid gap-3">
          <h2 id="missed" className="text-lg font-semibold text-ink">
            Words to look at again ({missed.length})
          </h2>
          <ul className="apple-card divide-y divide-line overflow-hidden">
            {missed.map((w) => (
              <li key={w.id} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-black/[0.015] dark:hover:bg-white/[0.015]">
                <div className="flex items-center gap-3 min-w-0">
                  <span dir="auto" className="font-semibold text-ink truncate">
                    {w.text}
                  </span>
                  {canSpeak() ? (
                    <button
                      type="button"
                      aria-label={`Hear “${w.text}”`}
                      title={`Pronounce “${w.text}”`}
                      className="p-1 rounded-full text-muted hover:text-ink cursor-pointer"
                      onClick={() => speak(w.text, w.src_lang)}
                    >
                      <SpeakerIcon size={16} />
                    </button>
                  ) : null}
                </div>
                <span dir="auto" className="text-muted truncate text-sm">
                  {w.translation}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <div className="apple-card p-4 text-center text-sm font-semibold text-ok-ink">
          🎉 Every word right on the first try! Excellent work.
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn btn-primary" onClick={onAgain}>
          Practice again
        </button>
        <Link href="/dashboard" className="btn">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

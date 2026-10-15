import Link from "next/link";
import type { Word } from "@/lib/schemas";

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
    <div className="mx-auto grid w-full max-w-3xl gap-8 px-4 py-8">
      <section className="frame" aria-label="Session summary">
        <div className="frame-bar">
          <span>Practice complete</span>
          <span>
            {asked} {asked === 1 ? "question" : "questions"}
          </span>
        </div>
        <div className="frame-stage" style={{ minHeight: "11rem" }}>
          <p className="sub text-5xl">
            +<span className="sub-hl">{xp}</span> XP
          </p>
        </div>
        <div className="frame-bar">
          <span>{accuracy}% right on the first try</span>
          <span aria-live="polite">
            {save === "saving" ? "Saving…" : save === "saved" ? "Progress saved" : save === "error" ? "Not saved" : ""}
          </span>
        </div>
      </section>

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
          <h2 id="missed" className="text-xl font-semibold">
            Words to look at again
          </h2>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {missed.map((w) => (
              <li key={w.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <span dir="auto" className="font-semibold">
                  {w.text}
                </span>
                <span dir="auto" className="text-muted">
                  {w.translation}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="text-lg">Every word right on the first try.</p>
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

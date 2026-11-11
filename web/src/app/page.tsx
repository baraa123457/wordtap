import Link from "next/link";
import { AuthActions } from "@/components/AuthActions";
import { Logo } from "@/components/Logo";
import { SubtitleDemo } from "@/components/SubtitleDemo";
import { ThemeToggle } from "@/components/ThemeToggle";

const STEPS = [
  {
    title: "Add the extension to Chrome",
    body: "Sign in once, from the extension's toolbar icon.",
  },
  {
    title: "Tap words while you watch",
    body: "Click any word in YouTube or Netflix subtitles. The translation appears and the word is saved to your account.",
  },
  {
    title: "Practice them here",
    body: "Short sessions with multiple choice, typing, matching and listening. Words you miss come back sooner.",
  },
] as const;

export default function LandingPage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 sm:px-6">
      <header className="flex items-center justify-between py-5">
        <Logo />
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <AuthActions size="nav" />
        </div>
      </header>

      <main className="flex-1 pb-20">
        <section className="grid gap-10 pt-8 sm:pt-14 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div className="grid gap-6">
            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
              Tap a word while you watch. Practice it later.
            </h1>
            <p className="max-w-md text-lg text-muted">
              WordTap keeps every subtitle word you translate and turns your list into short daily
              practice, so the words from your favorite shows actually stick.
            </p>
            <AuthActions size="hero" />
          </div>
          <SubtitleDemo />
        </section>

        <section className="mt-24 grid gap-8">
          <h2 className="text-2xl font-semibold">How it works</h2>
          <ol className="grid gap-6 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="grid content-start gap-3">
                <span
                  aria-hidden
                  className="grid h-9 w-9 place-items-center rounded-full bg-subtitle font-semibold text-subtitle-ink"
                >
                  {i + 1}
                </span>
                <h3 className="text-lg font-semibold">{step.title}</h3>
                <p className="text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
          <div className="pt-2">
            <Link
              href="/extension"
              className="inline-flex items-center gap-2 btn btn-primary px-5 py-2.5 font-bold shadow-sm"
            >
              <span>Get the Chrome Extension</span>
              <span>→</span>
            </Link>
          </div>
        </section>
      </main>

      {/* Brand Footer */}
      <footer className="border-t border-line/60 py-10 mt-12 text-sm text-muted">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Logo href="/" />
            <span className="text-xs text-muted/80">· Turn your favorite shows into real fluency</span>
          </div>
          <div className="flex items-center gap-6 text-xs font-medium">
            <Link href="/extension" className="hover:text-ink transition-colors">
              Extension
            </Link>
            <Link href="/login" className="hover:text-ink transition-colors">
              Sign in
            </Link>
            <Link href="/signup" className="hover:text-ink transition-colors">
              Sign up
            </Link>
          </div>
        </div>
        <div className="mt-6 pt-6 border-t border-line/30 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted">
          <p>© {new Date().getFullYear()} WordTap. Free during beta. Built for film & language lovers.</p>
          <p>YouTube & Netflix are registered trademarks of their respective owners.</p>
        </div>
      </footer>
    </div>
  );
}

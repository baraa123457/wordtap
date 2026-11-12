import Link from "next/link";
import { Logo } from "@/components/Logo";

export const metadata = {
  title: "Terms of Service · WordTap",
  description: "Terms of Service governing your use of WordTap and the WordTap Chrome Extension.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col px-4 sm:px-6 py-6">
      <header className="flex items-center justify-between border-b border-line/60 pb-4">
        <Logo href="/" />
        <Link href="/" className="text-xs font-semibold text-muted hover:text-ink">
          ← Back to home
        </Link>
      </header>

      <main className="flex-1 py-10 space-y-8 text-ink">
        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-subtitle">Legal & Trust</span>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Terms of Service</h1>
          <p className="text-xs sm:text-sm text-muted">Last updated: November 12, 2026</p>
        </div>

        <section className="apple-card p-6 sm:p-8 space-y-4">
          <h2 className="text-xl font-bold">1. Agreement to Terms</h2>
          <p className="text-sm leading-relaxed text-muted">
            By creating an account, visiting our website (<a href="https://wordtap.vercel.app" className="underline">https://wordtap.vercel.app</a>), or installing the WordTap Chrome extension, you agree to these Terms of Service. If you do not agree, do not use the service.
          </p>
        </section>

        <div className="space-y-6 text-sm leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-lg font-bold">2. What WordTap Does</h2>
            <p className="text-muted">
              WordTap is a language learning companion designed to help learners acquire vocabulary from video subtitles and text. We provide:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-muted">
              <li>A browser extension that allows you to click words in subtitles to display translations and save them to your account.</li>
              <li>A web application for practicing your saved vocabulary via spaced repetition exercises.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold">3. Third-Party Trademarks & Platforms</h2>
            <p className="text-muted">
              YouTube and Netflix are registered trademarks of their respective owners (Google LLC and Netflix, Inc.). WordTap is an independent software tool and is not endorsed by, sponsored by, or affiliated with YouTube, Netflix, or any video provider.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold">4. Your Account & Data Ownership</h2>
            <p className="text-muted">
              You own your saved words, translation notes, and study progress. You may export your entire vocabulary dataset at any time as CSV, and you may delete your account and all associated data permanently through your account settings.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold">5. Acceptable Use</h2>
            <p className="text-muted">
              You agree not to abuse WordTap APIs, reverse-engineer our proprietary scoring models, or attempt to overload our servers with automated scrapers or denial-of-service attempts.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold">6. Disclaimer & Limitation of Liability</h2>
            <p className="text-muted">
              WordTap is provided &quot;as is&quot; without warranties of any kind. Translations are machine-generated and may occasionally contain inaccuracies. WordTap is not liable for indirect or consequential damages resulting from your use of the service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold">7. Contact</h2>
            <div className="p-4 rounded-xl border border-line bg-surface/50 text-xs sm:text-sm text-muted">
              <p><strong>Entity:</strong> [LEGAL_ENTITY_NAME_PLACEHOLDER: WordTap]</p>
              <p><strong>Email:</strong> [CONTACT_EMAIL_PLACEHOLDER: support@wordtap.app]</p>
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-line/60 py-6 text-xs text-muted flex items-center justify-between">
        <span>© {new Date().getFullYear()} WordTap. All rights reserved.</span>
        <div className="flex gap-4">
          <Link href="/privacy" className="hover:text-ink">Privacy Policy</Link>
          <Link href="/" className="hover:text-ink">Home</Link>
        </div>
      </footer>
    </div>
  );
}

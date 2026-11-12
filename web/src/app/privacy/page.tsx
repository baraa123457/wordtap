import Link from "next/link";
import { Logo } from "@/components/Logo";

export const metadata = {
  title: "Privacy Policy · WordTap",
  description: "Plain language privacy policy explaining what WordTap reads, stores, and how you control your data.",
};

export default function PrivacyPage() {
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
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Privacy Policy</h1>
          <p className="text-xs sm:text-sm text-muted">Last updated: November 12, 2026</p>
        </div>

        <section className="apple-card p-6 sm:p-8 space-y-4">
          <h2 className="text-xl font-bold">In Plain English (The 30-Second Summary)</h2>
          <p className="text-sm leading-relaxed text-muted">
            WordTap exists to help you turn words from YouTube and Netflix subtitles into vocabulary you keep. We believe in total data ownership and zero creepy tracking.
          </p>
          <ul className="list-disc pl-5 space-y-2 text-sm text-muted">
            <li><strong>We only read subtitles when you click a word.</strong> We do not track your browsing history, web pages you visit, or what you watch.</li>
            <li><strong>Your saved vocabulary belongs to you.</strong> You can export every saved word at any time as CSV.</li>
            <li><strong>Instant deletion.</strong> When you delete your account in Settings, everything is permanently erased from our database immediately.</li>
          </ul>
        </section>

        <div className="space-y-6 text-sm leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-lg font-bold">1. What the Chrome Extension Reads</h2>
            <p className="text-muted">
              The WordTap Chrome extension only activates on video streaming platforms (such as YouTube and Netflix) when you turn on captions and click a word:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-muted">
              <li><strong>The clicked word:</strong> Sent to our translation API to show you the translation tooltip.</li>
              <li><strong>The active subtitle sentence:</strong> Stored alongside the word so you can review it in context during practice.</li>
              <li><strong>Video title and URL:</strong> Recorded optionally so you know where you discovered the word.</li>
            </ul>
            <p className="text-muted font-medium bg-surface/50 border border-line/60 p-3 rounded-xl">
              We never read your passwords, emails, form inputs, searches, or any web pages where you do not click a subtitle word.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold">2. What We Store and Where</h2>
            <p className="text-muted">
              All WordTap data is stored in our managed database hosted on <strong>Supabase</strong> with Row-Level Security (RLS) enabled. Each account can only access its own rows:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-muted">
              <li><strong>Account:</strong> Your email address and encrypted password hash (managed by Supabase Auth).</li>
              <li><strong>Vocabulary:</strong> Word text, translation, source sentence, source video title/URL, times seen, and spaced repetition box (0 to 5).</li>
              <li><strong>Practice stats:</strong> Total XP, current streak, best streak, and last practice date.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold">3. How to Export Your Data</h2>
            <p className="text-muted">
              You do not need to ask our permission or wait for an email. At any time:
            </p>
            <ol className="list-decimal pl-5 space-y-1.5 text-muted">
              <li>Go to <Link href="/settings" className="font-semibold text-ink underline underline-offset-4">Settings → Your Data</Link>.</li>
              <li>Click <strong>Export saved words (CSV)</strong>.</li>
              <li>A clean CSV file with all your words, translations, and example sentences will download instantly.</li>
            </ol>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold">4. How to Delete Your Account and All Data</h2>
            <p className="text-muted">
              You have complete right to erasure. In <Link href="/settings" className="font-semibold text-ink underline underline-offset-4">Settings → Delete Account</Link>, click <strong>Delete account</strong> and confirm. Our database immediately and permanently deletes:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-muted">
              <li>All your saved words and sentences.</li>
              <li>All your practice stats, Leitner progress, and streaks.</li>
              <li>Your auth user record and credentials.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold">5. Contact Information</h2>
            <p className="text-muted">
              If you have any questions about this Privacy Policy or how your data is handled, please reach out:
            </p>
            <div className="p-4 rounded-xl border border-line bg-surface/50 text-xs sm:text-sm text-muted">
              <p><strong>Entity:</strong> [LEGAL_ENTITY_NAME_PLACEHOLDER: WordTap]</p>
              <p><strong>Contact Email:</strong> [CONTACT_EMAIL_PLACEHOLDER: privacy@wordtap.app]</p>
              <p><strong>Website:</strong> <a href="https://wordtap.vercel.app" className="underline underline-offset-4">https://wordtap.vercel.app</a></p>
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-line/60 py-6 text-xs text-muted flex items-center justify-between">
        <span>© {new Date().getFullYear()} WordTap. All rights reserved.</span>
        <div className="flex gap-4">
          <Link href="/terms" className="hover:text-ink">Terms of Service</Link>
          <Link href="/" className="hover:text-ink">Home</Link>
        </div>
      </footer>
    </div>
  );
}

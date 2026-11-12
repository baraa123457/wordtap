"use client";

import { AppShell } from "@/components/AppShell";

const STEPS = [
  {
    num: "1",
    title: "Download & Unzip the Extension",
    body: (
      <span>
        Download{" "}
        <a
          href="/wordtap-extension.zip"
          download
          className="font-bold text-subtitle hover:underline underline-offset-4"
        >
          wordtap-extension.zip
        </a>{" "}
        and extract the folder anywhere on your computer.
      </span>
    ),
  },
  {
    num: "2",
    title: "Load into Chrome / Edge / Brave",
    body: (
      <span>
        Navigate to{" "}
        <code className="rounded-lg bg-black/5 dark:bg-white/10 px-2 py-0.5 font-mono text-xs text-ink font-semibold border border-line">
          chrome://extensions
        </code>
        , enable <strong>Developer mode</strong> in the top right, then click <strong>Load unpacked</strong> and select the unzipped folder.
      </span>
    ),
  },
  {
    num: "3",
    title: "Sign in via Extension Popup",
    body: (
      <span>
        Click the WordTap puzzle icon in your browser toolbar and log in with your account. All words you tap will sync here immediately!
      </span>
    ),
  },
  {
    num: "4",
    title: "Tap Words on Subtitles & Web Pages",
    body: (
      <span>
        Click any word in video subtitles on YouTube, Netflix, Prime Video, Disney+, Udemy, Coursera, or TED — or highlight text on any webpage, or press <kbd className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 border border-line text-[11px] font-mono">Alt+S</kbd> for Screen OCR!
      </span>
    ),
  },
] as const;

export default function ExtensionPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-8 pb-16">
        {/* Hero Card */}
        <div className="apple-card p-6 sm:p-8 relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
            <div className="space-y-2 max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-subtitle/15 border border-subtitle/30 text-xs font-bold text-ink">
                <span className="w-2 h-2 rounded-full bg-subtitle animate-pulse" />
                <span>WordTap Chrome Extension</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink">
                Learn languages while watching your favorite shows.
              </h1>
              <p className="text-sm sm:text-base text-muted leading-relaxed">
                Add click-to-translate superpowers to subtitles on YouTube and Netflix. Every word you tap is saved directly to your WordTap library with smart SRS flashcard reviews.
              </p>
            </div>

            <div className="shrink-0 flex flex-col items-start sm:items-end gap-2">
              <a
                href="/wordtap-extension.zip"
                download
                className="btn btn-primary min-h-12 px-6 text-sm sm:text-base font-bold shadow-md hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>Download Extension</span>
              </a>
              <span className="text-[11px] text-muted">Free · ZIP bundle · Chrome & Edge</span>
            </div>
          </div>
        </div>

        {/* 4 Steps Section */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-ink px-1 flex items-center gap-2">
            <span>Setup Guide</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-subtitle/15 text-ink">
              Takes &lt; 2 minutes
            </span>
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            {STEPS.map((step) => (
              <div
                key={step.num}
                className="apple-card p-5 flex flex-col justify-between gap-3 hover:border-subtitle/50 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-xl bg-subtitle text-subtitle-ink font-extrabold text-sm flex items-center justify-center shadow-xs shrink-0 group-hover:scale-110 transition-transform">
                    {step.num}
                  </span>
                  <h3 className="font-bold text-base text-ink leading-snug">
                    {step.title}
                  </h3>
                </div>
                <div className="text-xs sm:text-sm text-muted leading-relaxed">
                  {step.body}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Extension Features & Settings in the Popup */}
        <div className="apple-card p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <span className="text-subtitle font-bold text-lg">⚙️</span>
            <h3 className="text-lg font-bold text-ink">Settings available in the extension popup</h3>
          </div>
          <p className="text-xs sm:text-sm text-muted leading-relaxed">
            Click the WordTap icon in your browser toolbar anytime to customize:
          </p>
          <ul className="grid gap-2 sm:grid-cols-2 text-xs sm:text-sm text-muted">
            <li className="flex items-center gap-2">
              <span className="text-subtitle font-bold">✓</span>
              <span>Target language (Arabic, German, Spanish, French, etc.)</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-subtitle font-bold">✓</span>
              <span>Selection trigger: Pop-up card, Floating icon, or Hold Alt</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-subtitle font-bold">✓</span>
              <span>Screen Capture OCR (Alt+S) &amp; right-click translate</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-subtitle font-bold">✓</span>
              <span>Word saving mode (Manual, Subtitles only, or Auto-save all)</span>
            </li>
          </ul>
        </div>
      </div>
    </AppShell>
  );
}

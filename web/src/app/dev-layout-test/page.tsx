"use client";

import React, { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { SegmentedControl } from "@/components/SegmentedControl";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Logo } from "@/components/Logo";
import { StarIcon, DownloadIcon, PlayIcon, SpeakerIcon } from "@/components/Icons";

const MOCK_NAV_LINKS = [
  { href: "/dev-layout-test?tab=dashboard", label: "Dashboard", shortLabel: "Dashboard", tab: "dashboard" },
  { href: "/dev-layout-test?tab=decks", label: "Decks", shortLabel: "Decks", tab: "decks" },
  { href: "/dev-layout-test?tab=words", label: "My words", shortLabel: "Words", tab: "words" },
  { href: "/dev-layout-test?tab=history", label: "History", shortLabel: "History", tab: "history" },
  { href: "/dev-layout-test?tab=download", label: "Downloads", shortLabel: "Downloads", isDownload: true, tab: "download" },
  { href: "/dev-layout-test?tab=pricing", label: "Pro", shortLabel: "Pro", isPro: true, tab: "pricing" },
  { href: "/dev-layout-test?tab=settings", label: "Settings", shortLabel: "Settings", tab: "settings" },
];

function DevLayoutContent() {
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") || "words";
  const [langFilter, setLangFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deckView, setDeckView] = useState("media");
  const [mediaCategory, setMediaCategory] = useState("all");
  const [activeTab, setActiveTab] = useState(currentTab);

  return (
    <div className="flex min-h-dvh w-full flex-col">
      {/* Real AppShell Nav Header */}
      <header className="sticky top-0 z-40 w-full apple-glass transition-colors pt-safe">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 sm:px-6 lg:flex-nowrap lg:py-2.5">
          <div className="order-1 flex items-center shrink-0">
            <Logo href="/dev-layout-test" />
          </div>

          <div className="order-2 flex items-center gap-1.5 sm:gap-2 xl:gap-2.5 shrink-0 lg:order-3">
            <ThemeToggle />
            <span
              className="hidden xl:inline max-w-36 2xl:max-w-44 truncate text-[length:var(--text-label)] font-medium text-muted"
              title="learner@wordtap.app"
            >
              learner@wordtap.app
            </span>
            <button
              type="button"
              className="btn btn-quiet min-h-11 px-3 text-[length:var(--text-control)] font-medium whitespace-nowrap shrink-0 cursor-pointer text-ink hover:text-red-500 transition-colors"
            >
              Sign out
            </button>
          </div>

          <nav
            aria-label="Main Navigation"
            className="order-3 flex w-full min-w-0 justify-center py-0.5 lg:order-2 lg:flex-1 lg:py-0"
          >
            <div className="apple-segmented-container app-nav-pill">
              {MOCK_NAV_LINKS.map((link, idx) => {
                const active = activeTab === link.tab;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setActiveTab(link.tab)}
                    aria-current={active ? "page" : undefined}
                    data-active={active ? "true" : undefined}
                    data-is-first={idx === 0 ? "true" : undefined}
                    className={`apple-segmented-item whitespace-nowrap min-w-0 min-h-11 px-3.5 py-2 text-[length:var(--text-control)] font-semibold flex items-center justify-center shrink-0 ${
                      active
                        ? "bg-surface text-ink shadow-sm border border-line"
                        : "text-muted hover:text-ink"
                    }`}
                    style={{ flex: "0 0 auto" }}
                  >
                    {link.isPro ? (
                      <span className="inline-flex items-center gap-1.5 min-w-0">
                        <StarIcon size={12} filled className="text-amber-500 dark:text-subtitle shrink-0" />
                        <span className="hidden sm:inline">{link.label}</span>
                        <span className="sm:hidden">{link.shortLabel}</span>
                      </span>
                    ) : link.isDownload ? (
                      <span className="inline-flex items-center gap-1.5 min-w-0">
                        <DownloadIcon size={12} className="shrink-0 opacity-80" />
                        <span className="hidden sm:inline">{link.label}</span>
                        <span className="sm:hidden">{link.shortLabel}</span>
                      </span>
                    ) : (
                      <span className="min-w-0">
                        <span className="hidden sm:inline">{link.label}</span>
                        <span className="sm:hidden">{link.shortLabel}</span>
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto w-full max-w-5xl min-w-0 flex-1 overflow-x-clip px-3.5 sm:px-6 pb-12 pt-4 sm:pt-6">
        {activeTab === "words" && (
          <div className="grid gap-6">
            <div className="flex flex-wrap items-end justify-between gap-3 sm:gap-4">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                My words (173)
              </h1>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  className="btn min-h-11 px-3.5 py-2 text-[length:var(--text-control)] font-semibold flex items-center gap-1.5"
                >
                  Export ▾
                </button>
                <button
                  type="button"
                  className="btn min-h-11 px-3.5 py-2 text-[length:var(--text-control)] font-semibold flex items-center gap-1.5"
                >
                  Import ▾
                </button>
                <button
                  type="button"
                  className="btn min-h-11 px-3.5 py-2 text-[length:var(--text-control)] font-semibold"
                >
                  Select
                </button>
                <button
                  type="button"
                  className="btn min-h-11 px-3.5 py-2 text-[length:var(--text-control)] font-semibold"
                >
                  + Add word
                </button>
                <button
                  type="button"
                  className="btn btn-primary min-h-11 px-4 py-2 text-[length:var(--text-control)] font-bold shadow-xs"
                >
                  Start practice
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 sm:gap-4 max-w-full min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 max-w-full min-w-0">
                <span className="text-[length:var(--text-label)] font-semibold text-muted shrink-0">Language:</span>
                <SegmentedControl
                  ariaLabel="Filter words by language"
                  value={langFilter}
                  onChange={setLangFilter}
                  options={[
                    { value: "all", label: "All (173)" },
                    { value: "en", label: "English (169)" },
                    { value: "de", label: "German (4)" },
                  ]}
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 max-w-full min-w-0">
                <span className="text-[length:var(--text-label)] font-semibold text-muted shrink-0">Source:</span>
                <SegmentedControl
                  ariaLabel="Filter words by source"
                  value={sourceFilter}
                  onChange={setSourceFilter}
                  options={[
                    { value: "all", label: "All" },
                    { value: "subtitles", label: "Subtitles" },
                    { value: "app", label: "App" },
                    { value: "web", label: "Web" },
                    { value: "ocr", label: "OCR" },
                    { value: "translator", label: "Translator" },
                  ]}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="relative">
                <input
                  className="field pl-4"
                  type="search"
                  placeholder="Search words or translations..."
                  aria-label="Search words"
                />
              </div>
              <div className="py-1 max-w-full min-w-0">
                <SegmentedControl
                  ariaLabel="Filter words by learning status"
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={[
                    { value: "all", label: "All" },
                    { value: "due", label: "Due" },
                    { value: "learning", label: "Learning" },
                    { value: "mastered", label: "Mastered" },
                  ]}
                />
              </div>
            </div>

            {/* Word Card Examples */}
            <div className="apple-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg text-ink">resilient</span>
                  <button type="button" className="text-muted hover:text-ink min-h-11 min-w-11 inline-flex items-center justify-center">
                    <SpeakerIcon size={16} />
                  </button>
                  <select
                    className="cursor-pointer appearance-none rounded-md border border-line bg-surface px-2.5 py-1 pr-5 text-[length:var(--text-control)] min-h-11 font-bold uppercase tracking-wider text-muted"
                  >
                    <option>EN</option>
                  </select>
                </div>
                <p className="text-sm text-muted">مرن / قادر على التعافي</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" className="btn btn-primary min-h-11 px-3.5 text-[length:var(--text-control)] font-bold">
                  Learn
                </button>
                <button type="button" className="btn btn-quiet min-h-11 px-3.5 text-[length:var(--text-control)] font-medium">
                  Edit
                </button>
                <button type="button" className="btn btn-quiet min-h-11 px-3.5 text-[length:var(--text-control)] font-medium text-muted hover:text-bad">
                  Remove
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "decks" && (
          <div className="grid gap-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Show Decks &amp; Media</h1>
              <p className="max-w-2xl text-sm sm:text-base text-muted mt-1">
                Practice words you collected while watching movies and TV series.
              </p>
            </div>

            {/* Decks filled tabs */}
            <div className="w-full max-w-md mx-0">
              <SegmentedControl
                ariaLabel="Decks switcher"
                fill
                value={deckView}
                onChange={setDeckView}
                options={[
                  {
                    value: "media",
                    label: (
                      <span className="inline-flex items-center justify-center gap-1.5 min-w-0 truncate">
                        <span className="sm:hidden truncate">My Decks</span>
                        <span className="hidden sm:inline truncate">🎬 My Show &amp; Media Decks</span>
                        <span className="rounded-full bg-subtitle/20 px-1.5 py-0.2 text-[length:var(--text-label)] font-bold text-amber-900 dark:text-subtitle shrink-0">
                          47
                        </span>
                      </span>
                    ),
                  },
                  {
                    value: "curated",
                    label: (
                      <span className="inline-flex items-center justify-center gap-1.5 min-w-0 truncate">
                        <span className="sm:hidden truncate">Curated</span>
                        <span className="hidden sm:inline truncate">🌟 Curated Show Decks</span>
                      </span>
                    ),
                  },
                ]}
              />
            </div>

            {/* Show filter pills */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <SegmentedControl
                ariaLabel="Filter media decks"
                value={mediaCategory}
                onChange={setMediaCategory}
                options={[
                  { value: "all", label: "All Shows (47)" },
                  { value: "netflix", label: "🎬 Netflix" },
                  { value: "youtube", label: "▶️ YouTube" },
                  { value: "vlc", label: "🍿 VLC Player" },
                  { value: "web", label: "🌐 Web" },
                ]}
              />
              <input
                type="search"
                placeholder="Search show decks..."
                className="field sm:w-64"
              />
            </div>

            {/* Deck Card */}
            <div className="apple-card p-6 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🍿</span>
                <div>
                  <h3 className="font-bold text-lg text-ink">Interstellar (2014)</h3>
                  <p className="text-sm text-muted">24 words captured from subtitles</p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-line/60 pt-4">
                <button type="button" className="btn btn-quiet min-h-11 px-3.5 text-[length:var(--text-control)] font-semibold">
                  Preview Words
                </button>
                <button type="button" className="btn btn-primary min-h-11 px-4 text-[length:var(--text-control)] font-bold inline-flex items-center gap-1.5">
                  <PlayIcon size={11} />
                  <span>Practice</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "dashboard" && (
          <div className="grid gap-6">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard Overview</h1>

            <div className="apple-card p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-ink">Daily Fluency Goal</h3>
                  <p className="text-sm text-muted">Complete reviews to preserve your streak</p>
                </div>
                <button type="button" className="btn btn-primary min-h-11 px-4 text-[length:var(--text-control)] font-bold">
                  Start Practice (15 Due)
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function DevLayoutTestPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading layout preview...</div>}>
      <DevLayoutContent />
    </Suspense>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { trackEvent } from "@/lib/analytics";
import {
  WindowsIcon,
  ChromeIcon,
  DownloadIcon,
  CheckIcon,
  SparklesIcon,
} from "@/components/Icons";

const DESKTOP_FEATURES = [
  {
    icon: "🎬",
    title: "VLC Core Engine",
    desc: "Plays MKV, MP4, AVI, WebM, and HEVC 4K/HDR with hardware acceleration.",
  },
  {
    icon: "🔊",
    title: "200% Volume Boost",
    desc: "VLC-style audio gain amplification so dialogue is always crystal-clear.",
  },
  {
    icon: "⚡",
    title: "Dolby AC3 / DTS Transcoding",
    desc: "Real-time background audio transcoding for multi-channel cinema tracks.",
  },
  {
    icon: "⏱️",
    title: "VLC Speed Bar & Hotkeys",
    desc: "Adjust speed from 0.25x to 3.0x with [ and ] shortcuts or slider bar.",
  },
  {
    icon: "🔍",
    title: "VLsub OpenSubtitles",
    desc: "Search, download, and sync subtitles for any movie inside the player.",
  },
  {
    icon: "🌓",
    title: "Dark & Light Cinema Modes",
    desc: "Seamlessly switch between Dark Theater and Daylight mode with 'T' key.",
  },
  {
    icon: "💾",
    title: "Offline Storage & Cloud Sync",
    desc: "Tap words offline during flights; words sync to your web library automatically.",
  },
  {
    icon: "⭐",
    title: "Interactive Click-to-Translate",
    desc: "Tap any subtitle word for dictionary definitions and instant SRS flashcards.",
  },
] as const;

const EXTENSION_STEPS = [
  {
    num: "1",
    title: "Download & Extract ZIP",
    body: (
      <span>
        Download{" "}
        <a
          href="/wordtap-extension.zip"
          download
          onClick={() => void trackEvent("extension_connected")}
          className="font-bold text-amber-700 dark:text-subtitle hover:underline underline-offset-4"
        >
          wordtap-extension.zip
        </a>{" "}
        and extract the folder on your computer.
      </span>
    ),
  },
  {
    num: "2",
    title: "Open Extension Settings",
    body: (
      <span>
        Navigate to{" "}
        <code className="rounded-lg bg-black/5 dark:bg-white/10 px-2 py-0.5 font-mono text-xs text-ink font-semibold border border-line">
          chrome://extensions
        </code>{" "}
        in Chrome, Edge, or Brave.
      </span>
    ),
  },
  {
    num: "3",
    title: "Enable Developer Mode & Load",
    body: (
      <span>
        Toggle <strong>Developer mode</strong> in the top-right corner, click <strong>Load unpacked</strong>, and select the extracted folder.
      </span>
    ),
  },
  {
    num: "4",
    title: "Pin & Start Watching",
    body: (
      <span>
        Pin WordTap to your browser toolbar, sign in with your account, and enjoy interactive subtitles on YouTube &amp; Netflix!
      </span>
    ),
  },
] as const;

export default function DownloadPage() {
  const [activeTab, setActiveTab] = useState<"all" | "desktop" | "extension">("all");
  const [copiedExtensionsUrl, setCopiedExtensionsUrl] = useState(false);

  const copyChromeUrl = () => {
    navigator.clipboard?.writeText("chrome://extensions");
    setCopiedExtensionsUrl(true);
    setTimeout(() => setCopiedExtensionsUrl(false), 2000);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-10 pb-20 pt-2 sm:pt-6">
        {/* Page Hero Header */}
        <div className="text-center space-y-4 max-w-3xl mx-auto px-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-subtitle/15 border border-subtitle/30 text-xs font-bold text-ink">
            <SparklesIcon size={14} className="text-amber-800 dark:text-subtitle" />
            <span>WordTap Ecosystem · Desktop Player &amp; Browser Extension</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-ink">
            Download WordTap
          </h1>

          <p className="text-sm sm:text-base text-muted leading-relaxed">
            Turn your favorite movies, series, and online videos into real vocabulary fluency. Available as a full-featured Windows desktop video player and a browser extension.
          </p>

          {/* Tab Filter Switcher */}
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-black/5 dark:bg-white/5 border border-line">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === "all"
                  ? "bg-surface text-ink shadow-xs"
                  : "text-muted hover:text-ink"
              }`}
            >
              All Downloads
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("desktop")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === "desktop"
                  ? "bg-surface text-ink shadow-xs"
                  : "text-muted hover:text-ink"
              }`}
            >
              <WindowsIcon size={12} />
              <span>Desktop App (Windows)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("extension")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === "extension"
                  ? "bg-surface text-ink shadow-xs"
                  : "text-muted hover:text-ink"
              }`}
            >
              <ChromeIcon size={12} />
              <span>Browser Extension</span>
            </button>
          </div>
        </div>

        {/* Section 1: Desktop Player App */}
        {(activeTab === "all" || activeTab === "desktop") && (
          <section id="desktop" className="apple-card p-6 sm:p-8 space-y-8 border border-line bg-surface/90 shadow-xl relative overflow-hidden">
            {/* Header / Hero Row */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
              <div className="space-y-3 max-w-2xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-subtitle/20 border border-subtitle/40 text-[11px] font-bold text-amber-900 dark:text-subtitle">
                    <WindowsIcon size={12} />
                    <span>Windows 10 / 11 · 64-bit</span>
                  </span>
                  <span className="text-[11px] font-semibold text-muted bg-black/5 dark:bg-white/10 px-2.5 py-0.5 rounded-full border border-line">
                    v1.0.0 Stable
                  </span>
                  <span className="text-[11px] font-semibold text-ok bg-ok/10 px-2.5 py-0.5 rounded-full border border-ok/20">
                    VLC Core Engine
                  </span>
                </div>

                <h2 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight">
                  WordTap Desktop Player
                </h2>

                <p className="text-sm text-muted leading-relaxed">
                  High-performance desktop video player with VLC playback, automatic Dolby AC3 &amp; DTS audio transcoding, 200% volume boost, speed bar, VLsub subtitle search, and instant click-to-translate vocabulary sync.
                </p>

                <div className="flex flex-wrap gap-2 text-xs font-medium text-muted pt-1">
                  <span className="flex items-center gap-1">
                    <CheckIcon size={13} className="text-ok" />
                    <span>Plays MKV &amp; MP4</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckIcon size={13} className="text-ok" />
                    <span>200% Volume Boost</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckIcon size={13} className="text-ok" />
                    <span>Dark &amp; Light Mode</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckIcon size={13} className="text-ok" />
                    <span>Works Offline</span>
                  </span>
                </div>
              </div>

              {/* Download Buttons Group */}
              <div className="shrink-0 flex flex-col gap-2.5 w-full sm:w-auto min-w-[240px]">
                {/* Primary .EXE Setup Button */}
                <a
                  href="/api/download/desktop?format=exe"
                  download="WordTap-Setup.exe"
                  onClick={() => void trackEvent("desktop_player_download", { format: "exe" })}
                  className="btn btn-primary min-h-12 px-6 text-sm font-bold shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 w-full"
                >
                  <WindowsIcon size={16} />
                  <span>Download Setup (.exe)</span>
                </a>

                {/* Secondary .MSI Installer Button */}
                <a
                  href="/api/download/desktop?format=msi"
                  download="WordTap-Setup-x64.msi"
                  onClick={() => void trackEvent("desktop_player_download", { format: "msi" })}
                  className="btn btn-quiet min-h-10 px-4 text-xs font-bold border border-line hover:border-subtitle/50 transition-all flex items-center justify-center gap-2 w-full"
                >
                  <DownloadIcon size={13} />
                  <span>Download Windows Installer (.msi)</span>
                </a>

                {/* Portable ZIP Option */}
                <a
                  href="/api/download/desktop?format=zip"
                  download="WordTap-Player-win-x64.zip"
                  onClick={() => void trackEvent("desktop_player_download", { format: "zip" })}
                  className="text-[11px] text-muted text-center hover:text-ink underline underline-offset-4"
                >
                  Or download Portable ZIP (No install needed)
                </a>
              </div>
            </div>

            {/* Desktop Player Feature Grid */}
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                Desktop Player Features
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {DESKTOP_FEATURES.map((feat) => (
                  <div
                    key={feat.title}
                    className="p-3.5 rounded-xl bg-black/5 dark:bg-white/5 border border-line space-y-1.5 hover:border-subtitle/40 transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">{feat.icon}</span>
                      <h4 className="text-xs font-bold text-ink">{feat.title}</h4>
                    </div>
                    <p className="text-[11px] text-muted leading-relaxed">
                      {feat.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Installation Guide Accordion */}
            <div className="p-4 rounded-xl bg-black/5 dark:bg-white/5 border border-line space-y-3">
              <h4 className="text-xs font-bold text-ink flex items-center gap-1.5">
                <span>🚀 How to Install &amp; Play on Windows</span>
              </h4>
              <ol className="grid gap-2 text-xs text-muted sm:grid-cols-4">
                <li className="flex gap-2">
                  <span className="w-5 h-5 rounded-full bg-subtitle/20 text-amber-800 dark:text-subtitle font-bold flex items-center justify-center shrink-0 text-[10px]">1</span>
                  <span>Click <strong>Download Setup (.exe)</strong> or <strong>.msi</strong> above.</span>
                </li>
                <li className="flex gap-2">
                  <span className="w-5 h-5 rounded-full bg-subtitle/20 text-amber-800 dark:text-subtitle font-bold flex items-center justify-center shrink-0 text-[10px]">2</span>
                  <span>Run the downloaded installer to launch WordTap Player.</span>
                </li>
                <li className="flex gap-2">
                  <span className="w-5 h-5 rounded-full bg-subtitle/20 text-amber-800 dark:text-subtitle font-bold flex items-center justify-center shrink-0 text-[10px]">3</span>
                  <span>Sign in with your WordTap account (or use offline).</span>
                </li>
                <li className="flex gap-2">
                  <span className="w-5 h-5 rounded-full bg-subtitle/20 text-amber-800 dark:text-subtitle font-bold flex items-center justify-center shrink-0 text-[10px]">4</span>
                  <span>Drag &amp; drop any video file with subtitles and start tapping!</span>
                </li>
              </ol>
            </div>
          </section>
        )}

        {/* Section 2: Browser Extension (with Video Demo) */}
        {(activeTab === "all" || activeTab === "extension") && (
          <section id="extension" className="apple-card p-6 sm:p-8 space-y-8 border border-line bg-surface/90 shadow-xl relative overflow-hidden">
            {/* Header / Hero Row */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
              <div className="space-y-3 max-w-2xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-subtitle/20 border border-subtitle/40 text-[11px] font-bold text-amber-900 dark:text-subtitle">
                    <ChromeIcon size={12} />
                    <span>Chrome · Edge · Brave · Arc</span>
                  </span>
                  <span className="text-[11px] font-semibold text-muted bg-black/5 dark:bg-white/10 px-2.5 py-0.5 rounded-full border border-line">
                    v1.0.0
                  </span>
                  <span className="text-[11px] font-semibold text-ok bg-ok/10 px-2.5 py-0.5 rounded-full border border-ok/20">
                    YouTube &amp; Netflix Subtitles
                  </span>
                </div>

                <h2 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight">
                  WordTap Browser Extension
                </h2>

                <p className="text-sm text-muted leading-relaxed">
                  Interactive subtitle translator for your web browser. Click any word while watching YouTube, Netflix, Disney+, Prime Video, Coursera, or TED to see instant translations and save words for spaced repetition practice.
                </p>

                <div className="flex flex-wrap gap-2 text-xs font-medium text-muted pt-1">
                  <span className="flex items-center gap-1">
                    <CheckIcon size={13} className="text-ok" />
                    <span>YouTube &amp; Netflix</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckIcon size={13} className="text-ok" />
                    <span>Screen OCR (Alt+S)</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckIcon size={13} className="text-ok" />
                    <span>Dark &amp; Light Theme</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckIcon size={13} className="text-ok" />
                    <span>Instant Cloud Sync</span>
                  </span>
                </div>
              </div>

              {/* Download Button Group */}
              <div className="shrink-0 flex flex-col gap-2.5 w-full sm:w-auto min-w-[240px]">
                <a
                  href="/wordtap-extension.zip"
                  download="wordtap-extension.zip"
                  onClick={() => void trackEvent("extension_connected")}
                  className="btn btn-primary min-h-12 px-6 text-sm font-bold shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 w-full"
                >
                  <DownloadIcon size={16} />
                  <span>Download Extension (.zip)</span>
                </a>
                <span className="text-[11px] text-muted text-center">
                  Free · ZIP bundle · Ready to unpack
                </span>
              </div>
            </div>

            {/* Video Demo Section (Explicit User Request: 'extension download with video') */}
            <div className="space-y-3 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-ok animate-pulse" />
                  <h3 className="text-base sm:text-lg font-bold text-ink">
                    Watch the Extension in Action
                  </h3>
                </div>
                <span className="text-xs text-muted font-medium bg-black/5 dark:bg-white/10 px-3 py-1 rounded-full border border-line w-fit">
                  Interactive Subtitles Demo Video
                </span>
              </div>

              <div className="relative rounded-2xl overflow-hidden bg-black aspect-video border border-line/60 shadow-inner group">
                <video
                  src="/wordtap-extension-demo.mp4"
                  controls
                  playsInline
                  preload="metadata"
                  className="w-full h-full object-contain"
                >
                  Your browser does not support the video tag.
                </video>
              </div>

              <p className="text-xs text-muted text-center italic">
                Watch how clicking any word in YouTube subtitles displays dictionary definitions, pronunciation, and saves it to your daily flashcards.
              </p>
            </div>

            {/* Extension 4-Step Setup Guide */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                  4-Step Setup Guide
                </h3>
                <button
                  type="button"
                  onClick={copyChromeUrl}
                  className="text-xs font-semibold text-amber-700 dark:text-subtitle hover:underline flex items-center gap-1"
                >
                  <span>{copiedExtensionsUrl ? "✓ Copied!" : "Copy chrome://extensions"}</span>
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {EXTENSION_STEPS.map((step) => (
                  <div
                    key={step.num}
                    className="p-4 rounded-xl bg-black/5 dark:bg-white/5 border border-line space-y-2 hover:border-subtitle/40 transition-all flex flex-col justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-subtitle text-subtitle-ink font-extrabold text-xs flex items-center justify-center shrink-0">
                        {step.num}
                      </span>
                      <h4 className="text-xs font-bold text-ink leading-snug">{step.title}</h4>
                    </div>
                    <div className="text-[11px] text-muted leading-relaxed">
                      {step.body}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Ecosystem Overview: Why Use Both? */}
        <section className="apple-card p-6 sm:p-8 space-y-6 border border-line">
          <div className="space-y-1">
            <h3 className="text-xl font-bold text-ink">
              The WordTap Ecosystem
            </h3>
            <p className="text-xs sm:text-sm text-muted">
              Everything works together seamlessly with your central WordTap vocabulary cloud.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="p-4 rounded-xl bg-black/5 dark:bg-white/5 border border-line space-y-2">
              <div className="text-lg">💻</div>
              <h4 className="text-sm font-bold text-ink">Desktop Player</h4>
              <p className="text-xs text-muted leading-relaxed">
                For offline movies, downloaded series, MKV files with multi-track Dolby audio, flights, and home theater learning.
              </p>
              <div className="pt-2">
                <a
                  href="/api/download/desktop?format=exe"
                  className="text-xs font-bold text-amber-700 dark:text-subtitle hover:underline"
                >
                  Download .exe / .msi →
                </a>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-black/5 dark:bg-white/5 border border-line space-y-2">
              <div className="text-lg">🌐</div>
              <h4 className="text-sm font-bold text-ink">Browser Extension</h4>
              <p className="text-xs text-muted leading-relaxed">
                For streaming YouTube, Netflix, Disney+, Prime Video, reading web articles, and Screen OCR (Alt+S).
              </p>
              <div className="pt-2">
                <a
                  href="/wordtap-extension.zip"
                  className="text-xs font-bold text-amber-700 dark:text-subtitle hover:underline"
                >
                  Download .zip →
                </a>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-black/5 dark:bg-white/5 border border-line space-y-2">
              <div className="text-lg">📱</div>
              <h4 className="text-sm font-bold text-ink">Web Dashboard &amp; SRS</h4>
              <p className="text-xs text-muted leading-relaxed">
                5-minute daily practice sessions, smart FSRS spaced repetition, streak tracking, AI grammar explanations, and deck collections.
              </p>
              <div className="pt-2">
                <Link
                  href="/dashboard"
                  className="text-xs font-bold text-amber-700 dark:text-subtitle hover:underline"
                >
                  Open Dashboard →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Privacy & Trust Banner */}
        <div className="apple-card p-5 border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted">
          <div>
            <strong className="text-ink">100% Privacy-respecting.</strong> WordTap never monitors your browsing history or sells user data. Your saved vocabulary remains yours and exportable anytime to Anki or CSV.
          </div>
          <div className="flex flex-wrap gap-4 shrink-0 font-medium">
            <Link href="/privacy" className="hover:text-ink underline underline-offset-4">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-ink underline underline-offset-4">Terms of Service</Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

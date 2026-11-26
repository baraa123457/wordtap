"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { trackEvent } from "@/lib/analytics";
import { SegmentedControl } from "@/components/SegmentedControl";
import {
  WindowsIcon,
  AppleIcon,
  ChromeIcon,
  DownloadIcon,
  CheckIcon,
  SparklesIcon,
  StarIcon,
  PlayIcon,
  PauseIcon,
  FilmIcon,
  SpeakerIcon,
} from "@/components/Icons";

const DESKTOP_FEATURES = [
  {
    icon: FilmIcon,
    title: "VLC Core Engine",
    desc: "Plays MKV, MP4, AVI, WebM, and HEVC 4K/HDR with native hardware decoding.",
  },
  {
    icon: SpeakerIcon,
    title: "200% Volume Boost",
    desc: "Linear amplification (+6 dB) so soft whispered cinema dialogue is always loud and clear.",
  },
  {
    icon: SparklesIcon,
    title: "Dolby AC3 / DTS Transcoding",
    desc: "Zero-configuration background audio transcoding for multi-channel cinema audio.",
  },
  {
    icon: PlayIcon,
    title: "VLC Speed Bar & Hotkeys",
    desc: "Adjust speed smoothly from 0.25x to 3.0x with [ / ] (±0.1x), - / + (±0.5x), or = reset.",
  },
  {
    icon: CheckIcon,
    title: "VLsub OpenSubtitles",
    desc: "Search, download, and auto-sync subtitles for any movie without leaving the player.",
  },
  {
    icon: ChromeIcon,
    title: "Dark & Light Cinema Modes",
    desc: "Seamlessly toggle between Dark Theater and Daylight mode with 'T' shortcut.",
  },
  {
    icon: DownloadIcon,
    title: "Offline Storage & Cloud Sync",
    desc: "Tap words offline on flights; words queue locally and sync automatically when online.",
  },
  {
    icon: StarIcon,
    title: "Instant Click-to-Translate",
    desc: "Tap any subtitle word for instant definition, phonetic IPA, and SRS flashcard saving.",
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
        in Chrome, Edge, Brave, or Arc.
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

const FAQ_ITEMS = [
  {
    q: "Does the Desktop Player support 4K MKV files with AC3 or DTS audio?",
    a: "Yes! WordTap Desktop Player includes integrated VLC media engine codecs and real-time audio transcoding. Whether your file has 6-channel Dolby Digital (AC3), DTS-HD, or AAC, sound plays seamlessly with zero setup required.",
  },
  {
    q: "How do words saved offline sync to my WordTap account?",
    a: "When you tap words while watching a video offline (for example on a flight or train), WordTap saves them to your local encrypted database. As soon as your laptop reconnects to Wi-Fi, your new vocabulary syncs automatically to your web account and flashcard review queue.",
  },
  {
    q: "Why does macOS say the app cannot be opened or is from an unidentified developer?",
    a: "Because our macOS build is compiled openly on GitHub Actions CI without a paid Apple Developer notarization certificate. First-time launch: right-click (or Control-click) WordTap.app in Applications and choose Open (or go to System Settings > Privacy & Security > Open Anyway).",
  },
  {
    q: "Why does Windows SmartScreen show 'Windows protected your PC'?",
    a: "Because WordTap is a newly released open-source release built directly on GitHub Actions CI. To proceed: click 'More info' and then click 'Run anyway'. All releases are 100% open-source, virus-free, and verifiable on our GitHub repository.",
  },
  {
    q: "What is the difference between Setup (.exe) and Windows Installer (.msi)?",
    a: "Setup (.exe) is the recommended NSIS installer for personal computers, supporting auto-updates and lightweight installation. The .msi installer is designed for system administrators or enterprise environments requiring silent deployment via Group Policy (GPO) or Intune.",
  },
  {
    q: "Which browsers are supported by the WordTap Extension?",
    a: "WordTap Extension works on all Chromium-based desktop browsers including Google Chrome, Microsoft Edge, Brave, Arc, Opera, and Vivaldi. It provides instant subtitle vocabulary lookup on YouTube, Netflix, Disney+, Prime Video, and Coursera.",
  },
] as const;

export default function DownloadPage() {
  const [activeTab, setActiveTab] = useState<"all" | "desktop" | "extension">("all");
  const [desktopOs, setDesktopOs] = useState<"win" | "mac">("win");
  const [copiedExtensionsUrl, setCopiedExtensionsUrl] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  useEffect(() => {
    if (typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent)) {
      setDesktopOs("mac");
    }
  }, []);

  // Interactive Desktop Player Mockup State
  const [mockSpeed, setMockSpeed] = useState<number>(1.0);
  const [mockVolume, setMockVolume] = useState<number>(100);
  const [mockPlaying, setMockPlaying] = useState<boolean>(true);
  const [mockPopoverWord, setMockPopoverWord] = useState<string | null>("glory");
  const [mockSaved, setMockSaved] = useState<boolean>(true);

  const speedOptions = [0.75, 1.0, 1.25, 1.5, 2.0];
  const cycleSpeed = () => {
    const nextIdx = (speedOptions.indexOf(mockSpeed) + 1) % speedOptions.length;
    setMockSpeed(speedOptions[nextIdx]);
  };

  const copyChromeUrl = () => {
    navigator.clipboard?.writeText("chrome://extensions");
    setCopiedExtensionsUrl(true);
    setTimeout(() => setCopiedExtensionsUrl(false), 2000);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-12 pb-24 pt-4 sm:pt-8 px-4 sm:px-6">
        {/* Page Hero Header */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-subtitle/15 border border-subtitle/30 text-xs font-bold text-ink shadow-xs">
            <SparklesIcon size={14} className="text-amber-800 dark:text-subtitle" />
            <span>WordTap Ecosystem · Desktop Player &amp; Browser Extension</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-ink">
            Download WordTap
          </h1>

          <p className="text-sm sm:text-base text-muted leading-relaxed max-w-2xl mx-auto">
            Turn your favorite movies, series, and online videos into real vocabulary fluency. Available as a desktop video player for Windows &amp; macOS and as a browser extension.
          </p>

          {/* Authentic Apple Segmented Control Tab Switcher */}
          <div className="pt-2 flex justify-center">
            <SegmentedControl
              ariaLabel="Download Category"
              fill
              className="max-w-md w-full"
              value={activeTab}
              onChange={(val) => setActiveTab(val as "all" | "desktop" | "extension")}
              options={[
                {
                  value: "all",
                  label: (
                    <span className="inline-flex items-center justify-center gap-1.5 min-w-0 truncate">
                      <DownloadIcon size={13} className="shrink-0" />
                      <span className="hidden sm:inline truncate">All Downloads</span>
                      <span className="sm:hidden truncate">All</span>
                    </span>
                  ),
                },
                {
                  value: "desktop",
                  label: (
                    <span className="inline-flex items-center justify-center gap-1.5 min-w-0 truncate">
                      <WindowsIcon size={13} className="shrink-0" />
                      <span className="hidden sm:inline truncate">Desktop Player</span>
                      <span className="sm:hidden truncate">Desktop</span>
                    </span>
                  ),
                },
                {
                  value: "extension",
                  label: (
                    <span className="inline-flex items-center justify-center gap-1.5 min-w-0 truncate">
                      <ChromeIcon size={13} className="shrink-0" />
                      <span className="hidden sm:inline truncate">Browser Extension</span>
                      <span className="sm:hidden truncate">Extension</span>
                    </span>
                  ),
                },
              ]}
            />
          </div>
        </div>

        {/* SECTION 1: Desktop Player App */}
        {(activeTab === "all" || activeTab === "desktop") && (
          <section id="desktop" className="apple-card p-6 sm:p-8 space-y-8 border border-line bg-surface/90 shadow-2xl relative overflow-hidden">
            {/* Subtle radial backdrop accent */}
            <div className="absolute -top-32 -right-32 w-96 h-96 bg-subtitle/10 rounded-full blur-3xl pointer-events-none" />

            {/* Header / Hero Row */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
              <div className="space-y-3.5 max-w-2xl">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDesktopOs("mac")}
                    className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full border text-[length:var(--text-label)] font-bold transition-colors cursor-pointer ${
                      desktopOs === "mac"
                        ? "bg-subtitle/20 border-subtitle/40 text-amber-900 dark:text-subtitle"
                        : "bg-black/5 dark:bg-white/10 border-line text-muted hover:text-ink"
                    }`}
                  >
                    <AppleIcon size={12} />
                    <span>macOS (Apple Silicon &amp; Intel)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDesktopOs("win")}
                    className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full border text-[length:var(--text-label)] font-bold transition-colors cursor-pointer ${
                      desktopOs === "win"
                        ? "bg-subtitle/20 border-subtitle/40 text-amber-900 dark:text-subtitle"
                        : "bg-black/5 dark:bg-white/10 border-line text-muted hover:text-ink"
                    }`}
                  >
                    <WindowsIcon size={12} />
                    <span>Windows 10 / 11 · 64-bit</span>
                  </button>
                  <span className="text-[length:var(--text-label)] font-semibold text-muted bg-black/5 dark:bg-white/10 px-2.5 py-0.5 rounded-full border border-line">
                    v1.0.8 Stable
                  </span>
                  <span className="text-[length:var(--text-label)] font-semibold text-ok bg-ok/10 px-2.5 py-0.5 rounded-full border border-ok/20">
                    VLC Core Engine
                  </span>
                </div>

                <h2 className="text-2xl sm:text-4xl font-extrabold text-ink tracking-tight">
                  WordTap Desktop Player
                </h2>

                <p className="text-sm sm:text-base text-muted leading-relaxed">
                  High-performance desktop video player with VLC playback, automatic Dolby AC3 &amp; DTS audio transcoding, 200% volume boost, speed bar, VLsub subtitle search, and instant click-to-translate vocabulary sync.
                </p>

                <div className="flex flex-wrap gap-3 text-xs font-medium text-muted pt-1">
                  <span className="flex items-center gap-1.5">
                    <CheckIcon size={14} className="text-ok shrink-0" />
                    <span>Plays MKV &amp; MP4 4K</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckIcon size={14} className="text-ok shrink-0" />
                    <span>200% Volume Boost</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckIcon size={14} className="text-ok shrink-0" />
                    <span>VLC Speed Bar [ / ]</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckIcon size={14} className="text-ok shrink-0" />
                    <span>Dark &amp; Light Cinema</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckIcon size={14} className="text-ok shrink-0" />
                    <span>Offline Sync</span>
                  </span>
                </div>
              </div>

              {/* Download Buttons Group */}
              <div className="shrink-0 flex flex-col gap-2.5 w-full sm:w-auto min-w-[270px]">
                {desktopOs === "mac" ? (
                  <>
                    <a
                      href="/api/download/desktop?format=dmg&arch=arm64"
                      download="WordTap-mac-arm64.dmg"
                      onClick={() => void trackEvent("desktop_player_download", { format: "dmg-arm64" })}
                      className="btn btn-primary min-h-12 px-6 text-sm font-bold shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 w-full"
                    >
                      <AppleIcon size={18} />
                      <span>Download for Mac (Apple Silicon)</span>
                    </a>

                    <a
                      href="/api/download/desktop?format=dmg&arch=x64"
                      download="WordTap-mac-x64.dmg"
                      onClick={() => void trackEvent("desktop_player_download", { format: "dmg-x64" })}
                      className="btn btn-quiet min-h-11 px-4 text-[length:var(--text-control)] font-bold border border-line hover:border-subtitle/50 transition-all flex items-center justify-center gap-2 w-full"
                    >
                      <DownloadIcon size={14} />
                      <span>Download for Mac — Intel (.dmg)</span>
                    </a>

                    <a
                      href="/api/download/desktop?format=mac-zip&arch=arm64"
                      download="WordTap-mac-arm64.zip"
                      onClick={() => void trackEvent("desktop_player_download", { format: "mac-zip" })}
                      className="text-[length:var(--text-control)] text-muted text-center hover:text-ink underline underline-offset-4 py-1 inline-flex items-center justify-center min-h-11"
                    >
                      Or download Portable Mac ZIP (.app)
                    </a>
                  </>
                ) : (
                  <>
                    {/* Primary .EXE Setup Button */}
                    <a
                      href="/api/download/desktop?format=exe"
                      download="WordTap-Setup.exe"
                      onClick={() => void trackEvent("desktop_player_download", { format: "exe" })}
                      className="btn btn-primary min-h-12 px-6 text-sm font-bold shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 w-full"
                    >
                      <WindowsIcon size={18} />
                      <span>Download Setup (.exe)</span>
                    </a>

                    {/* Secondary .MSI Installer Button */}
                    <a
                      href="/api/download/desktop?format=msi"
                      download="WordTap-Setup-x64.msi"
                      onClick={() => void trackEvent("desktop_player_download", { format: "msi" })}
                      className="btn btn-quiet min-h-11 px-4 text-[length:var(--text-control)] font-bold border border-line hover:border-subtitle/50 transition-all flex items-center justify-center gap-2 w-full"
                    >
                      <DownloadIcon size={14} />
                      <span>Download Windows Installer (.msi)</span>
                    </a>

                    {/* Portable ZIP Option */}
                    <a
                      href="/api/download/desktop?format=zip"
                      download="WordTap-Player-win-x64.zip"
                      onClick={() => void trackEvent("desktop_player_download", { format: "zip" })}
                      className="text-[length:var(--text-control)] text-muted text-center hover:text-ink underline underline-offset-4 py-1 inline-flex items-center justify-center min-h-11"
                    >
                      Or download Portable ZIP (No install needed)
                    </a>
                  </>
                )}
              </div>
            </div>

            {/* REALISTIC DESKTOP PLAYER WINDOW MOCKUP (Featuring Exact User Reference UI) */}
            <div className="space-y-3 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted">
                    Interactive Player Preview
                  </span>
                  <span className="text-[length:var(--text-label)] font-semibold bg-subtitle/20 text-amber-900 dark:text-subtitle px-2 py-0.5 rounded-full border border-subtitle/30">
                    Try Speed &amp; Volume controls below
                  </span>
                </div>
                <span className="text-xs text-muted">
                  Click the highlighted word to see instant vocabulary popover
                </span>
              </div>

              {/* Realistic Player Window Frame */}
              <div className="rounded-2xl overflow-hidden border border-line/80 shadow-2xl bg-[#0f111a] text-slate-200 select-none transition-all">
                {/* Titlebar */}
                <div className="h-9 bg-[#151824] border-b border-white/10 px-3.5 flex items-center justify-between">
                  {/* Traffic lights / Window controls */}
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#ff5f56] inline-block shadow-xs" />
                    <span className="w-3 h-3 rounded-full bg-[#ffbd2e] inline-block shadow-xs" />
                    <span className="w-3 h-3 rounded-full bg-[#27c93f] inline-block shadow-xs" />
                  </div>

                  {/* Window Title */}
                  <div className="text-xs font-medium text-slate-300 truncate max-w-sm px-2 text-center flex items-center gap-2">
                    <span>WordTap VLC Player</span>
                    <span className="text-slate-500">—</span>
                    <span className="text-slate-400 font-mono text-[11px]">Interstellar.2014.1080p.mkv</span>
                  </div>

                  {/* Mode badge */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-slate-400 border border-white/10">
                      VLC 3.0.21
                    </span>
                  </div>
                </div>

                {/* Classic VLC Menu Bar */}
                <div className="h-7 bg-[#12141f] border-b border-white/5 px-3 flex items-center gap-3 text-xs text-slate-400 font-sans">
                  <span className="hover:text-white cursor-pointer transition-colors">Media</span>
                  <span className="hover:text-white cursor-pointer transition-colors">Playback</span>
                  <span className="hover:text-white cursor-pointer transition-colors">Audio</span>
                  <span className="hover:text-white cursor-pointer transition-colors">Subtitle</span>
                  <span className="hover:text-white cursor-pointer transition-colors">Tools</span>
                  <span className="hover:text-white cursor-pointer text-amber-400 font-semibold transition-colors">View</span>
                  <span className="hover:text-white cursor-pointer transition-colors">Help</span>
                </div>

                {/* Cinema Video Canvas */}
                <div className="relative aspect-video max-h-[380px] w-full bg-gradient-to-b from-[#0b0c14] via-[#101322] to-[#07080d] flex flex-col justify-end items-center p-6 sm:p-10 overflow-hidden group">
                  {/* Subtle cinema backdrop glow */}
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(56,66,115,0.25)_0,transparent_75%)] pointer-events-none" />

                  {/* Interactive Subtitle Line */}
                  <div className="relative z-10 max-w-2xl text-center space-y-3">
                    {/* Floating Dictionary Popover when word is tapped */}
                    {mockPopoverWord && (
                      <div className="mx-auto max-w-md p-3.5 rounded-xl bg-[#1b1f33]/95 backdrop-blur-xl border border-amber-500/40 shadow-2xl text-left space-y-2 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-white text-sm">glory</span>
                            <span className="text-amber-400 text-xs font-mono">/ˈɡlɔː.ri/</span>
                            <button
                              type="button"
                              className="text-slate-300 hover:text-white p-0.5 text-xs inline-flex items-center"
                              title="Play audio pronunciation"
                            >
                              <SpeakerIcon size={13} />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => setMockSaved(!mockSaved)}
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 transition-all ${
                              mockSaved
                                ? "bg-amber-500 text-slate-950 shadow-xs"
                                : "bg-white/10 text-slate-300 hover:bg-white/20"
                            }`}
                          >
                            <StarIcon size={11} filled={mockSaved} />
                            <span>{mockSaved ? "Saved" : "Save Word"}</span>
                          </button>
                        </div>
                        <p className="text-xs text-slate-300 leading-snug">
                          <span className="italic text-slate-400 font-serif mr-1.5">noun.</span>
                          High renown or honor won by notable achievements. Magnificence or great beauty.
                        </p>
                        <div className="text-[10px] text-slate-400 pt-1 border-t border-white/10 flex items-center justify-between">
                          <span>WordTap SRS Flashcards · Ready for daily review</span>
                          <span className="text-amber-400 font-semibold">Offline Sync Active ✓</span>
                        </div>
                      </div>
                    )}

                    {/* Subtitle text line with clickable word */}
                    <div className="inline-block px-4 py-2 rounded-xl bg-black/75 backdrop-blur-md border border-white/15 text-base sm:text-xl font-medium tracking-wide text-white shadow-xl">
                      <span>The greatest </span>
                      <button
                        type="button"
                        onClick={() => setMockPopoverWord(mockPopoverWord ? null : "glory")}
                        className="font-bold text-amber-400 underline decoration-amber-400 underline-offset-4 hover:text-amber-300 transition-colors bg-amber-400/10 px-1 rounded cursor-pointer"
                        title="Click to toggle dictionary popover"
                      >
                        glory
                      </button>
                      <span> in living lies not in never falling, but in rising every time we fall.</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Control Dock (VLC Style featuring Exact User Reference Images) */}
                <div className="bg-[#121420] border-t border-white/10 p-3 sm:px-4 space-y-2">
                  {/* Progress timeline bar */}
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-mono text-slate-400 shrink-0">01:14:22</span>
                    <div className="relative flex-1 h-1.5 bg-slate-800 rounded-full cursor-pointer overflow-hidden group">
                      <div className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full w-[48%]" />
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 shrink-0">02:49:03</span>
                  </div>

                  {/* Playback & Audio Controls Row */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    {/* Left: Play/Pause, Rewind, Forward */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setMockPlaying(!mockPlaying)}
                        className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer"
                        title={mockPlaying ? "Pause (Space)" : "Play (Space)"}
                      >
                        {mockPlaying ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
                      </button>
                      <button
                        type="button"
                        className="w-8 h-8 rounded-lg text-slate-400 hover:text-white flex items-center justify-center text-xs transition-colors"
                        title="Previous Chapter"
                      >
                        ⏮
                      </button>
                      <button
                        type="button"
                        className="w-8 h-8 rounded-lg text-slate-400 hover:text-white flex items-center justify-center text-xs transition-colors"
                        title="Next Chapter"
                      >
                        ⏭
                      </button>
                    </div>

                    {/* Right: Exact Speed Pill (Photo 1) & Volume Slider (Photo 2) */}
                    <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                      {/* Playback Speed Bar Group (EXACT USER PHOTO 1: [1.0x] dark rounded pill) */}
                      <div className="flex items-center gap-1 bg-[#181a29] px-2 py-1 rounded-xl border border-white/10">
                        <button
                          type="button"
                          onClick={() => setMockSpeed((s) => Math.max(0.25, parseFloat((s - 0.1).toFixed(2))))}
                          className="w-6 h-6 rounded-md hover:bg-white/10 text-slate-300 font-bold text-xs flex items-center justify-center transition-colors"
                          title="Slower 0.1x ([)"
                        >
                          −
                        </button>

                        {/* Exact match to User Cropped Photo 1 */}
                        <button
                          type="button"
                          onClick={cycleSpeed}
                          className="px-2.5 py-0.5 rounded-lg bg-[#0e101b] border border-white/20 text-slate-200 hover:text-amber-400 hover:border-amber-400/50 font-mono text-xs font-bold transition-all shadow-inner cursor-pointer"
                          title="Cycle speed or reset 1.0x (=)"
                        >
                          {mockSpeed.toFixed(1)}x
                        </button>

                        <button
                          type="button"
                          onClick={() => setMockSpeed((s) => Math.min(3.0, parseFloat((s + 0.1).toFixed(2))))}
                          className="w-6 h-6 rounded-md hover:bg-white/10 text-slate-300 font-bold text-xs flex items-center justify-center transition-colors"
                          title="Faster 0.1x (])"
                        >
                          +
                        </button>
                      </div>

                      {/* Subtitle [CC] Button */}
                      <button
                        type="button"
                        className="px-2 py-1 rounded-lg bg-amber-400/15 border border-amber-400/30 text-amber-400 font-mono text-xs font-bold"
                        title="Subtitles active (C)"
                      >
                        CC
                      </button>

                      {/* Volume Slider Group (EXACT USER PHOTO 2: Speaker, Orange Track, Gold Thumb, 100%) */}
                      <div className="flex items-center gap-2 bg-[#181a29] px-2.5 py-1 rounded-xl border border-white/10">
                        {/* Speaker Icon button */}
                        <button
                          type="button"
                          onClick={() => setMockVolume(mockVolume > 0 ? 0 : 100)}
                          className="w-6 h-6 rounded-md hover:bg-white/10 text-slate-300 flex items-center justify-center text-xs transition-colors"
                          title="Mute / Unmute (M)"
                        >
                          <SpeakerIcon size={14} />
                        </button>

                        {/* Interactive Range Slider with gold thumb knob */}
                        <div className="relative w-24 sm:w-28 flex items-center">
                          <input
                            type="range"
                            min="0"
                            max="200"
                            value={mockVolume}
                            onChange={(e) => setMockVolume(Number(e.target.value))}
                            className="w-full h-1.5 rounded-full appearance-none bg-slate-700 cursor-pointer accent-[#ffd23f]"
                            style={{
                              background: `linear-gradient(to right, #f97316 0%, #f97316 ${Math.min(
                                100,
                                (mockVolume / 200) * 100
                              )}%, #334155 ${Math.min(100, (mockVolume / 200) * 100)}%, #334155 100%)`,
                            }}
                            title="Volume up to 200%"
                          />
                        </div>

                        {/* Exact match to User Cropped Photo 2: 100% or boosted up to 200% */}
                        <span
                          className={`font-mono text-xs font-bold min-w-[38px] text-right ${
                            mockVolume > 100 ? "text-amber-400 font-extrabold" : "text-slate-300"
                          }`}
                        >
                          {mockVolume}%
                        </span>
                      </div>

                      {/* Fullscreen Button */}
                      <button
                        type="button"
                        className="w-8 h-8 rounded-lg text-slate-400 hover:text-white flex items-center justify-center text-sm transition-colors"
                        title="Fullscreen (F)"
                      >
                        ⛶
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Desktop Player 8-Feature Grid */}
            <div className="space-y-3 pt-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                Desktop Player Built-in Capabilities
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {DESKTOP_FEATURES.map((feat) => {
                  const IconComponent = feat.icon;
                  return (
                    <div
                      key={feat.title}
                      className="p-4 rounded-xl bg-black/5 dark:bg-white/5 border border-line space-y-2 hover:border-subtitle/40 transition-all"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-subtitle/15 text-amber-800 dark:text-subtitle flex items-center justify-center shrink-0">
                          <IconComponent size={14} />
                        </span>
                        <h4 className="text-xs font-bold text-ink">{feat.title}</h4>
                      </div>
                      <p className="text-xs text-muted leading-relaxed">
                        {feat.desc}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Installation Guide Accordion Steps */}
            <div className="p-5 rounded-2xl bg-black/5 dark:bg-white/5 border border-line space-y-3">
              <h4 className="text-xs font-bold text-ink flex items-center gap-2">
                <DownloadIcon size={14} className="text-amber-700 dark:text-subtitle" />
                <span>
                  {desktopOs === "mac"
                    ? "Quick Setup Guide (macOS Apple Silicon & Intel)"
                    : "Quick Setup Guide (Windows 10 / 11)"}
                </span>
              </h4>
              {desktopOs === "mac" ? (
                <ol className="grid gap-3 text-xs text-muted sm:grid-cols-4">
                  <li className="flex gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-subtitle/20 text-amber-800 dark:text-subtitle font-bold flex items-center justify-center shrink-0 text-xs">1</span>
                    <span>Download <strong>Apple Silicon (.dmg)</strong> (M1–M4) or <strong>Intel (.dmg)</strong> above.</span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-subtitle/20 text-amber-800 dark:text-subtitle font-bold flex items-center justify-center shrink-0 text-xs">2</span>
                    <span>Open the <code>.dmg</code> and drag <strong>WordTap</strong> into <strong>Applications</strong>.</span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-subtitle/20 text-amber-800 dark:text-subtitle font-bold flex items-center justify-center shrink-0 text-xs">3</span>
                    <span>First launch: Control-click WordTap in Applications and click <strong>Open</strong>.</span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-subtitle/20 text-amber-800 dark:text-subtitle font-bold flex items-center justify-center shrink-0 text-xs">4</span>
                    <span>Drag &amp; drop any movie file with subtitles and start learning!</span>
                  </li>
                </ol>
              ) : (
                <ol className="grid gap-3 text-xs text-muted sm:grid-cols-4">
                  <li className="flex gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-subtitle/20 text-amber-800 dark:text-subtitle font-bold flex items-center justify-center shrink-0 text-xs">1</span>
                    <span>Click <strong>Download Setup (.exe)</strong> or <strong>.msi</strong> above.</span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-subtitle/20 text-amber-800 dark:text-subtitle font-bold flex items-center justify-center shrink-0 text-xs">2</span>
                    <span>Run the installer to launch WordTap VLC Player.</span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-subtitle/20 text-amber-800 dark:text-subtitle font-bold flex items-center justify-center shrink-0 text-xs">3</span>
                    <span>Sign in with your WordTap account (or use offline).</span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-subtitle/20 text-amber-800 dark:text-subtitle font-bold flex items-center justify-center shrink-0 text-xs">4</span>
                    <span>Drag &amp; drop any movie file with subtitles and start learning!</span>
                  </li>
                </ol>
              )}
            </div>
          </section>
        )}

        {/* SECTION 2: Browser Extension (with Video Demo) */}
        {(activeTab === "all" || activeTab === "extension") && (
          <section id="extension" className="apple-card p-6 sm:p-8 space-y-8 border border-line bg-surface/90 shadow-2xl relative overflow-hidden">
            {/* Subtle radial backdrop accent */}
            <div className="absolute -top-32 -left-32 w-96 h-96 bg-subtitle/10 rounded-full blur-3xl pointer-events-none" />

            {/* Header / Hero Row */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
              <div className="space-y-3.5 max-w-2xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-subtitle/20 border border-subtitle/40 text-[length:var(--text-label)] font-bold text-amber-900 dark:text-subtitle">
                    <ChromeIcon size={12} />
                    <span>Chrome · Edge · Brave · Arc</span>
                  </span>
                  <span className="text-[length:var(--text-label)] font-semibold text-muted bg-black/5 dark:bg-white/10 px-2.5 py-0.5 rounded-full border border-line">
                    v1.0.0
                  </span>
                  <span className="text-[length:var(--text-label)] font-semibold text-ok bg-ok/10 px-2.5 py-0.5 rounded-full border border-ok/20">
                    YouTube &amp; Netflix Subtitles
                  </span>
                  <span className="text-[length:var(--text-label)] font-semibold text-muted bg-black/5 dark:bg-white/10 px-2.5 py-0.5 rounded-full border border-line">
                    ~5 MB
                  </span>
                </div>

                <h2 className="text-2xl sm:text-4xl font-extrabold text-ink tracking-tight">
                  WordTap Browser Extension
                </h2>

                <p className="text-sm sm:text-base text-muted leading-relaxed">
                  Interactive subtitle translator for your web browser. Click any word while watching YouTube, Netflix, Disney+, Prime Video, Coursera, or TED to see instant translations and save words for spaced repetition practice.
                </p>

                <div className="flex flex-wrap gap-3 text-xs font-medium text-muted pt-1">
                  <span className="flex items-center gap-1.5">
                    <CheckIcon size={14} className="text-ok shrink-0" />
                    <span>YouTube &amp; Netflix</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckIcon size={14} className="text-ok shrink-0" />
                    <span>Screen OCR (Alt+S)</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckIcon size={14} className="text-ok shrink-0" />
                    <span>Dark &amp; Light Theme</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckIcon size={14} className="text-ok shrink-0" />
                    <span>Instant Cloud Sync</span>
                  </span>
                </div>
              </div>

              {/* Download Button Group */}
              <div className="shrink-0 flex flex-col gap-2.5 w-full sm:w-auto min-w-[260px]">
                <a
                  href="/wordtap-extension.zip"
                  download="wordtap-extension.zip"
                  onClick={() => void trackEvent("extension_connected")}
                  className="btn btn-primary min-h-12 px-6 text-sm font-bold shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 w-full"
                >
                  <DownloadIcon size={18} />
                  <span>Download Extension (.zip)</span>
                </a>
                <span className="text-xs text-muted text-center">
                  Free · Unpacked ZIP · Works on all Chromium browsers
                </span>
              </div>
            </div>

            {/* Video Demo Section in Browser Window Frame */}
            <div className="space-y-3 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-ok animate-pulse" />
                  <h3 className="text-base sm:text-lg font-bold text-ink">
                    Watch the Extension in Action
                  </h3>
                </div>
                <span className="text-xs text-muted font-medium bg-black/5 dark:bg-white/10 px-3 py-1 rounded-full border border-line w-fit">
                  YouTube Subtitle Demo Video
                </span>
              </div>

              {/* Realistic Browser Window Frame wrapping video */}
              <div className="rounded-2xl overflow-hidden border border-line/80 shadow-2xl bg-black">
                {/* Browser address bar */}
                <div className="h-10 bg-surface border-b border-line px-3.5 flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-black/20 dark:bg-white/20 inline-block" />
                    <span className="w-3 h-3 rounded-full bg-black/20 dark:bg-white/20 inline-block" />
                    <span className="w-3 h-3 rounded-full bg-black/20 dark:bg-white/20 inline-block" />
                  </div>
                  <div className="flex-1 max-w-md mx-auto h-6 rounded-lg bg-black/5 dark:bg-white/10 border border-line px-3 flex items-center justify-between text-xs text-muted">
                    <span className="truncate">youtube.com/watch?v=wordtap-interactive-subtitles</span>
                    <span className="text-ok font-semibold text-[10px]">WordTap Active</span>
                  </div>
                  <div className="w-12 text-right text-xs font-mono text-muted">1080p</div>
                </div>

                <div className="relative aspect-video w-full bg-black">
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
                  className="text-xs font-semibold text-amber-700 dark:text-subtitle hover:underline flex items-center gap-1 cursor-pointer"
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
                    <div className="text-xs text-muted leading-relaxed">
                      {step.body}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* SECTION 3: The WordTap Ecosystem Comparison */}
        <section className="apple-card p-6 sm:p-8 space-y-6 border border-line">
          <div className="space-y-1">
            <h3 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">
              The Complete WordTap Ecosystem
            </h3>
            <p className="text-xs sm:text-sm text-muted">
              Everything works together seamlessly with your central WordTap vocabulary cloud.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="p-5 rounded-2xl bg-black/5 dark:bg-white/5 border border-line space-y-3 flex flex-col justify-between hover:border-subtitle/40 transition-all">
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-subtitle/15 text-amber-800 dark:text-subtitle flex items-center justify-center">
                  <WindowsIcon size={20} />
                </div>
                <h4 className="text-sm font-bold text-ink">Desktop Player</h4>
                <p className="text-xs text-muted leading-relaxed">
                  For offline movies, downloaded series, MKV files with multi-track Dolby audio, flights, and home theater learning.
                </p>
              </div>
              <div className="pt-2 flex flex-wrap items-center gap-3">
                <a
                  href="/api/download/desktop?format=dmg&arch=arm64"
                  className="text-xs font-bold text-amber-700 dark:text-subtitle hover:underline flex items-center gap-1"
                >
                  <span>macOS (.dmg)</span>
                  <span>→</span>
                </a>
                <a
                  href="/api/download/desktop?format=exe"
                  className="text-xs font-bold text-amber-700 dark:text-subtitle hover:underline flex items-center gap-1"
                >
                  <span>Windows (.exe)</span>
                  <span>→</span>
                </a>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-black/5 dark:bg-white/5 border border-line space-y-3 flex flex-col justify-between hover:border-subtitle/40 transition-all">
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-subtitle/15 text-amber-800 dark:text-subtitle flex items-center justify-center">
                  <ChromeIcon size={20} />
                </div>
                <h4 className="text-sm font-bold text-ink">Browser Extension</h4>
                <p className="text-xs text-muted leading-relaxed">
                  For streaming YouTube, Netflix, Disney+, Prime Video, reading web articles, and Screen OCR (Alt+S).
                </p>
              </div>
              <div className="pt-2">
                <a
                  href="/wordtap-extension.zip"
                  className="text-xs font-bold text-amber-700 dark:text-subtitle hover:underline flex items-center gap-1"
                >
                  <span>Download .zip</span>
                  <span>→</span>
                </a>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-black/5 dark:bg-white/5 border border-line space-y-3 flex flex-col justify-between hover:border-subtitle/40 transition-all">
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-subtitle/15 text-amber-800 dark:text-subtitle flex items-center justify-center">
                  <SparklesIcon size={20} />
                </div>
                <h4 className="text-sm font-bold text-ink">Web Dashboard &amp; SRS</h4>
                <p className="text-xs text-muted leading-relaxed">
                  5-minute daily practice sessions, smart FSRS spaced repetition, streak tracking, AI grammar explanations, and deck collections.
                </p>
              </div>
              <div className="pt-2">
                <Link
                  href="/dashboard"
                  className="text-xs font-bold text-amber-700 dark:text-subtitle hover:underline flex items-center gap-1"
                >
                  <span>Open Dashboard</span>
                  <span>→</span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 4: Inset Grouped FAQ & Troubleshooting Accordion */}
        <section className="apple-card p-6 sm:p-8 space-y-6 border border-line">
          <div className="space-y-1">
            <h3 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">
              Frequently Asked Questions
            </h3>
            <p className="text-xs sm:text-sm text-muted">
              Everything you need to know about system requirements, codecs, and offline sync.
            </p>
          </div>

          <div className="space-y-2">
            {FAQ_ITEMS.map((item, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={item.q}
                  className="rounded-xl border border-line bg-black/5 dark:bg-white/5 overflow-hidden transition-all"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full p-4 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  >
                    <span className="text-xs sm:text-sm font-bold text-ink">{item.q}</span>
                    <span className="text-base text-muted shrink-0">
                      {isOpen ? "−" : "+"}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 pt-1 text-xs text-muted leading-relaxed border-t border-line/50">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
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

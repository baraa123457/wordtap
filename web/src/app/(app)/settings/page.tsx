"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { fetchStats, setDailyGoal, deleteAccount } from "@/lib/api";
import { getStoredSettings, saveStoredSettings, type UserSettings, type PracticeMode } from "@/lib/settings";
import { canSpeak, speak } from "@/lib/speech";
import { SpeakerIcon } from "@/components/Icons";

const GOALS = [10, 20, 50, 100] as const;

const TARGET_LANGS = [
  { code: "ar", label: "العربية (Arabic)" },
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch (German)" },
  { code: "fr", label: "Français (French)" },
  { code: "es", label: "Español (Spanish)" },
  { code: "it", label: "Italiano (Italian)" },
  { code: "pt", label: "Português (Portuguese)" },
  { code: "tr", label: "Türkçe (Turkish)" },
  { code: "ru", label: "Русский (Russian)" },
];

export default function SettingsPage() {
  const router = useRouter();
  const { state: authState, signOut } = useAuth();
  const [settings, setSettings] = useState<UserSettings>(() => getStoredSettings());
  const [dailyGoalVal, setDailyGoalVal] = useState<number>(20);
  const [goalSaving, setGoalSaving] = useState(false);
  const [goalMessage, setGoalMessage] = useState<string | null>(null);

  // Password change state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDeleteAccount() {
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await deleteAccount();
      router.push("/signup");
    } catch (e: unknown) {
      setDeleteError(e instanceof Error ? e.message : "Failed to delete account");
      setDeleteBusy(false);
    }
  }

  useEffect(() => {
    fetchStats()
      .then((s) => setDailyGoalVal(s.daily_goal))
      .catch(() => {});

    if (canSpeak()) {
      window.speechSynthesis.getVoices();
    }
  }, []);

  function update(partial: Partial<UserSettings>) {
    const updated = saveStoredSettings(partial);
    setSettings(updated);
  }

  async function handleGoalChange(g: number) {
    setDailyGoalVal(g);
    setGoalSaving(true);
    setGoalMessage(null);
    try {
      await setDailyGoal(g);
      setGoalMessage("Daily goal saved!");
      setTimeout(() => setGoalMessage(null), 3000);
    } catch (e) {
      setGoalMessage(e instanceof Error ? e.message : "Could not save goal.");
    } finally {
      setGoalSaving(false);
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPwMessage(null);
    if (!newPassword) return;
    if (newPassword !== confirmPassword) {
      setPwMessage({ type: "error", text: "Passwords do not match." });
      return;
    }
    if (newPassword.length < 6) {
      setPwMessage({ type: "error", text: "Password must be at least 6 characters." });
      return;
    }
    setPwBusy(true);
    try {
      const { getSupabase } = await import("@/lib/supabase");
      const supabase = getSupabase();
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPwMessage({ type: "success", text: "Password changed successfully!" });
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      setPwMessage({ type: "error", text: err instanceof Error ? err.message : "Could not change password." });
    } finally {
      setPwBusy(false);
    }
  }

  const userEmail = authState.status === "signed-in" ? authState.user.email : "";

  const isDictationMode = settings.practiceMode === "dictation";
  const isChoiceActive = !isDictationMode && (settings.enableChoice ?? (settings.practiceMode !== "typing"));
  const isTypingActive = !isDictationMode && (settings.enableTyping ?? (settings.practiceMode !== "choice"));

  function toggleQuestionType(type: "choice" | "typing" | "dictation") {
    if (type === "dictation") {
      update({
        practiceMode: "dictation",
        enableChoice: false,
        enableTyping: false,
      });
      return;
    }

    let nextChoice = isChoiceActive;
    let nextTyping = isTypingActive;

    if (type === "choice") {
      nextChoice = !isChoiceActive;
    } else {
      nextTyping = !isTypingActive;
    }

    if (!nextChoice && !nextTyping) {
      return;
    }

    let nextMode: PracticeMode = "mixed";
    if (nextChoice && !nextTyping) nextMode = "choice";
    if (!nextChoice && nextTyping) nextMode = "typing";

    update({
      enableChoice: nextChoice,
      enableTyping: nextTyping,
      practiceMode: nextMode,
    });
  }

  return (
    <div className="mx-auto max-w-4xl grid gap-8 pb-16">
      {/* Title */}
      <div className="border-b border-line/60 pb-4">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink flex items-center gap-2.5">
          <span>Settings</span>
          <span className="w-2.5 h-2.5 rounded-full bg-subtitle" />
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-muted">
          Customize your appearance, practice flow, audio speech, and account security.
        </p>
      </div>

      {/* Appearance / Theme */}
      <section className="apple-card p-6 grid gap-6">
        <div>
          <h2 className="text-lg font-bold text-ink">Appearance & Theme</h2>
          <p className="text-xs sm:text-sm text-muted">Choose your preferred visual mode for cinema study.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {[
            {
              id: "light",
              label: "Light",
              desc: "Crisp daylight cinema",
              icon: (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              ),
            },
            {
              id: "dark",
              label: "Dark Theater",
              desc: "Deep midnight cinema",
              icon: (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              ),
            },
            {
              id: "system",
              label: "System",
              desc: "Follow OS preference",
              icon: (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              ),
            },
          ].map((t) => {
            const isSelected = settings.theme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => update({ theme: t.id as UserSettings["theme"] })}
                className={`flex flex-col items-start gap-2 p-4 rounded-2xl border text-start transition-all cursor-pointer ${
                  isSelected
                    ? "border-subtitle bg-subtitle/10 text-ink ring-2 ring-subtitle shadow-xs"
                    : "border-line bg-surface text-muted hover:text-ink hover:border-subtitle/40"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className={isSelected ? "text-subtitle" : "text-muted"}>{t.icon}</span>
                  <span
                    className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] font-bold ${
                      isSelected ? "bg-subtitle text-subtitle-ink border-subtitle" : "border-line"
                    }`}
                  >
                    {isSelected ? "✓" : ""}
                  </span>
                </div>
                <div>
                  <div className="font-bold text-ink text-sm">{t.label}</div>
                  <div className="text-xs text-muted mt-0.5">{t.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 1. Practice & Learning */}
      <section className="apple-card p-6 grid gap-6">
        <div>
          <h2 className="text-lg font-bold text-ink">Practice & Review</h2>
          <p className="text-xs sm:text-sm text-muted">Configure question styles, session lengths, and review speed.</p>
        </div>

        {/* Auto-Advance Switch */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="font-semibold text-ink">Auto-advance on correct answers</div>
            <div className="text-xs sm:text-sm text-muted">
              Automatically advance to the next word when you answer correctly.
            </div>
          </div>
          <label className="relative inline-flex cursor-pointer items-center shrink-0">
            <input
              type="checkbox"
              checked={settings.autoAdvance}
              onChange={(e) => update({ autoAdvance: e.target.checked })}
              className="peer sr-only"
            />
            <div className="peer h-6 w-11 rounded-full bg-line after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-subtitle peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none shadow-2xs" />
          </label>
        </div>

        {/* Question Types */}
        <div className="border-t border-line/50 pt-4 grid gap-3">
          <div>
            <div className="font-semibold text-ink">Question types / Practice style</div>
            <div className="text-xs sm:text-sm text-muted">
              Choose Multiple Choice, Typing, both (Mixed), or Dictation (listen &amp; type).
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 pt-1">
            {/* Card 1: Multiple Choice */}
            <button
              type="button"
              onClick={() => toggleQuestionType("choice")}
              className={`flex items-start gap-3.5 p-4 rounded-2xl border text-start transition-all cursor-pointer select-none ${
                isChoiceActive
                  ? "border-subtitle bg-subtitle/10 text-ink ring-2 ring-subtitle shadow-xs"
                  : "border-line bg-surface text-muted hover:text-ink hover:border-subtitle/40"
              }`}
            >
              <div className="w-9 h-9 rounded-xl bg-black/5 dark:bg-white/10 flex items-center justify-center shrink-0 text-subtitle">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-ink">Multiple Choice</span>
                  <span
                    className={`inline-flex items-center justify-center w-5 h-5 rounded-md border text-xs font-bold transition-colors ${
                      isChoiceActive
                        ? "bg-subtitle text-subtitle-ink border-subtitle"
                        : "border-line bg-surface"
                    }`}
                  >
                    {isChoiceActive ? "✓" : ""}
                  </span>
                </div>
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  Choose the correct translation or word from 4 quick options.
                </p>
              </div>
            </button>

            {/* Card 2: Write the words */}
            <button
              type="button"
              onClick={() => toggleQuestionType("typing")}
              className={`flex items-start gap-3.5 p-4 rounded-2xl border text-start transition-all cursor-pointer select-none ${
                isTypingActive
                  ? "border-subtitle bg-subtitle/10 text-ink ring-2 ring-subtitle shadow-xs"
                  : "border-line bg-surface text-muted hover:text-ink hover:border-subtitle/40"
              }`}
            >
              <div className="w-9 h-9 rounded-xl bg-black/5 dark:bg-white/10 flex items-center justify-center shrink-0 text-subtitle">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-ink">Write the words</span>
                  <span
                    className={`inline-flex items-center justify-center w-5 h-5 rounded-md border text-xs font-bold transition-colors ${
                      isTypingActive
                        ? "bg-subtitle text-subtitle-ink border-subtitle"
                        : "border-line bg-surface"
                    }`}
                  >
                    {isTypingActive ? "✓" : ""}
                  </span>
                </div>
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  See the translation and type the target word for strong active recall.
                </p>
              </div>
            </button>

            {/* Card 3: Dictation (Listen & Type) */}
            <button
              type="button"
              onClick={() => toggleQuestionType("dictation")}
              className={`flex items-start gap-3.5 p-4 rounded-2xl border text-start transition-all cursor-pointer select-none ${
                isDictationMode
                  ? "border-subtitle bg-subtitle/10 text-ink ring-2 ring-subtitle shadow-xs"
                  : "border-line bg-surface text-muted hover:text-ink hover:border-subtitle/40"
              }`}
            >
              <div className="w-9 h-9 rounded-xl bg-black/5 dark:bg-white/10 flex items-center justify-center shrink-0 text-subtitle">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-ink">Dictation</span>
                  <span
                    className={`inline-flex items-center justify-center w-5 h-5 rounded-md border text-xs font-bold transition-colors ${
                      isDictationMode
                        ? "bg-subtitle text-subtitle-ink border-subtitle"
                        : "border-line bg-surface"
                    }`}
                  >
                    {isDictationMode ? "✓" : ""}
                  </span>
                </div>
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  Hear the word spoken aloud and spell it cleanly without seeing hints.
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Session Size */}
        <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center border-t border-line/50 pt-4">
          <div>
            <div className="font-semibold text-ink">Words per practice session</div>
            <div className="text-xs sm:text-sm text-muted">Number of words to review in each study round.</div>
          </div>
          <select
            value={settings.sessionSize}
            onChange={(e) => update({ sessionSize: Number(e.target.value) })}
            className="field w-44"
          >
            <option value={5}>5 words (Quick)</option>
            <option value={8}>8 words (Default)</option>
            <option value={10}>10 words</option>
            <option value={15}>15 words</option>
            <option value={20}>20 words (Deep focus)</option>
          </select>
        </div>

        {/* Daily XP Goal */}
        <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center border-t border-line/50 pt-4">
          <div>
            <div className="font-semibold text-ink">Daily XP goal</div>
            <div className="text-xs sm:text-sm text-muted">Target XP to complete each day to maintain your streak.</div>
            {goalMessage ? <div className="text-xs font-semibold text-ok mt-1">{goalMessage}</div> : null}
          </div>
          <div className="apple-segmented-container">
            {GOALS.map((g) => (
              <button
                key={g}
                type="button"
                disabled={goalSaving}
                onClick={() => void handleGoalChange(g)}
                data-active={dailyGoalVal === g ? "true" : undefined}
                className="apple-segmented-item"
              >
                {g} XP
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 2. Languages & Translation */}
      <section className="apple-card p-6 grid gap-6">
        <div>
          <h2 className="text-lg font-bold text-ink">Translation & Languages</h2>
          <p className="text-xs sm:text-sm text-muted">Configure saving mode and default target language.</p>
        </div>

        {/* Word Saving Mode */}
        <div className="grid gap-3">
          <div>
            <div className="font-semibold text-ink">Word saving in translator</div>
            <div className="text-xs sm:text-sm text-muted">
              Choose whether words translated on the dashboard are saved automatically or manually.
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 pt-1">
            {/* Manual Save Card */}
            <button
              type="button"
              onClick={() => update({ translateSaveMode: "manual" })}
              className={`flex items-start gap-3.5 p-4 rounded-2xl border text-start transition-all cursor-pointer select-none ${
                (settings.translateSaveMode || "manual") === "manual"
                  ? "border-subtitle bg-subtitle/10 text-ink ring-2 ring-subtitle shadow-xs"
                  : "border-line bg-surface text-muted hover:text-ink hover:border-subtitle/40"
              }`}
            >
              <div className="w-9 h-9 rounded-xl bg-black/5 dark:bg-white/10 flex items-center justify-center shrink-0 text-subtitle">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-ink text-sm">Manual save</span>
                  <span
                    className={`inline-flex items-center justify-center w-5 h-5 rounded-md border text-xs font-bold transition-colors ${
                      (settings.translateSaveMode || "manual") === "manual"
                        ? "bg-subtitle text-subtitle-ink border-subtitle"
                        : "border-line bg-surface"
                    }`}
                  >
                    {(settings.translateSaveMode || "manual") === "manual" ? "✓" : ""}
                  </span>
                </div>
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  Words are saved only when you click the <strong>&quot;Save&quot;</strong> button.
                </p>
              </div>
            </button>

            {/* Subtitles Only Auto-Save Card */}
            <button
              type="button"
              onClick={() => update({ translateSaveMode: "subtitles_only" })}
              className={`flex items-start gap-3.5 p-4 rounded-2xl border text-start transition-all cursor-pointer select-none ${
                settings.translateSaveMode === "subtitles_only"
                  ? "border-subtitle bg-subtitle/10 text-ink ring-2 ring-subtitle shadow-xs"
                  : "border-line bg-surface text-muted hover:text-ink hover:border-subtitle/40"
              }`}
            >
              <div className="w-9 h-9 rounded-xl bg-black/5 dark:bg-white/10 flex items-center justify-center shrink-0 text-subtitle">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="3" />
                  <line x1="6" y1="12" x2="18" y2="12" />
                  <line x1="8" y1="15" x2="16" y2="15" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-ink text-sm">Subtitles only</span>
                  <span
                    className={`inline-flex items-center justify-center w-5 h-5 rounded-md border text-xs font-bold transition-colors ${
                      settings.translateSaveMode === "subtitles_only"
                        ? "bg-subtitle text-subtitle-ink border-subtitle"
                        : "border-line bg-surface"
                    }`}
                  >
                    {settings.translateSaveMode === "subtitles_only" ? "✓" : ""}
                  </span>
                </div>
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  Auto-save when clicking words in <strong>video subtitles</strong> only. Web text stays manual.
                </p>
              </div>
            </button>

            {/* Auto Save All Card */}
            <button
              type="button"
              onClick={() => update({ translateSaveMode: "auto" })}
              className={`flex items-start gap-3.5 p-4 rounded-2xl border text-start transition-all cursor-pointer select-none ${
                settings.translateSaveMode === "auto"
                  ? "border-subtitle bg-subtitle/10 text-ink ring-2 ring-subtitle shadow-xs"
                  : "border-line bg-surface text-muted hover:text-ink hover:border-subtitle/40"
              }`}
            >
              <div className="w-9 h-9 rounded-xl bg-black/5 dark:bg-white/10 flex items-center justify-center shrink-0 text-subtitle">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-ink text-sm">Auto-save all</span>
                  <span
                    className={`inline-flex items-center justify-center w-5 h-5 rounded-md border text-xs font-bold transition-colors ${
                      settings.translateSaveMode === "auto"
                        ? "bg-subtitle text-subtitle-ink border-subtitle"
                        : "border-line bg-surface"
                    }`}
                  >
                    {settings.translateSaveMode === "auto" ? "✓" : ""}
                  </span>
                </div>
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  Every translated word everywhere is automatically added to your practice list.
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Text Selection Translation Mode (Extension) */}
        <div className="grid gap-3 border-t border-line/50 pt-4">
          <div>
            <div className="font-semibold text-ink">Text selection translation</div>
            <div className="text-xs sm:text-sm text-muted">
              Choose how translations appear when you highlight words on web pages (Claude, ChatGPT, articles, Wikipedia, etc.).
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Pop-up Card */}
            <button
              type="button"
              onClick={() => update({ selectionMode: "immediate" })}
              className={`flex items-start gap-3.5 p-4 rounded-2xl border text-start transition-all cursor-pointer select-none ${
                (settings.selectionMode || "immediate") === "immediate"
                  ? "border-subtitle bg-subtitle/10 text-ink ring-2 ring-subtitle shadow-xs"
                  : "border-line bg-surface text-muted hover:text-ink hover:border-subtitle/40"
              }`}
            >
              <div className="w-9 h-9 rounded-xl bg-black/5 dark:bg-white/10 flex items-center justify-center shrink-0 text-subtitle">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-ink text-sm">Pop-up card</span>
                  <span
                    className={`inline-flex items-center justify-center w-5 h-5 rounded-md border text-xs font-bold transition-colors ${
                      (settings.selectionMode || "immediate") === "immediate"
                        ? "bg-subtitle text-subtitle-ink border-subtitle"
                        : "border-line bg-surface"
                    }`}
                  >
                    {(settings.selectionMode || "immediate") === "immediate" ? "✓" : ""}
                  </span>
                </div>
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  Immediately shows the translation card when you select text anywhere.
                </p>
              </div>
            </button>

            {/* Floating Icon */}
            <button
              type="button"
              onClick={() => update({ selectionMode: "icon" })}
              className={`flex items-start gap-3.5 p-4 rounded-2xl border text-start transition-all cursor-pointer select-none ${
                settings.selectionMode === "icon"
                  ? "border-subtitle bg-subtitle/10 text-ink ring-2 ring-subtitle shadow-xs"
                  : "border-line bg-surface text-muted hover:text-ink hover:border-subtitle/40"
              }`}
            >
              <div className="w-9 h-9 rounded-xl bg-black/5 dark:bg-white/10 flex items-center justify-center shrink-0 text-subtitle">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v8" />
                  <path d="M8 12h8" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-ink text-sm">Floating icon</span>
                  <span
                    className={`inline-flex items-center justify-center w-5 h-5 rounded-md border text-xs font-bold transition-colors ${
                      settings.selectionMode === "icon"
                        ? "bg-subtitle text-subtitle-ink border-subtitle"
                        : "border-line bg-surface"
                    }`}
                  >
                    {settings.selectionMode === "icon" ? "✓" : ""}
                  </span>
                </div>
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  Shows a small floating WordTap icon. Click it whenever you want to open the card.
                </p>
              </div>
            </button>

            {/* Hold Alt + Select */}
            <button
              type="button"
              onClick={() => update({ selectionMode: "alt" })}
              className={`flex items-start gap-3.5 p-4 rounded-2xl border text-start transition-all cursor-pointer select-none ${
                settings.selectionMode === "alt"
                  ? "border-subtitle bg-subtitle/10 text-ink ring-2 ring-subtitle shadow-xs"
                  : "border-line bg-surface text-muted hover:text-ink hover:border-subtitle/40"
              }`}
            >
              <div className="w-9 h-9 rounded-xl bg-black/5 dark:bg-white/10 flex items-center justify-center shrink-0 text-subtitle">
                <span className="text-xs font-extrabold tracking-tight">Alt</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-ink text-sm">Hold Alt + Select</span>
                  <span
                    className={`inline-flex items-center justify-center w-5 h-5 rounded-md border text-xs font-bold transition-colors ${
                      settings.selectionMode === "alt"
                        ? "bg-subtitle text-subtitle-ink border-subtitle"
                        : "border-line bg-surface"
                    }`}
                  >
                    {settings.selectionMode === "alt" ? "✓" : ""}
                  </span>
                </div>
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  Only translate selected text when you hold the Alt (Option) key.
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Default Translation Language */}
        <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center border-t border-line/50 pt-4">
          <div>
            <div className="font-semibold text-ink">Default translation language</div>
            <div className="text-xs sm:text-sm text-muted">The language you want words translated into.</div>
          </div>
          <select
            value={settings.targetLang}
            onChange={(e) => update({ targetLang: e.target.value })}
            className="field w-56"
          >
            {TARGET_LANGS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* 3. Audio & Voice Settings */}
      <section className="apple-card p-6 grid gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line/50 pb-3">
          <div>
            <h2 className="text-lg font-bold text-ink">Audio & Voice Pronunciation</h2>
            <p className="text-xs sm:text-sm text-muted">Choose your voice gender, tone, and pronunciation pace.</p>
          </div>
          {canSpeak() ? (
            <button
              type="button"
              onClick={() =>
                speak(
                  "Hello, welcome to WordTap! This is how your vocabulary sounds.",
                  "en-US"
                )
              }
              className="btn btn-primary min-h-9 px-4 py-1.5 text-xs font-semibold"
              title="Test current voice"
            >
              <SpeakerIcon size={16} /> Test Voice
            </button>
          ) : null}
        </div>

        {/* Voice Gender */}
        <div className="grid gap-2">
          <div className="font-semibold text-ink">Voice gender (Man or Woman)</div>
          <div className="text-xs sm:text-sm text-muted">Choose whether you prefer a female or male speaker.</div>
          <div className="grid gap-3 sm:grid-cols-3 mt-1">
            {[
              { id: "female", label: "Woman (Female)", desc: "Clear, warm tone" },
              { id: "male", label: "Man (Male)", desc: "Deeper resonant tone" },
              { id: "auto", label: "Auto / Default", desc: "System voice" },
            ].map((g) => {
              const isSelected = (settings.voiceGender || "female") === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => {
                    update({ voiceGender: g.id as UserSettings["voiceGender"] });
                    speak("Testing " + g.label, "en-US", { gender: g.id as UserSettings["voiceGender"] });
                  }}
                  className={`flex flex-col items-start gap-1 p-3.5 rounded-2xl border text-start transition-all cursor-pointer ${
                    isSelected
                      ? "border-subtitle bg-subtitle/10 text-ink ring-2 ring-subtitle shadow-xs"
                      : "border-line bg-surface text-muted hover:text-ink hover:border-subtitle/40"
                  }`}
                >
                  <span className="font-bold text-ink text-sm">{g.label}</span>
                  <span className="text-xs text-muted">{g.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Voice Tone */}
        <div className="grid gap-2 border-t border-line/50 pt-4">
          <div className="font-semibold text-ink">Voice tone & softness</div>
          <div className="text-xs sm:text-sm text-muted">Adjust how soft, calm, or deep the pronunciation sounds.</div>
          <div className="grid gap-3 sm:grid-cols-4 mt-1">
            {[
              { id: "soft", label: "Soft & Calm", desc: "Gentle cadence" },
              { id: "natural", label: "Natural", desc: "Balanced standard" },
              { id: "deep", label: "Deep & Rich", desc: "Lower resonance" },
              { id: "energetic", label: "Clear & Crisp", desc: "High clarity" },
            ].map((t) => {
              const isSelected = (settings.voiceTone || "soft") === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    update({ voiceTone: t.id as UserSettings["voiceTone"] });
                    speak("This is the " + t.label + " tone", "en-US", { tone: t.id as UserSettings["voiceTone"] });
                  }}
                  className={`flex flex-col items-start gap-1 p-3 rounded-2xl border text-start transition-all cursor-pointer ${
                    isSelected
                      ? "border-subtitle bg-subtitle/10 text-ink ring-2 ring-subtitle shadow-xs"
                      : "border-line bg-surface text-muted hover:text-ink hover:border-subtitle/40"
                  }`}
                >
                  <span className="font-bold text-ink text-sm">{t.label}</span>
                  <span className="text-xs text-muted">{t.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Pronunciation Speed */}
        <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center border-t border-line/50 pt-4">
          <div>
            <div className="font-semibold text-ink">Pronunciation speed</div>
            <div className="text-xs sm:text-sm text-muted">Adjust the playback rate for spoken words.</div>
          </div>
          <select
            value={settings.speechRate}
            onChange={(e) => {
              const r = Number(e.target.value);
              update({ speechRate: r });
              speak("Pronunciation speed updated", "en-US", { rate: r });
            }}
            className="field w-44"
          >
            <option value={0.8}>0.8x (Slow)</option>
            <option value={0.92}>0.92x (Soft & Natural)</option>
            <option value={1.0}>1.0x (Normal)</option>
            <option value={1.15}>1.15x (Fast)</option>
          </select>
        </div>
      </section>

      {/* 4. Account & Security */}
      <section className="apple-card p-6 grid gap-6">
        <div>
          <h2 className="text-lg font-bold text-ink">Account & Security</h2>
          <p className="text-xs sm:text-sm text-muted">Manage your login details and account session.</p>
        </div>

        <div>
          <div className="text-xs font-semibold text-muted">Logged in as</div>
          <div className="text-base font-bold text-ink mt-0.5">{userEmail || "Signed in"}</div>
        </div>

        <form onSubmit={handlePasswordChange} className="grid gap-3 border-t border-line/50 pt-4">
          <div className="font-semibold text-ink">Change password</div>

          {pwMessage ? (
            <div
              className={`rounded-xl px-4 py-2 text-xs font-semibold ${
                pwMessage.type === "success" ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad"
              }`}
            >
              {pwMessage.text}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="password"
              placeholder="New password (min. 6 chars)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="field"
              required
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="field"
              required
            />
          </div>

          <div className="flex justify-end pt-1">
            <button type="submit" disabled={pwBusy || !newPassword} className="btn btn-primary min-w-36 text-xs font-semibold">
              {pwBusy ? "Updating…" : "Update Password"}
            </button>
          </div>
        </form>

        <div className="flex items-center justify-between border-t border-line/50 pt-4">
          <div>
            <div className="font-semibold text-ink">Sign out</div>
            <div className="text-xs sm:text-sm text-muted">Sign out of your WordTap session on this device.</div>
          </div>
          <button type="button" onClick={() => void signOut()} className="btn btn-quiet min-w-28 text-xs font-medium">
            Sign out
          </button>
        </div>

        {/* Delete Account (Danger Zone) */}
        <div className="border-t border-bad/30 pt-4 bg-bad-soft/30 -mx-6 -mb-6 p-6 rounded-b-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="font-bold text-bad">Delete account</div>
              <div className="text-xs sm:text-sm text-muted">
                Permanently delete your account, all saved vocabulary words, and learning progress.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="btn btn-bad min-w-36 shrink-0 text-xs font-semibold"
            >
              Delete account
            </button>
          </div>
        </div>
      </section>

      {/* Confirmation Modal */}
      {showDeleteModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div role="alertdialog" aria-modal="true" className="w-full max-w-md rounded-2xl border-2 border-bad bg-surface p-6 shadow-2xl grid gap-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-bad font-bold text-xl">
              <span>Delete Account?</span>
            </div>
            <p className="text-sm text-ink leading-relaxed">
              Are you sure you want to permanently delete your account? This action <strong>cannot be undone</strong>. All your saved vocabulary, Leitner boxes, XP, and streak will be permanently erased.
            </p>

            {deleteError ? (
              <div className="rounded-xl bg-bad-soft p-3 text-xs font-semibold text-bad">
                {deleteError}
              </div>
            ) : null}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={deleteBusy}
                onClick={() => setShowDeleteModal(false)}
                className="btn btn-quiet"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteBusy}
                onClick={() => void handleDeleteAccount()}
                className="btn btn-bad"
              >
                {deleteBusy ? "Deleting..." : "Yes, delete account"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

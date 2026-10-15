"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getSupabase } from "@/lib/supabase";
import { fetchStats, setDailyGoal, deleteAccount } from "@/lib/api";
import { getStoredSettings, saveStoredSettings, type UserSettings, type PracticeMode } from "@/lib/settings";
import { canSpeak, speak, detectVoiceGender } from "@/lib/speech";
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
    } catch (e: any) {
      setDeleteError(e.message || "Failed to delete account");
      setDeleteBusy(false);
    }
  }

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    fetchStats()
      .then((s) => setDailyGoalVal(s.daily_goal))
      .catch(() => {});

    if (canSpeak()) {
      const load = () => {
        const v = window.speechSynthesis.getVoices();
        if (v.length > 0) setVoices(v);
      };
      load();
      window.speechSynthesis.onvoiceschanged = load;
      return () => {
        if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = null;
      };
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
    if (newPassword.length < 6) {
      setPwMessage({ type: "error", text: "Password must be at least 6 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMessage({ type: "error", text: "Passwords do not match." });
      return;
    }

    setPwBusy(true);
    try {
      const { error } = await getSupabase().auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPwMessage({ type: "success", text: "Password updated successfully!" });
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPwMessage({ type: "error", text: err.message || "Could not update password." });
    } finally {
      setPwBusy(false);
    }
  }

  const userEmail = authState.status === "signed-in" ? authState.user.email : "";

  const isChoiceActive = settings.enableChoice ?? (settings.practiceMode !== "typing");
  const isTypingActive = settings.enableTyping ?? (settings.practiceMode !== "choice");

  function toggleQuestionType(type: "choice" | "typing") {
    let nextChoice = isChoiceActive;
    let nextTyping = isTypingActive;

    if (type === "choice") {
      nextChoice = !isChoiceActive;
    } else {
      nextTyping = !isTypingActive;
    }

    // Must keep at least one enabled
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
    <div className="mx-auto max-w-3xl grid gap-8 pb-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted">Customize your practice flow, audio, and account preferences.</p>
      </div>

      {/* Appearance & Dark Mode */}
      <section className="rounded-2xl border border-line bg-surface p-6 grid gap-6">
        <h2 className="text-xl font-bold border-b border-line pb-3">Appearance / Dark Mode</h2>

        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { id: "light", label: "Light", icon: "☀️", desc: "Daylight page" },
            { id: "dark", label: "Dark", icon: "🌙", desc: "Dark theater cinema" },
            { id: "system", label: "System", icon: "💻", desc: "Follow OS preference" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => update({ theme: t.id as any })}
              className={`flex flex-col items-start gap-1 p-4 rounded-xl border text-start transition-all cursor-pointer ${
                settings.theme === t.id
                  ? "border-subtitle bg-subtitle/10 text-ink ring-2 ring-subtitle"
                  : "border-line bg-surface text-muted hover:text-ink hover:border-ink/30"
              }`}
            >
              <span className="text-2xl">{t.icon}</span>
              <span className="font-bold text-ink mt-1">{t.label}</span>
              <span className="text-xs text-muted">{t.desc}</span>
            </button>
          ))}
        </div>
      </section>

      {/* 1. Practice & Learning */}
      <section className="rounded-2xl border border-line bg-surface p-6 grid gap-6">
        <h2 className="text-xl font-bold border-b border-line pb-3">Practice & Review</h2>

        {/* Auto-Advance */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="font-semibold text-ink">Auto-advance on correct answers</div>
            <div className="text-sm text-muted">
              Skip the &quot;Continue&quot; button automatically when you answer correctly.
            </div>
          </div>
          <label className="relative inline-flex cursor-pointer items-center shrink-0">
            <input
              type="checkbox"
              checked={settings.autoAdvance}
              onChange={(e) => update({ autoAdvance: e.target.checked })}
              className="peer sr-only"
            />
            <div className="peer h-6 w-11 rounded-full bg-line after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-subtitle peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none" />
          </label>
        </div>

        {/* Speed */}
        {settings.autoAdvance ? (
          <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center border-t border-line/60 pt-4">
            <div>
              <div className="font-semibold text-ink">Auto-advance speed</div>
              <div className="text-sm text-muted">How long to show the green &quot;Correct&quot; screen before continuing.</div>
            </div>
            <select
              value={settings.autoAdvanceDelayMs}
              onChange={(e) => update({ autoAdvanceDelayMs: Number(e.target.value) })}
              className="field w-44"
            >
              <option value={500}>Fast (0.5s)</option>
              <option value={800}>Normal (0.8s)</option>
              <option value={1200}>Relaxed (1.2s)</option>
              <option value={1500}>Slow (1.5s)</option>
            </select>
          </div>
        ) : null}

        {/* Practice Question Types */}
        <div className="border-t border-line/60 pt-4 grid gap-3">
          <div>
            <div className="font-semibold text-ink">Question types / Practice style</div>
            <div className="text-sm text-muted">
              Choose your practice question types. You can pick either one or both!
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 pt-1">
            {/* Card 1: Multiple Choice */}
            <button
              type="button"
              onClick={() => toggleQuestionType("choice")}
              className={`flex items-start gap-3.5 p-4 rounded-xl border text-start transition-all cursor-pointer select-none ${
                isChoiceActive
                  ? "border-subtitle bg-subtitle/10 text-ink ring-2 ring-subtitle"
                  : "border-line bg-surface text-muted hover:text-ink hover:border-ink/30"
              }`}
            >
              <div className="text-2xl pt-0.5">🔘</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-ink">Multiple Choice</span>
                  <span
                    className={`inline-flex items-center justify-center w-5 h-5 rounded-md border text-xs font-bold transition-colors ${
                      isChoiceActive
                        ? "bg-subtitle text-black border-subtitle"
                        : "border-line bg-surface"
                    }`}
                  >
                    {isChoiceActive ? "✓" : ""}
                  </span>
                </div>
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  Choose the correct translation or English word from 4 quick options.
                </p>
              </div>
            </button>

            {/* Card 2: Write the words (Typing) */}
            <button
              type="button"
              onClick={() => toggleQuestionType("typing")}
              className={`flex items-start gap-3.5 p-4 rounded-xl border text-start transition-all cursor-pointer select-none ${
                isTypingActive
                  ? "border-subtitle bg-subtitle/10 text-ink ring-2 ring-subtitle"
                  : "border-line bg-surface text-muted hover:text-ink hover:border-ink/30"
              }`}
            >
              <div className="text-2xl pt-0.5">✍️</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-ink">Write the words (Typing)</span>
                  <span
                    className={`inline-flex items-center justify-center w-5 h-5 rounded-md border text-xs font-bold transition-colors ${
                      isTypingActive
                        ? "bg-subtitle text-black border-subtitle"
                        : "border-line bg-surface"
                    }`}
                  >
                    {isTypingActive ? "✓" : ""}
                  </span>
                </div>
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  See the meaning (e.g. &quot;كان&quot;) and type the word yourself (e.g. &quot;was&quot;).
                </p>
              </div>
            </button>
          </div>

          {/* Dynamic Status / Feedback */}
          <div className="rounded-xl bg-surface border border-line p-3 text-xs flex items-center gap-2">
            {isChoiceActive && isTypingActive ? (
              <span className="text-ink">
                ✨ <strong>Both active (Mixed):</strong> Practice sessions will alternate between typing questions and multiple choice quizzes.
              </span>
            ) : isTypingActive ? (
              <span className="text-subtitle font-medium">
                ✍️ <strong>Writing mode only:</strong> You will type the English words for every single question.
              </span>
            ) : (
              <span className="text-subtitle font-medium">
                🔘 <strong>Multiple choice only:</strong> Fast 4-option quizzes without typing.
              </span>
            )}
          </div>
        </div>

        {/* Session Size */}
        <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center border-t border-line/60 pt-4">
          <div>
            <div className="font-semibold text-ink">Words per practice session</div>
            <div className="text-sm text-muted">Number of words to review in each practice round.</div>
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
        <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center border-t border-line/60 pt-4">
          <div>
            <div className="font-semibold text-ink">Daily XP goal</div>
            <div className="text-sm text-muted">Target XP to complete each day to maintain your streak.</div>
            {goalMessage ? <div className="text-xs font-semibold text-ok mt-1">{goalMessage}</div> : null}
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {GOALS.map((g) => (
              <button
                key={g}
                type="button"
                disabled={goalSaving}
                onClick={() => void handleGoalChange(g)}
                className={`rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors border ${
                  dailyGoalVal === g
                    ? "bg-subtitle text-subtitle-ink border-subtitle-edge"
                    : "border-line text-muted hover:text-ink hover:bg-bg"
                }`}
              >
                {g} XP
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 2. Languages & Translation */}
      <section className="rounded-2xl border border-line bg-surface p-6 grid gap-6">
        <h2 className="text-xl font-bold border-b border-line pb-3">Translation & Languages</h2>

        {/* Translation Word Saving Mode (Auto vs Manual) */}
        <div className="grid gap-3">
          <div>
            <div className="font-semibold text-ink">Word saving in translator</div>
            <div className="text-sm text-muted">
              Choose whether words translated on the dashboard are saved automatically or manually.
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 pt-1">
            {/* Manual Save Card */}
            <button
              type="button"
              onClick={() => update({ translateSaveMode: "manual" })}
              className={`flex items-start gap-3.5 p-4 rounded-xl border text-start transition-all cursor-pointer select-none ${
                (settings.translateSaveMode || "manual") === "manual"
                  ? "border-subtitle bg-subtitle/10 text-ink ring-2 ring-subtitle"
                  : "border-line bg-surface text-muted hover:text-ink hover:border-ink/30"
              }`}
            >
              <div className="text-2xl pt-0.5">✍️</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-ink">Manual save (حفظ يدوي)</span>
                  <span
                    className={`inline-flex items-center justify-center w-5 h-5 rounded-md border text-xs font-bold transition-colors ${
                      (settings.translateSaveMode || "manual") === "manual"
                        ? "bg-subtitle text-black border-subtitle"
                        : "border-line bg-surface"
                    }`}
                  >
                    {(settings.translateSaveMode || "manual") === "manual" ? "✓" : ""}
                  </span>
                </div>
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  Words are only saved when you click the <strong>&quot;⭐ + Save to My Words&quot;</strong> button.
                </p>
              </div>
            </button>

            {/* Auto Save Card */}
            <button
              type="button"
              onClick={() => update({ translateSaveMode: "auto" })}
              className={`flex items-start gap-3.5 p-4 rounded-xl border text-start transition-all cursor-pointer select-none ${
                settings.translateSaveMode === "auto"
                  ? "border-subtitle bg-subtitle/10 text-ink ring-2 ring-subtitle"
                  : "border-line bg-surface text-muted hover:text-ink hover:border-ink/30"
              }`}
            >
              <div className="text-2xl pt-0.5">⚡</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-ink">Auto-save (حفظ تلقائي)</span>
                  <span
                    className={`inline-flex items-center justify-center w-5 h-5 rounded-md border text-xs font-bold transition-colors ${
                      settings.translateSaveMode === "auto"
                        ? "bg-subtitle text-black border-subtitle"
                        : "border-line bg-surface"
                    }`}
                  >
                    {settings.translateSaveMode === "auto" ? "✓" : ""}
                  </span>
                </div>
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  Every word or sentence you translate is automatically saved directly to your WordTap vocabulary.
                </p>
              </div>
            </button>
          </div>

          <div className="rounded-xl bg-surface border border-line p-3 text-xs flex items-center gap-2">
            {settings.translateSaveMode === "auto" ? (
              <span className="text-subtitle font-medium">
                ⚡ <strong>Auto-save active:</strong> Translations will automatically be added to your word list without needing to click the save button.
              </span>
            ) : (
              <span className="text-ink">
                ✍️ <strong>Manual mode active:</strong> Click <strong>&quot;⭐ + Save to My Words&quot;</strong> whenever you want to add a translated word to your practice list.
              </span>
            )}
          </div>
        </div>

        {/* Default Translation Language */}
        <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center border-t border-line/60 pt-4">
          <div>
            <div className="font-semibold text-ink">Default translation language</div>
            <div className="text-sm text-muted">The language you want words translated into.</div>
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
      <section className="rounded-2xl border border-line bg-surface p-6 grid gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-3">
          <div>
            <h2 className="text-xl font-bold">Audio & Speaker Voice</h2>
            <p className="text-sm text-muted">Choose your voice gender (Man/Woman), softness, and voice style.</p>
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
              className="btn btn-primary min-h-10 px-4 py-1.5 text-sm"
              title="Test current voice"
            >
              <SpeakerIcon size={18} /> Test voice
            </button>
          ) : null}
        </div>

        {/* 1. Voice Gender: Man or Woman */}
        <div className="grid gap-2">
          <div className="font-semibold text-ink">Voice gender (Man or Woman)</div>
          <div className="text-sm text-muted">Choose whether you prefer a female or male speaker.</div>
          <div className="grid gap-3 sm:grid-cols-3 mt-1">
            {[
              { id: "female", label: "Woman (Female)", icon: "👩", desc: "Clear, warm female voice" },
              { id: "male", label: "Man (Male)", icon: "👨", desc: "Deeper, resonant male voice" },
              { id: "auto", label: "Auto / Default", icon: "🤖", desc: "System recommended voice" },
            ].map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  update({ voiceGender: g.id as any });
                  speak("Testing " + g.label, "en-US", { gender: g.id as any });
                }}
                className={`flex flex-col items-start gap-1 p-3.5 rounded-xl border text-start transition-all cursor-pointer ${
                  (settings.voiceGender || "female") === g.id
                    ? "border-subtitle bg-subtitle/10 text-ink ring-2 ring-subtitle"
                    : "border-line bg-surface text-muted hover:text-ink hover:border-ink/30"
                }`}
              >
                <span className="text-2xl">{g.icon}</span>
                <span className="font-bold text-ink mt-0.5">{g.label}</span>
                <span className="text-xs text-muted">{g.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 2. Voice Tone & Softness */}
        <div className="grid gap-2 border-t border-line/60 pt-4">
          <div className="font-semibold text-ink">Voice tone & softness</div>
          <div className="text-sm text-muted">Adjust how soft, calm, or deep the pronunciation sounds.</div>
          <div className="grid gap-3 sm:grid-cols-4 mt-1">
            {[
              { id: "soft", label: "Soft & Calm", icon: "🌸", desc: "Gentle, soothing cadence" },
              { id: "natural", label: "Natural", icon: "🎙️", desc: "Balanced standard tone" },
              { id: "deep", label: "Deep & Rich", icon: "🔊", desc: "Lower, authoritative tone" },
              { id: "energetic", label: "Clear & Crisp", icon: "⚡", desc: "High clarity pronunciation" },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  update({ voiceTone: t.id as any });
                  speak("This is the " + t.label + " tone", "en-US", { tone: t.id as any });
                }}
                className={`flex flex-col items-start gap-1 p-3 rounded-xl border text-start transition-all cursor-pointer ${
                  (settings.voiceTone || "soft") === t.id
                    ? "border-subtitle bg-subtitle/10 text-ink ring-2 ring-subtitle"
                    : "border-line bg-surface text-muted hover:text-ink hover:border-ink/30"
                }`}
              >
                <span className="text-xl">{t.icon}</span>
                <span className="font-bold text-ink text-sm mt-0.5">{t.label}</span>
                <span className="text-xs text-muted line-clamp-2">{t.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 3. Specific Voice Choices (From System/Browser) */}
        {voices.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center border-t border-line/60 pt-4">
            <div>
              <div className="font-semibold text-ink">Specific voice</div>
              <div className="text-sm text-muted">Pick a specific voice installed on your device or leave as Auto.</div>
            </div>
            <select
              value={settings.voiceURI || ""}
              onChange={(e) => {
                const uri = e.target.value;
                update({ voiceURI: uri });
                if (uri) {
                  speak("Voice selected", "en-US", { voiceURI: uri });
                }
              }}
              className="field w-72 max-w-full"
            >
              <option value="">Auto (Matches gender & tone)</option>
              {voices.map((v) => {
                const g = detectVoiceGender(v);
                const tag = g === "female" ? " (Woman)" : g === "male" ? " (Man)" : "";
                return (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} [{v.lang}]{tag}
                  </option>
                );
              })}
            </select>
          </div>
        ) : null}

        {/* 4. Speech Speed */}
        <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center border-t border-line/60 pt-4">
          <div>
            <div className="font-semibold text-ink">Speech pronunciation speed</div>
            <div className="text-sm text-muted">Adjust how fast foreign words are spoken.</div>
          </div>
          <select
            value={settings.speechRate}
            onChange={(e) => {
              const r = Number(e.target.value);
              update({ speechRate: r });
              speak("Pronunciation speed updated", "en-US", { rate: r });
            }}
            className="field w-40"
          >
            <option value={0.8}>0.8x (Slow)</option>
            <option value={0.92}>0.92x (Soft & Natural)</option>
            <option value={1.0}>1.0x (Normal)</option>
            <option value={1.15}>1.15x (Fast)</option>
          </select>
        </div>
      </section>

      {/* 4. Account & Security */}
      <section className="rounded-2xl border border-line bg-surface p-6 grid gap-6">
        <h2 className="text-xl font-bold border-b border-line pb-3">Account & Security</h2>

        <div>
          <div className="text-sm font-semibold text-muted">Logged in as</div>
          <div className="text-base font-bold text-ink mt-0.5">{userEmail || "Signed in"}</div>
        </div>

        <form onSubmit={handlePasswordChange} className="grid gap-3 border-t border-line/60 pt-4">
          <div className="font-semibold text-ink">Change password</div>

          {pwMessage ? (
            <div
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${
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

          <div className="flex justify-end">
            <button type="submit" disabled={pwBusy || !newPassword} className="btn btn-primary min-w-36">
              {pwBusy ? "Updating…" : "Update password"}
            </button>
          </div>
        </form>

        <div className="flex items-center justify-between border-t border-line/60 pt-4">
          <div>
            <div className="font-semibold text-ink">Sign out</div>
            <div className="text-sm text-muted">Sign out of your WordTap account on this browser.</div>
          </div>
          <button type="button" onClick={() => void signOut()} className="btn min-w-28">
            Sign out
          </button>
        </div>

        {/* Delete Account (Danger Zone) */}
        <div className="border-t border-bad/30 pt-4 bg-bad-soft/30 -mx-6 -mb-6 p-6 rounded-b-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="font-bold text-bad">Delete account</div>
              <div className="text-sm text-muted">
                Permanently delete your account, all saved vocabulary words, and learning progress.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="btn btn-bad min-w-36 shrink-0"
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
              <span className="text-2xl">⚠️</span> Delete Account?
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

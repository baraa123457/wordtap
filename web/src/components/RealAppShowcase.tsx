"use client";

import { useState } from "react";

export function RealAppShowcase({ lang = "en" }: { lang?: "en" | "ar" }) {
  const [tab, setTab] = useState<"practice" | "words" | "subtitles">("practice");
  const isAr = lang === "ar";

  return (
    <div className="w-full space-y-4">
      {/* Tab controls */}
      <div className="flex items-center justify-between border-b border-line/60 pb-3">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-subtitle">
            {isAr ? "معاينة حية للتطبيق" : "Live App Preview"}
          </span>
          <h2 className="text-xl sm:text-2xl font-extrabold text-ink">
            {isAr ? "من المشاهدة إلى الكلمات التي تحفظها وتراجعها" : "From watching shows to words that actually stick"}
          </h2>
        </div>

        <div className="flex rounded-xl bg-surface p-1 border border-line text-xs font-semibold">
          <button
            type="button"
            onClick={() => setTab("practice")}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              tab === "practice" ? "bg-subtitle text-subtitle-ink shadow-xs" : "text-muted hover:text-ink"
            }`}
          >
            {isAr ? "جلسة التدريب" : "Practice Session"}
          </button>
          <button
            type="button"
            onClick={() => setTab("words")}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              tab === "words" ? "bg-subtitle text-subtitle-ink shadow-xs" : "text-muted hover:text-ink"
            }`}
          >
            {isAr ? "قائمة كلماتي" : "Saved Words"}
          </button>
          <button
            type="button"
            onClick={() => setTab("subtitles")}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              tab === "subtitles" ? "bg-subtitle text-subtitle-ink shadow-xs" : "text-muted hover:text-ink"
            }`}
          >
            {isAr ? "الترجمة في الفيديو" : "Subtitle Tooltip"}
          </button>
        </div>
      </div>

      {/* Screen 1: Practice Session */}
      {tab === "practice" && (
        <div className="apple-card p-6 sm:p-8 space-y-6 border-2 border-line/80 shadow-md animate-in fade-in duration-200">
          <div className="flex items-center justify-between text-xs font-bold text-muted border-b border-line/40 pb-3">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-ok animate-pulse" />
              <span>{isAr ? "تمرين 3 من 7" : "Exercise 3 of 7"}</span>
            </span>
            <span className="text-subtitle">★ +10 XP</span>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-muted uppercase font-bold tracking-wider">
              {isAr ? "اختر المعنى الصحيح للكلمة" : "Select the correct translation"}
            </div>
            <div className="text-3xl font-extrabold text-ink tracking-tight flex items-center gap-3">
              <span>Redundancy</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-subtitle/20 text-subtitle border border-subtitle/40">
                noun
              </span>
            </div>
            <p className="text-xs sm:text-sm text-muted italic bg-surface/70 p-3 rounded-xl border border-line/50">
              &quot;...in order to eliminate database <strong>redundancy</strong> across tables.&quot; — Computer Science Series
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="p-3.5 rounded-xl border-2 border-ok bg-ok-soft/30 text-ink font-bold flex items-center justify-between text-sm sm:text-base">
              <span>التكرار / الحشو الزائد</span>
              <span className="text-ok font-extrabold text-lg">✓</span>
            </div>
            <div className="p-3.5 rounded-xl border border-line bg-surface/50 text-muted flex items-center justify-between text-sm sm:text-base">
              <span>الكفاءة والسرعة</span>
            </div>
            <div className="p-3.5 rounded-xl border border-line bg-surface/50 text-muted flex items-center justify-between text-sm sm:text-base">
              <span>التخزين المؤقت</span>
            </div>
            <div className="p-3.5 rounded-xl border border-line bg-surface/50 text-muted flex items-center justify-between text-sm sm:text-base">
              <span>التحليل المنطقي</span>
            </div>
          </div>
        </div>
      )}

      {/* Screen 2: Saved Words Library */}
      {tab === "words" && (
        <div className="apple-card p-6 space-y-4 border-2 border-line/80 shadow-md animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-line/40 pb-3">
            <div className="font-bold text-ink text-base">
              {isAr ? "كلماتك المحفوظة (56)" : "My Words (56 words saved)"}
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-subtitle/15 text-ink">
              {isAr ? "مستعد للمراجعة: 8" : "8 ready to review"}
            </span>
          </div>

          <div className="divide-y divide-line/40">
            <div className="py-3 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-ink">Integrity</span>
                  <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-surface border border-line text-muted">Box 3</span>
                </div>
                <div className="text-xs text-muted font-arabic">نزاهة / أمانة اخلاقية</div>
                <div className="text-[11px] text-muted truncate max-w-sm">From &quot;Suits S01E03&quot;</div>
              </div>
              <span className="text-xs font-semibold text-ok bg-ok-soft/40 px-2 py-1 rounded-lg">Mastered</span>
            </div>

            <div className="py-3 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-ink">Redundancy</span>
                  <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-surface border border-line text-muted">Box 1</span>
                </div>
                <div className="text-xs text-muted font-arabic">التكرار غير الضروري</div>
                <div className="text-[11px] text-muted truncate max-w-sm">From &quot;Stanford CS Lecture&quot;</div>
              </div>
              <span className="text-xs font-semibold text-subtitle bg-subtitle/20 px-2 py-1 rounded-lg">Due today</span>
            </div>

            <div className="py-3 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-ink">Overwhelmed</span>
                  <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-surface border border-line text-muted">Box 2</span>
                </div>
                <div className="text-xs text-muted font-arabic">مثقل بالأعباء / مذهول</div>
                <div className="text-[11px] text-muted truncate max-w-sm">From &quot;Friends S02E14&quot;</div>
              </div>
              <span className="text-xs font-semibold text-muted bg-surface px-2 py-1 rounded-lg">In 2 days</span>
            </div>
          </div>
        </div>
      )}

      {/* Screen 3: Subtitle Tooltip */}
      {tab === "subtitles" && (
        <div className="apple-card p-6 space-y-4 border-2 border-line/80 shadow-md animate-in fade-in duration-200">
          <div className="relative rounded-2xl overflow-hidden bg-black aspect-video max-h-64 flex flex-col justify-end p-6 border border-line">
            <div className="absolute inset-0 bg-linear-to-t from-black via-black/40 to-transparent" />
            
            {/* Mock Floating Tooltip */}
            <div className="relative z-10 mx-auto max-w-sm rounded-xl bg-[#0b0e1b] border border-subtitle/40 p-3 shadow-2xl space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm">Integrity</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-subtitle/20 text-subtitle border border-subtitle/30">noun</span>
                </div>
                <span className="text-[11px] font-bold text-subtitle bg-subtitle/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                  ★ Saved
                </span>
              </div>
              <div className="text-sm font-bold text-white font-arabic">نزاهة</div>
            </div>

            {/* Subtitle text */}
            <div className="relative z-10 text-center pt-3">
              <span className="text-xs sm:text-sm font-semibold bg-black/80 text-white px-3 py-1 rounded-lg">
                &quot;He is a person of unquestionable <span className="bg-subtitle/40 text-subtitle font-bold px-1 rounded">Integrity</span> in every decision.&quot;
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

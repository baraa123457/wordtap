"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthActions } from "@/components/AuthActions";
import { Logo } from "@/components/Logo";
import { SubtitleDemo } from "@/components/SubtitleDemo";
import { RealAppShowcase } from "@/components/RealAppShowcase";
import { ThemeToggle } from "@/components/ThemeToggle";

export function LandingClient() {
  const [lang, setLang] = useState<"en" | "ar">("en");
  const isAr = lang === "ar";

  return (
    <div
      dir={isAr ? "rtl" : "ltr"}
      className={`mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 sm:px-6 transition-all ${
        isAr ? "font-arabic" : ""
      }`}
    >
      <header className="flex items-center justify-between py-5">
        <Logo />
        <div className="flex items-center gap-3">
          {/* Language Switcher */}
          <div className="flex rounded-lg border border-line bg-surface p-0.5 text-xs font-bold">
            <button
              type="button"
              onClick={() => setLang("en")}
              className={`px-2 py-1 rounded transition-colors ${
                !isAr ? "bg-subtitle text-subtitle-ink" : "text-muted hover:text-ink"
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLang("ar")}
              className={`px-2 py-1 rounded transition-colors ${
                isAr ? "bg-subtitle text-subtitle-ink" : "text-muted hover:text-ink"
              }`}
            >
              عربي
            </button>
          </div>
          <ThemeToggle />
          <AuthActions size="nav" />
        </div>
      </header>

      <main className="flex-1 pb-20">
        {/* Hero Section */}
        <section className="grid gap-10 pt-8 sm:pt-14 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div className="grid gap-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-subtitle/15 border border-subtitle/30 text-xs font-bold text-ink w-fit">
              <span className="w-2 h-2 rounded-full bg-subtitle animate-pulse" />
              <span>
                {isAr
                  ? "للناطقين بالعربية: تعلم الإنجليزية من أفلامك ومسلسلاتك المفضلة"
                  : "For Arabic speakers learning English from the shows they watch"}
              </span>
            </div>

            <h1 className="text-4xl font-extrabold leading-[1.15] tracking-tight sm:text-5xl text-ink">
              {isAr
                ? "كلمات من مسلسلاتك المفضلة... تثبت في ذاكرتك للأبد."
                : "Words from the shows you watch that actually stick."}
            </h1>

            <p className="max-w-md text-base sm:text-lg text-muted leading-relaxed">
              {isAr
                ? "انقر على أي كلمة داخل ترجمة يوتيوب ونتفلكس لمعرفة معناها بالعربية. يحفظها WordTap مع جملتها الأصلية ويعيد اختبارك فيها تلقائياً."
                : "Tap any English word in YouTube or Netflix subtitles for an instant Arabic translation. WordTap saves the word and its original subtitle sentence, then tests you until it becomes second nature."}
            </p>

            {/* Language Pairs & Trust Note */}
            <div className="space-y-2">
              <div className="text-xs text-muted flex items-center gap-2">
                <span className="font-semibold text-ink">
                  {isAr ? "اللغات المدعومة حالياً:" : "Supported language pairs:"}
                </span>
                <span className="px-2 py-0.5 rounded bg-surface border border-line text-xs font-bold">
                  {isAr ? "الإنجليزية ← العربية" : "English → Arabic"}
                </span>
                <span className="text-muted text-[11px] font-medium">
                  {isAr ? "(الألمانية والإسبانية متوفرة اختيارياً)" : "(German & Spanish also available)"}
                </span>
              </div>
              <div className="text-xs text-muted font-medium flex items-center gap-1.5">
                <span className="text-ok font-bold">✓</span>
                <span>
                  {isAr
                    ? "مجاني بالكامل الآن. جميع كلماتك ملك لك ويمكنك تصديرها دائماً كملف CSV."
                    : "Free right now. All your saved words remain yours and are 100% exportable anytime."}
                </span>
              </div>
            </div>

            <AuthActions size="hero" />
          </div>

          <SubtitleDemo />
        </section>

        {/* Live App Showcase Section (Real UI Components) */}
        <section className="mt-20 pt-10 border-t border-line/60">
          <RealAppShowcase lang={lang} />
        </section>

        {/* How It Works */}
        <section className="mt-20 grid gap-8">
          <h2 className="text-2xl font-bold text-ink">
            {isAr ? "كيف يعمل WordTap؟" : "How it works"}
          </h2>
          <ol className="grid gap-6 sm:grid-cols-3">
            <li className="apple-card p-6 grid content-start gap-3">
              <span
                aria-hidden
                className="grid h-8 w-8 place-items-center rounded-full bg-subtitle font-bold text-subtitle-ink text-sm"
              >
                1
              </span>
              <h3 className="text-lg font-bold text-ink">
                {isAr ? "ثبت إضافة كروم" : "Add the Chrome extension"}
              </h3>
              <p className="text-xs sm:text-sm text-muted leading-relaxed">
                {isAr
                  ? "سجّل الدخول مرة واحدة من أيقونة الإضافة في المتصفح."
                  : "Sign in once from the extension icon in your browser toolbar."}
              </p>
            </li>

            <li className="apple-card p-6 grid content-start gap-3">
              <span
                aria-hidden
                className="grid h-8 w-8 place-items-center rounded-full bg-subtitle font-bold text-subtitle-ink text-sm"
              >
                2
              </span>
              <h3 className="text-lg font-bold text-ink">
                {isAr ? "انقر على الكلمات أثناء المشاهدة" : "Tap words while you watch"}
              </h3>
              <p className="text-xs sm:text-sm text-muted leading-relaxed">
                {isAr
                  ? "انقر على أي كلمة في ترجمة يوتيوب أو نتفلكس. يظهر معناها بالعربية وتُحفظ مع الجملة في حسابك."
                  : "Click any word in YouTube or Netflix subtitles. The Arabic translation appears and the word is saved with its full sentence."}
              </p>
            </li>

            <li className="apple-card p-6 grid content-start gap-3">
              <span
                aria-hidden
                className="grid h-8 w-8 place-items-center rounded-full bg-subtitle font-bold text-subtitle-ink text-sm"
              >
                3
              </span>
              <h3 className="text-lg font-bold text-ink">
                {isAr ? "راجع وتمرن في الموقع" : "Practice them here"}
              </h3>
              <p className="text-xs sm:text-sm text-muted leading-relaxed">
                {isAr
                  ? "جلسات سريعة من 5-10 أسئلة (اختيار، كتابة، استماع). الكلمات التي تخطئ بها تعود لك أسرع."
                  : "Short 5-10 question sessions (choice, typing, matching, listening). Words you miss return sooner."}
              </p>
            </li>
          </ol>

          <div className="pt-2">
            <Link
              href="/extension"
              className="inline-flex items-center gap-2 btn btn-primary px-5 py-2.5 font-bold shadow-sm"
            >
              <span>{isAr ? "تحميل إضافة كروم مجاناً" : "Get the Chrome Extension"}</span>
              <span>{isAr ? "←" : "→"}</span>
            </Link>
          </div>
        </section>
      </main>

      {/* Brand & Trust Footer */}
      <footer className="border-t border-line/60 py-10 mt-12 text-sm text-muted">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Logo href="/" />
            <span className="text-xs text-muted/80">
              {isAr ? "· حول مشاهداتك إلى طلاقة حقيقية" : "· Turn your favorite shows into real fluency"}
            </span>
          </div>
          <div className="flex items-center gap-6 text-xs font-medium">
            <Link href="/extension" className="hover:text-ink transition-colors">
              {isAr ? "الإضافة" : "Extension"}
            </Link>
            <Link href="/privacy" className="hover:text-ink transition-colors">
              {isAr ? "الخصوصية" : "Privacy Policy"}
            </Link>
            <Link href="/terms" className="hover:text-ink transition-colors">
              {isAr ? "الشروط" : "Terms"}
            </Link>
            <Link href="/login" className="hover:text-ink transition-colors">
              {isAr ? "تسجيل الدخول" : "Sign in"}
            </Link>
            <Link href="/signup" className="hover:text-ink transition-colors">
              {isAr ? "إنشاء حساب" : "Sign up"}
            </Link>
          </div>
        </div>
        <div className="mt-6 pt-6 border-t border-line/30 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted">
          <p>
            {isAr
              ? `© ${new Date().getFullYear()} WordTap. مجاني حالياً، وكلماتك ملك لك دائماً.`
              : `© ${new Date().getFullYear()} WordTap. Free now, and your saved words stay yours and exportable.`}
          </p>
          <p>YouTube &amp; Netflix are registered trademarks of their respective owners.</p>
        </div>
      </footer>
    </div>
  );
}

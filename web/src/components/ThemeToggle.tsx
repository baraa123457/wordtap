"use client";

import { useEffect, useState } from "react";
import { getStoredSettings, saveStoredSettings, type ThemeMode } from "@/lib/settings";
import { MoonIcon, SunIcon } from "./Icons";

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>("system");
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setMounted(true);
    const s = getStoredSettings();
    setTheme(s.theme || "system");
    checkDark(s.theme || "system");

    function onThemeChange() {
      const updated = getStoredSettings();
      setTheme(updated.theme || "system");
      checkDark(updated.theme || "system");
    }

    window.addEventListener("wordtap_theme_changed", onThemeChange);
    window.addEventListener("wordtap_settings_changed", onThemeChange);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onMedia = () => {
      const current = getStoredSettings();
      if (current.theme === "system") checkDark("system");
    };
    media.addEventListener("change", onMedia);

    return () => {
      window.removeEventListener("wordtap_theme_changed", onThemeChange);
      window.removeEventListener("wordtap_settings_changed", onThemeChange);
      media.removeEventListener("change", onMedia);
    };
  }, []);

  function checkDark(t: ThemeMode) {
    if (typeof window === "undefined") return;
    const dark =
      t === "dark" ||
      (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    setIsDark(dark);
  }

  function toggle() {
    const next: ThemeMode = isDark ? "light" : "dark";
    saveStoredSettings({ theme: next });
    setTheme(next);
    setIsDark(!isDark);
  }

  if (!mounted) {
    return (
      <div className="h-10 w-10 rounded-xl" aria-hidden />
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="btn btn-quiet min-h-10 w-10 p-0 text-muted hover:text-ink transition-colors"
      title={isDark ? "Switch to Light mode" : "Switch to Dark mode"}
      aria-label={isDark ? "Switch to Light mode" : "Switch to Dark mode"}
    >
      {isDark ? <SunIcon size={20} /> : <MoonIcon size={20} />}
    </button>
  );
}

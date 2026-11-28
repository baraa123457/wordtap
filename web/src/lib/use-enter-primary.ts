"use client";

import { useEffect, type RefObject } from "react";

/**
 * Triggers the visible enabled primary (yellow `.btn-primary`) action button
 * inside `containerRef` when the user presses Enter outside of form controls.
 */
export function useEnterPrimaryAction(
  containerRef: RefObject<HTMLElement | null>,
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.repeat || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }
      if (e.defaultPrevented) return;

      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          tag === "BUTTON" ||
          tag === "A" ||
          target.isContentEditable
        ) {
          return;
        }
      }

      const root = containerRef.current;
      if (!root) return;

      const candidates = Array.from(
        root.querySelectorAll<HTMLButtonElement>("button.btn-primary:not(:disabled)"),
      ).filter((btn) => btn.offsetParent !== null);

      const primaryBtn = candidates[candidates.length - 1];
      if (primaryBtn) {
        e.preventDefault();
        primaryBtn.click();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [containerRef, enabled]);
}

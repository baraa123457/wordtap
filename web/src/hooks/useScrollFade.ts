"use client";

import { useEffect, useRef, useCallback } from "react";

export interface UseScrollFadeOptions {
  activeDependency?: unknown;
  activeSelector?: string;
  isFirstItem?: boolean;
}

export function useScrollFade<T extends HTMLElement = HTMLElement>(
  options?: UseScrollFadeOptions
) {
  const containerRef = useRef<T | null>(null);
  const isFirstRender = useRef(true);

  const updateFade = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    // Check if container overflows horizontally
    const overflows = el.scrollWidth > el.clientWidth + 1;
    if (!overflows) {
      el.removeAttribute("data-fade-start");
      el.removeAttribute("data-fade-end");
      return;
    }

    const isRtl = getComputedStyle(el).direction === "rtl";
    const scrollLeft = el.scrollLeft;
    const clientWidth = el.clientWidth;
    const scrollWidth = el.scrollWidth;
    const maxScroll = scrollWidth - clientWidth;

    let hasHiddenStart = false;
    let hasHiddenEnd = false;

    if (!isRtl) {
      hasHiddenStart = scrollLeft > 2;
      hasHiddenEnd = scrollLeft + clientWidth < scrollWidth - 2;
    } else {
      // In RTL modern browsers (Chromium/WebKit/Gecko), scrollLeft is 0 at start (visual right),
      // and negative values down to -maxScroll at end (visual left).
      if (scrollLeft <= 0) {
        const absScroll = Math.abs(scrollLeft);
        hasHiddenStart = absScroll > 2;
        hasHiddenEnd = absScroll < maxScroll - 2;
      } else {
        // Fallback for browsers where RTL scrollLeft starts at maxScroll and decreases to 0:
        hasHiddenStart = scrollLeft < maxScroll - 2;
        hasHiddenEnd = scrollLeft > 2;
      }
    }

    if (hasHiddenStart) {
      el.setAttribute("data-fade-start", "true");
    } else {
      el.removeAttribute("data-fade-start");
    }

    if (hasHiddenEnd) {
      el.setAttribute("data-fade-end", "true");
    } else {
      el.removeAttribute("data-fade-end");
    }
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    updateFade();

    const handleScroll = () => {
      updateFade();
    };
    el.addEventListener("scroll", handleScroll, { passive: true });

    const ro = new ResizeObserver(() => {
      updateFade();
    });
    ro.observe(el);

    return () => {
      el.removeEventListener("scroll", handleScroll);
      ro.disconnect();
    };
  }, [updateFade]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const selector =
      options?.activeSelector ??
      '[aria-checked="true"], [data-active="true"], [aria-current="page"]';
    const activeEl = el.querySelector<HTMLElement>(selector);

    if (activeEl) {
      const isFirst =
        options?.isFirstItem ??
        (activeEl === el.firstElementChild ||
          activeEl.parentElement?.firstElementChild === activeEl ||
          activeEl.dataset.isFirst === "true");

      if (isFirst) {
        el.scrollLeft = 0;
      } else {
        activeEl.scrollIntoView({
          inline: "nearest",
          block: "nearest",
          behavior: isFirstRender.current ? "auto" : "smooth",
        });
      }
    }

    isFirstRender.current = false;
    updateFade();
  }, [options?.activeDependency, options?.activeSelector, options?.isFirstItem, updateFade]);

  return { containerRef, updateFade };
}

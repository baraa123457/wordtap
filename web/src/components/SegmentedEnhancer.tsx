"use client";

import { useEffect } from "react";

/**
 * One global helper for every `.apple-segmented-container` (nav tabs, deck tabs,
 * filter pills...). It does two things, with no per-page code:
 *  1. Shows an edge fade only on the side that has hidden tabs.
 *  2. Keeps the active tab fully visible (scrolls the group, never the page).
 */
const SELECTOR = ".apple-segmented-container";
const ACTIVE =
  '[data-active="true"],[aria-checked="true"],[aria-selected="true"],[aria-current="page"]';
const PAD = 32;

export function SegmentedEnhancer() {
  useEffect(() => {
    const lastActive = new WeakMap<Element, Element | null>();
    const seen = new WeakSet<Element>();
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) refresh(e.target as HTMLElement);
    });
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function fades(el: HTMLElement) {
      const max = el.scrollWidth - el.clientWidth;
      const rtl = getComputedStyle(el).direction === "rtl";
      const pos = Math.abs(el.scrollLeft);
      const hiddenStart = max > 1 && pos > 1;
      const hiddenEnd = max > 1 && max - pos > 1;
      el.dataset.fadeLeft = String(rtl ? hiddenEnd : hiddenStart);
      el.dataset.fadeRight = String(rtl ? hiddenStart : hiddenEnd);
    }

    function reveal(el: HTMLElement, instant: boolean) {
      const active = el.querySelector<HTMLElement>(ACTIVE);
      if (!active) return;
      const c = el.getBoundingClientRect();
      const a = active.getBoundingClientRect();
      let delta = 0;
      if (a.left < c.left + PAD) delta = a.left - (c.left + PAD);
      else if (a.right > c.right - PAD) delta = a.right - (c.right - PAD);
      if (delta) el.scrollTo({ left: el.scrollLeft + delta, behavior: instant || reduce ? "auto" : "smooth" });
    }

    function refresh(el: HTMLElement) {
      const active = el.querySelector(ACTIVE);
      const first = !seen.has(el);
      if (first || lastActive.get(el) !== active) {
        seen.add(el);
        lastActive.set(el, active);
        reveal(el, first);
      }
      fades(el);
    }

    const all = () => document.querySelectorAll<HTMLElement>(SELECTOR);
    const scan = () => {
      all().forEach((el) => {
        if (!el.dataset.segObserved) {
          el.dataset.segObserved = "1";
          ro.observe(el);
        }
        refresh(el);
      });
    };

    let raf = 0;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(scan);
    };
    const onScroll = (e: Event) => {
      const t = e.target;
      if (t instanceof HTMLElement && t.matches(SELECTOR)) fades(t);
    };

    scan();
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-active", "aria-checked", "aria-selected", "aria-current"],
    });
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(raf);
      mo.disconnect();
      ro.disconnect();
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return null;
}

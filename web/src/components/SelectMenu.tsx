"use client";

import { useEffect, useRef, useState } from "react";

export type SelectMenuOption = {
  value: string;
  label: string;
};

/**
 * Custom WordTap-styled dropdown replacing native OS <select> menus
 * so open option lists match the card surface, border, and gold selection highlight.
 */
export function SelectMenu({
  ariaLabel,
  value,
  options,
  onChange,
  className = "w-full sm:w-48",
}: {
  ariaLabel: string;
  value: string;
  options: SelectMenuOption[];
  onChange: (value: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const selectedOption = options.find((o) => o.value === value) ?? options[0];

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={`flex w-full min-h-11 items-center justify-between gap-2 rounded-xl border bg-surface px-3.5 py-2 text-start text-sm font-semibold text-ink shadow-2xs transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-subtitle ${
          open ? "border-subtitle ring-2 ring-subtitle/30" : "border-line hover:border-muted"
        }`}
      >
        <span className="truncate">{selectedOption?.label ?? ""}</span>
        <svg
          className={`h-4 w-4 shrink-0 text-muted transition-transform duration-150 ${
            open ? "rotate-180 text-ink" : ""
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className="absolute right-0 top-full z-50 mt-1.5 max-h-64 w-full min-w-[12rem] overflow-y-auto rounded-2xl border border-line bg-surface p-1.5 shadow-2xl"
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-start text-sm font-semibold transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-subtitle text-subtitle-ink"
                    : "text-ink/85 hover:bg-black/5 dark:hover:bg-white/10 hover:text-ink"
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected ? <span className="font-bold shrink-0">✓</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

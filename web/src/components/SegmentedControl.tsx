"use client";

import React, { useRef, useId } from "react";
import { useScrollFade } from "@/hooks/useScrollFade";

export interface SegmentedOption {
  value: string;
  label: React.ReactNode;
  count?: number;
  disabled?: boolean;
}

export interface SegmentedControlProps {
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
  fill?: boolean;
  className?: string;
}

export function SegmentedControl({
  options,
  value,
  onChange,
  ariaLabel,
  fill = false,
  className = "",
}: SegmentedControlProps) {
  const isFirst = options.length > 0 && options[0].value === value;
  const { containerRef } = useScrollFade<HTMLDivElement>({
    activeDependency: value,
    isFirstItem: isFirst,
  });

  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (options.length === 0) return;

    const isRtl =
      typeof document !== "undefined" &&
      (document.documentElement.dir === "rtl" ||
        containerRef.current?.closest('[dir="rtl"]') !== null);

    let nextIndex = -1;

    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        nextIndex = isRtl
          ? (index - 1 + options.length) % options.length
          : (index + 1) % options.length;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        nextIndex = isRtl
          ? (index + 1) % options.length
          : (index - 1 + options.length) % options.length;
        break;
      case "Home":
        e.preventDefault();
        nextIndex = 0;
        break;
      case "End":
        e.preventDefault();
        nextIndex = options.length - 1;
        break;
      default:
        return;
    }

    if (nextIndex >= 0 && nextIndex < options.length) {
      const nextOption = options[nextIndex];
      if (!nextOption.disabled) {
        onChange(nextOption.value);
        itemRefs.current[nextIndex]?.focus();
      }
    }
  };

  // Base layout styles
  const containerClasses = fill
    ? `grid grid-flow-col auto-cols-fr w-full gap-1 p-1 rounded-full border border-line bg-black/[0.04] dark:bg-white/[0.06] ${className}`
    : `inline-flex w-fit max-w-full overflow-x-auto gap-1 p-1 rounded-full border border-line bg-black/[0.04] dark:bg-white/[0.06] no-scrollbar ${className}`;

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      aria-label={ariaLabel}
      className={containerClasses}
      style={{ scrollPaddingInline: "2rem" }}
    >
      {options.map((option, index) => {
        const isSelected = option.value === value;
        const itemClasses = fill
          ? `min-w-0 truncate px-3.5 min-h-11 text-[length:var(--text-control)] font-semibold rounded-full flex items-center justify-center transition-all cursor-pointer select-none ${
              isSelected
                ? "bg-surface text-ink shadow-sm border border-line"
                : "text-muted hover:text-ink hover:bg-black/5 dark:hover:bg-white/5 border border-transparent"
            }`
          : `flex-none whitespace-nowrap px-3.5 min-h-11 text-[length:var(--text-control)] font-semibold rounded-full flex items-center justify-center transition-all cursor-pointer select-none ${
              isSelected
                ? "bg-surface text-ink shadow-sm border border-line"
                : "text-muted hover:text-ink hover:bg-black/5 dark:hover:bg-white/5 border border-transparent"
            }`;

        return (
          <button
            key={option.value}
            id={`${id}-opt-${option.value}`}
            ref={(el) => {
              itemRefs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={isSelected ? 0 : -1}
            disabled={option.disabled}
            data-is-first={index === 0 ? "true" : undefined}
            data-active={isSelected ? "true" : undefined}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={itemClasses}
          >
            <span className={fill ? "min-w-0 truncate inline-flex items-center justify-center gap-1.5" : "inline-flex items-center gap-1.5"}>
              {option.label}
              {option.count !== undefined ? (
                <span className="opacity-75 font-normal text-[length:var(--text-label)]">
                  ({option.count})
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

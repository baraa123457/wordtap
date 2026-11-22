import Link from "next/link";

/** A caption bar with a tapped word underlined: the whole product in one mark. */
export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5 font-semibold tracking-tight">
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden className="shrink-0">
        <circle cx="16" cy="16" r="14.5" fill="#12172A" />
        <rect x="6.8" y="12.4" width="18.4" height="3.1" rx="1.55" fill="#FFFFFF" />
        <rect x="9.7" y="17.5" width="12.6" height="3.1" rx="1.55" fill="#E8AE08" />
      </svg>
      <span className="text-lg">WordTap</span>
    </Link>
  );
}

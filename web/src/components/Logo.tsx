import Link from "next/link";

/** A caption bar with a tapped word underlined: the whole product in one mark. */
export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 font-semibold tracking-tight">
      <svg width="30" height="22" viewBox="0 0 30 22" aria-hidden>
        <rect x="0.5" y="0.5" width="29" height="21" rx="5" fill="#151833" stroke="#262a52" />
        <rect x="6" y="8" width="18" height="3" rx="1.5" fill="#fff" />
        <rect x="9" y="14" width="12" height="2.5" rx="1.25" fill="#facc3b" />
      </svg>
      <span className="text-lg">WordTap</span>
    </Link>
  );
}

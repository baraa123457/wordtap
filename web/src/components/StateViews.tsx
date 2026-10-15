import type { ReactNode } from "react";

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="grid place-items-center gap-3 py-20 text-muted">
      <span
        aria-hidden
        className="h-8 w-8 animate-spin rounded-full border-4 border-line border-t-subtitle"
      />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="mx-auto grid max-w-md gap-4 rounded-2xl border-2 border-bad bg-bad-soft p-6">
      <div>
        <h2 className="text-lg font-semibold text-bad">Something went wrong</h2>
        <p className="mt-1 break-words text-ink">{message}</p>
      </div>
      {onRetry ? (
        <button type="button" className="btn w-fit" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mx-auto grid max-w-md gap-4 py-12 text-center">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children ? <div className="text-muted">{children}</div> : null}
      {action ? <div className="flex justify-center">{action}</div> : null}
    </div>
  );
}

import { ReactNode, useEffect } from "react";

/** Full-viewport centered loading screen (initial auth/callback checks). */
export function FullLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="full-screen-state">
      <div className="spinner" aria-hidden />
      <span style={{ color: "var(--muted)" }}>{label}</span>
    </div>
  );
}

/** Inside-content loading placeholder. */
export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="state">
      <div className="spinner" aria-hidden />
      <span className="state-hint">{label}</span>
    </div>
  );
}

export function EmptyState({
  icon = "📭",
  title,
  hint,
}: {
  icon?: string;
  title: string;
  hint?: string;
}) {
  return (
    <div className="state">
      <div style={{ fontSize: 30 }} aria-hidden>
        {icon}
      </div>
      <div className="state-title">{title}</div>
      {hint && <div className="state-hint">{hint}</div>}
    </div>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="error-banner" role="alert">
      <span aria-hidden>⚠️</span>
      <span style={{ flex: 1 }}>{message}</span>
      {onRetry && (
        <button className="btn btn-ghost" style={{ padding: "4px 10px" }} onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function Modal({
  open,
  title,
  subtitle,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  // Close on Escape; backdrop clicks close via the backdrop onClick.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <h3>{title}</h3>
        {subtitle && <div className="modal-sub">{subtitle}</div>}
        {children}
      </div>
    </div>
  );
}

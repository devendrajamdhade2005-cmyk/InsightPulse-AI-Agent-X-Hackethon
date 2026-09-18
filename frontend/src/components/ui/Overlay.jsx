import { useEffect, useRef } from "react";
import { cx } from "../../lib/accents.js";
import { IconButton } from "./Primitives.jsx";

/* Overlay surfaces: the evidence drawer, the system panel, and the report modal.
 *
 * Behaviour preserved from the original implementation:
 *   · Escape closes the topmost overlay
 *   · body scroll is locked while one is open
 *   · focus moves into the overlay on open and returns to the trigger on close
 *
 * The scroll lock is reference-counted. Two overlays can legitimately be mounted
 * at once (a drawer opened from behind the preview), and a naive
 * add/remove-class pair would let the first one to close unlock the page while
 * the second is still open.
 */

let lockCount = 0;

function lockScroll() {
  lockCount += 1;
  document.body.classList.add("nb-locked");
}

function unlockScroll() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) document.body.classList.remove("nb-locked");
}

function useOverlayBehaviour(open, onClose) {
  const panelRef = useRef(null);
  const restoreRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    restoreRef.current = document.activeElement;
    lockScroll();

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    // Focus the close button so Escape and Tab both behave predictably.
    const focusTarget = panelRef.current?.querySelector(
      "[data-overlay-initial-focus]",
    );
    focusTarget?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      unlockScroll();
      const prev = restoreRef.current;
      if (prev && typeof prev.focus === "function" && prev.isConnected) {
        prev.focus();
      }
    };
  }, [open, onClose]);

  return panelRef;
}

const CloseIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    aria-hidden="true"
    className="h-4 w-4"
  >
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

/* ── right-hand drawer ─────────────────────────────────────────── */

export function Drawer({ open, onClose, title, children, label }) {
  const panelRef = useOverlayBehaviour(open, onClose);
  if (!open) return null;

  return (
    <>
      <div
        className="nb-anim-fade fixed inset-0 z-50 bg-black/55"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label || title}
        className={cx(
          "nb-anim-slide-in fixed inset-y-0 right-0 z-60 flex w-[min(34rem,100vw)] flex-col",
          "border-l-4 border-line bg-bg",
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b-4 border-line bg-surface px-4 py-3">
          <h2 className="text-base font-bold uppercase tracking-tight">{title}</h2>
          <IconButton
            label="Close"
            onClick={onClose}
            data-overlay-initial-focus
          >
            <CloseIcon />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </aside>
    </>
  );
}

/* ── full-screen modal (report preview) ────────────────────────── */

export function FullScreenModal({
  open,
  onClose,
  title,
  meta,
  actions,
  children,
  label,
}) {
  const panelRef = useOverlayBehaviour(open, onClose);
  if (!open) return null;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label={label || title}
      className="nb-anim-fade fixed inset-0 z-70 flex flex-col bg-bg"
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b-4 border-line bg-surface px-3 py-2.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            data-overlay-initial-focus
            className="nb-press border-2 border-line bg-surface px-3 py-1.5 text-[12px] font-bold uppercase tracking-wide shadow-[var(--shadow-nb-xs)]"
          >
            Back
          </button>
          <span className="hidden text-sm font-bold uppercase tracking-tight sm:inline">
            {title}
          </span>
          {meta ? (
            <span className="hidden truncate font-mono text-[11px] text-ink-3 md:inline">
              {meta}
            </span>
          ) : null}
        </div>
        <div className="flex flex-1 flex-wrap items-center justify-end gap-2 sm:flex-none">
          {actions}
        </div>
      </div>
      <div className="relative min-h-0 flex-1 overflow-auto bg-bg-2">
        {children}
      </div>
    </div>
  );
}

import { cx } from "../../lib/accents.js";

/* Loading states.
 *
 * The previous build used a rotating bordered square, which read as a glitch
 * rather than progress. These are proper circular indicators:
 *
 *   Spinner       indeterminate ring, SVG arc with a breathing gap
 *   ProgressRing  determinate ring for a known 0–1 value
 *   Dots          three-phase pulse for inline "working" text
 *   Bar           indeterminate sweep for stream progress
 *   Skeleton      shimmer placeholder matching the eventual layout
 *
 * Every one carries a role and an accessible label, because a spinner with no
 * announced state is invisible to a screen reader.
 */

const SIZES = { xs: 14, sm: 18, md: 24, lg: 36, xl: 52 };

/** Indeterminate ring. Two arcs: a faint track and an animated sweep. */
export function Spinner({ size = "md", className, label = "Loading" }) {
  const px = SIZES[size] || SIZES.md;
  const stroke = px <= 18 ? 2 : px <= 24 ? 2.5 : 3.5;
  const r = (px - stroke) / 2;

  return (
    <span
      role="status"
      aria-label={label}
      className={cx("inline-grid shrink-0 place-items-center", className)}
      style={{ width: px, height: px }}
    >
      <svg
        viewBox={`0 0 ${px} ${px}`}
        width={px}
        height={px}
        className="nb-anim-spin"
        style={{ animationDuration: "1.1s" }}
      >
        <circle
          cx={px / 2}
          cy={px / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          opacity="0.16"
        />
        <circle
          cx={px / 2}
          cy={px / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          style={{
            animation: "ring-dash 1.5s ease-in-out infinite",
            transformOrigin: "center",
          }}
        />
      </svg>
    </span>
  );
}

/** Determinate ring for a known fraction. `value` is 0–1. */
export function ProgressRing({
  value = 0,
  size = 56,
  stroke = 5,
  className,
  children,
  label,
}) {
  const clamped = Math.max(0, Math.min(1, Number(value) || 0));
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <span
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      aria-label={label || "Progress"}
      className={cx("relative inline-grid shrink-0 place-items-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          opacity="0.14"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          style={{ transition: "stroke-dashoffset 0.4s cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      {children ? (
        <span className="absolute inset-0 grid place-items-center font-mono text-[11px] font-bold tabular-nums">
          {children}
        </span>
      ) : null}
    </span>
  );
}

/** Three pulsing dots for inline "working" copy. */
export function Dots({ className, label = "Working" }) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cx("inline-flex items-center gap-1", className)}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-current"
          style={{
            animation: "nb-blink 1.2s ease-in-out infinite",
            animationDelay: `${i * 0.16}s`,
          }}
        />
      ))}
    </span>
  );
}

/** Indeterminate sweep. Use while streaming, where no total is known. */
export function Bar({ className, label = "Loading" }) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cx(
        "relative block h-1 w-full overflow-hidden rounded-full bg-current/15",
        className,
      )}
    >
      <span
        className="absolute inset-y-0 w-1/3 rounded-full bg-current"
        style={{ animation: "sweep 1.4s cubic-bezier(0.4,0,0.6,1) infinite" }}
      />
    </span>
  );
}

/** Shimmer block. Give it the shape of whatever it stands in for. */
export function Skeleton({ className, rounded = true }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "nb-skeleton block",
        rounded && "rounded-md",
        className,
      )}
    />
  );
}

/** Feed-row shaped placeholder. */
export function SkeletonRows({ count = 3 }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="nb-frame-flat flex gap-4 p-4">
          <Skeleton className="h-9 w-9 shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-[70%]" />
            <Skeleton className="h-3 w-[40%]" />
            <Skeleton className="h-3 w-[90%]" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Centred block for a whole panel or route that is still loading. */
export function LoadingPanel({ label = "Loading", sub, className }) {
  return (
    <div
      className={cx(
        "flex flex-col items-center justify-center gap-3 px-6 py-14 text-center",
        className,
      )}
    >
      <Spinner size="lg" className="text-brand-blue" label={label} />
      <div>
        <p className="text-[13.5px] font-bold uppercase tracking-wide">{label}</p>
        {sub ? <p className="mt-1 text-[12.5px] text-ink-3">{sub}</p> : null}
      </div>
    </div>
  );
}

/** Full-viewport gate, used while the session is being checked. */
export function FullPageLoader({ label = "Loading", sub }) {
  return (
    <div className="grid min-h-screen place-items-center bg-bg">
      <LoadingPanel label={label} sub={sub} />
    </div>
  );
}

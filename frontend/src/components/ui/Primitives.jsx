import { accentClass, cx, toneClass } from "../../lib/accents.js";
import { ChevronRight } from "../icons/index.jsx";

/* ═══════════════════════════════════════════════════════════════════
   Neo-brutalist primitives.

   Every surface here shares one visual grammar: a 2px hard outline, a
   zero-blur offset shadow, square corners, and uppercase structural
   labels. Accent colour is delivered through the `--a` / `--a-bg`
   variables set by `nb-accent-*`, so a component never needs to know
   which accent it received — including accents that came from the API.
   ═══════════════════════════════════════════════════════════════════ */

/* ── surfaces ──────────────────────────────────────────────────── */

export function Panel({ as: Tag = "section", className, accent, children, ...rest }) {
  return (
    <Tag
      className={cx(
        "nb-frame p-4 sm:p-5",
        accent && accentClass(accent),
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** Flat card for nesting inside a Panel — no shadow, so panels don't stack depth. */
export function Card({ as: Tag = "div", className, accent, children, ...rest }) {
  return (
    <Tag
      className={cx(
        "nb-frame-flat p-3 sm:p-4",
        accent && accentClass(accent),
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function PanelHead({ eyebrow, title, sub, actions, className }) {
  return (
    <div
      className={cx(
        "mb-4 flex flex-wrap items-start justify-between gap-3",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? <span className="nb-eyebrow mb-2">{eyebrow}</span> : null}
        {title ? (
          <h2 className="text-lg font-bold uppercase tracking-tight sm:text-xl">
            {title}
          </h2>
        ) : null}
        {sub ? (
          <p className="mt-1 max-w-3xl text-[13px] text-ink-3">{sub}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

/** Section header for a view, with a thick accent bar on the left. */
export function ViewHead({ icon, title, sub, accent = "blue" }) {
  return (
    <header
      className={cx(
        "mb-5 border-l-[6px] pl-4",
        accentClass(accent),
        "nb-a-border",
      )}
    >
      <h2 className="flex items-center gap-2 text-xl font-bold uppercase tracking-tight sm:text-2xl">
        {icon ? (
          <span aria-hidden="true" className="text-2xl">
            {icon}
          </span>
        ) : null}
        {title}
      </h2>
      {sub ? <p className="mt-1 text-[13px] text-ink-3">{sub}</p> : null}
    </header>
  );
}

export function SectionTitle({ children, className }) {
  return (
    <h3
      className={cx(
        "mb-3 inline-block border-2 border-line bg-bg-2 px-2 py-1 text-[11px] font-bold uppercase tracking-[0.12em]",
        className,
      )}
    >
      {children}
    </h3>
  );
}

/* ── buttons ───────────────────────────────────────────────────── */

const BTN_BASE =
  "nb-press inline-flex items-center justify-center gap-2 border-2 border-line font-bold uppercase tracking-wide " +
  "disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none";

const BTN_SIZES = {
  lg: "px-5 py-3 text-sm",
  md: "px-4 py-2.5 text-[13px]",
  sm: "px-3 py-1.5 text-[12px]",
  xs: "px-2 py-1 text-[11px]",
};

const BTN_VARIANTS = {
  primary: "bg-brand-blue text-white shadow-[var(--shadow-nb-sm)]",
  pop: "bg-pop-yellow text-black shadow-[var(--shadow-nb-sm)]",
  danger: "bg-brand-red text-white shadow-[var(--shadow-nb-sm)]",
  ghost:
    "bg-surface text-ink shadow-[var(--shadow-nb-xs)] hover:bg-bg-2",
  subtle: "border-line-soft bg-transparent text-ink-2 shadow-none hover:bg-bg-2",
};

export function Button({
  variant = "primary",
  size = "md",
  as,
  className,
  children,
  ...rest
}) {
  const Tag = as || "button";
  const typeProp = Tag === "button" ? { type: rest.type || "button" } : {};
  return (
    <Tag
      className={cx(BTN_BASE, BTN_SIZES[size], BTN_VARIANTS[variant], className)}
      {...typeProp}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function IconButton({ label, className, children, ...rest }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        "nb-press grid h-9 w-9 shrink-0 place-items-center border-2 border-line bg-surface shadow-[var(--shadow-nb-xs)]",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Text-only affordance for secondary toggles. */
export function LinkButton({ className, children, ...rest }) {
  return (
    <button
      type="button"
      className={cx(
        "border-b-2 border-brand-blue text-[13px] font-bold uppercase tracking-wide text-brand-blue hover:bg-brand-blue-bg",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ── labels, badges, tags ──────────────────────────────────────── */

/** Loud status chip. Used for priority and coverage — always paired with text. */
export function Badge({ tone = "slate", children, className, title }) {
  return (
    <span
      title={title}
      className={cx(
        toneClass(tone),
        "nb-a-bg inline-flex items-center gap-1.5 border-2 border-line px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] whitespace-nowrap",
        className,
      )}
    >
      <span className="nb-a-fg">{children}</span>
    </span>
  );
}

/** Quieter than Badge — for categories, providers and free-form terms. */
export function Tag({ accent, children, className, title }) {
  return (
    <span
      title={title}
      className={cx(
        accent ? accentClass(accent) : "nb-accent-slate",
        "nb-a-bg inline-flex items-center gap-1 border-2 border-line px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function TagRow({ children, className }) {
  return (
    <div className={cx("flex flex-wrap items-center gap-1.5", className)}>
      {children}
    </div>
  );
}

/** Toggleable filter chip. */
export function Pill({ active, children, className, ...rest }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cx(
        "nb-press shrink-0 border-2 border-line px-3 py-1.5 text-[12px] font-bold uppercase tracking-wide whitespace-nowrap",
        active
          ? "bg-brand-blue text-white shadow-[var(--shadow-nb-xs)]"
          : "bg-surface text-ink-2 hover:bg-bg-2",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Small uppercase caption above a value. */
export function MiniLabel({ children, className }) {
  return (
    <span className={cx("nb-label mb-1 block", className)}>{children}</span>
  );
}

/**
 * Number over caption, used on feed rows.
 *
 * The caption is allowed to wrap rather than being forced onto one line — several
 * labels are longer than the value above them, and `whitespace-nowrap` here was
 * what pushed text past the card edge.
 */
export function MetricPill({ label, value, align = "end" }) {
  return (
    <span
      className={cx(
        "flex min-w-0 flex-col leading-tight",
        align === "end" ? "items-start sm:items-end" : "items-start",
      )}
    >
      <b className="font-mono text-[13px] font-bold tabular-nums">{value}</b>
      <span
        className={cx(
          "nb-label max-w-full text-[9px] leading-tight",
          align === "end" && "sm:text-right",
        )}
      >
        {label}
      </span>
    </span>
  );
}

/** Key/value row with a hairline rule — the workhorse of every report card. */
export function DataLine({ label, value, valueClass }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line-soft py-1 text-[12px] last:border-b-0">
      <span className="text-ink-3">{label}</span>
      <b className={cx("text-right font-semibold text-ink", valueClass)}>
        {value}
      </b>
    </div>
  );
}

/* ── feedback ──────────────────────────────────────────────────── */

/**
 * Limited-data / nothing-here state.
 *
 * `icon` is a component, not a glyph, so the mark inherits stroke weight and colour
 * from the surrounding theme instead of rendering as an OS-specific emoji.
 */
export function EmptyState({ icon: Icon, title, body, action }) {
  return (
    <div className="nb-frame-flat nb-hatch px-6 py-10 text-center">
      <div className="mx-auto max-w-lg border-2 border-line bg-surface px-5 py-7">
        {Icon ? (
          <span
            aria-hidden="true"
            className="mx-auto mb-4 grid h-12 w-12 place-items-center border-2 border-line bg-bg-2"
          >
            <Icon className="h-5 w-5 text-ink-3" strokeWidth={2.2} />
          </span>
        ) : null}
        <h3 className="mb-2 text-base font-bold uppercase tracking-tight">{title}</h3>
        {body ? <p className="text-[13px] leading-relaxed text-ink-3">{body}</p> : null}
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </div>
  );
}

/** Inline note used where a metric could not be derived. */
export function Note({ tone, children, className }) {
  return (
    <p
      className={cx(
        "mt-2 text-[11.5px] leading-relaxed",
        tone === "bad" ? "font-semibold text-brand-red" : "text-ink-3",
        className,
      )}
    >
      {children}
    </p>
  );
}

/* Loading indicators live in ./Loading.jsx and are re-exported here so the many
   existing import sites keep working. The originals were a rotating bordered
   square, which read as a rendering glitch rather than progress. */
export {
  Bar,
  Dots,
  FullPageLoader,
  LoadingPanel,
  ProgressRing,
  Skeleton,
  SkeletonRows,
  Spinner,
} from "./Loading.jsx";

/** Horizontal bar. Fill width is inline because it is data, not styling. */
export function Meter({ value, max, tone = "blue", className }) {
  const pctv = max ? Math.round((value / max) * 100) : 0;
  return (
    <span
      role="img"
      aria-label={`${value} of ${max}`}
      className={cx(
        toneClass(tone),
        "block h-2.5 w-full border-2 border-line bg-bg-2",
        className,
      )}
    >
      <span
        className="nb-a-solid block h-full"
        style={{ width: `${Math.max(3, pctv)}%` }}
      />
    </span>
  );
}

/* ── tables ────────────────────────────────────────────────────── */

/** Scroll container that keeps the brutalist frame around wide tables. */
export function TableWrap({ children, className }) {
  return (
    <div className={cx("nb-frame-flat overflow-x-auto", className)}>
      {children}
    </div>
  );
}

export function Table({ children, className }) {
  return (
    <table className={cx("w-full border-collapse text-[12px]", className)}>
      {children}
    </table>
  );
}

export function Th({ children, className, ...rest }) {
  return (
    <th
      className={cx(
        "border-b-2 border-line bg-bg-2 px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.06em] whitespace-nowrap",
        className,
      )}
      {...rest}
    >
      {children}
    </th>
  );
}

export function Td({ children, className, ...rest }) {
  return (
    <td
      className={cx(
        "border-b border-line-soft px-3 py-2 align-top",
        className,
      )}
      {...rest}
    >
      {children}
    </td>
  );
}

/* ── form fields ───────────────────────────────────────────────── */

const FIELD_BASE =
  "w-full border-2 border-line bg-surface px-3 py-2 text-[14px] text-ink " +
  "shadow-[var(--shadow-nb-xs)] outline-none transition-shadow " +
  "focus:shadow-[var(--shadow-nb)] disabled:opacity-60";

export function TextInput({ className, ...rest }) {
  return <input className={cx(FIELD_BASE, className)} {...rest} />;
}

export function Textarea({ className, ...rest }) {
  return (
    <textarea
      className={cx(FIELD_BASE, "resize-y leading-relaxed", className)}
      {...rest}
    />
  );
}

export function Select({ className, children, ...rest }) {
  return (
    <select
      className={cx(FIELD_BASE, "cursor-pointer appearance-none pr-8", className)}
      {...rest}
    >
      {children}
    </select>
  );
}

/** Labelled field wrapper used by the Framework / Evaluation / Observability controls. */
export function Field({ label, hint, className, children }) {
  return (
    <label className={cx("flex min-w-0 flex-col gap-1.5", className)}>
      <span className="nb-label">{label}</span>
      {children}
      {hint ? <span className="text-[11px] text-ink-4">{hint}</span> : null}
    </label>
  );
}

/* ── disclosure ────────────────────────────────────────────────── */

/**
 * Native <details> keeps keyboard and screen-reader behaviour for free, so this
 * is a styling wrapper rather than a re-implementation.
 */
export function Reveal({ summary, children, className, open, bare = false }) {
  return (
    <details
      open={open}
      className={cx(!bare && "nb-frame-flat", className)}
    >
      <summary
        className={cx(
          "group flex cursor-pointer list-none items-center gap-2 text-[13px] font-bold uppercase tracking-wide marker:hidden",
          bare ? "text-ink-2 hover:text-brand-blue" : "bg-bg-2 px-3 py-2",
        )}
      >
        <ChevronRight
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-brand-blue transition-transform group-open:rotate-90"
          strokeWidth={2.8}
        />
        {summary}
      </summary>
      <div className={cx(bare ? "mt-3" : "border-t-2 border-line p-3 sm:p-4")}>
        {children}
      </div>
    </details>
  );
}

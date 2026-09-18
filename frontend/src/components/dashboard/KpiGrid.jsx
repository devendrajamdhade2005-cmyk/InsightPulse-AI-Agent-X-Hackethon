import { accentClass, cx } from "../../lib/accents.js";
import { pct } from "../../lib/format.js";
import { useCountUp } from "../../hooks/useCountUp.js";
import {
  BookOpen,
  Brain,
  Building2,
  CircleDot,
  Info,
  Minus,
  TrendingDown,
  TrendingUp,
  Zap,
} from "../icons/index.jsx";

/* derive.js emits a stable `iconKey` per KPI; the vector is resolved here so the
   analytics layer stays free of presentation concerns. */
const KPI_ICONS = {
  findings: BookOpen,
  topics: Zap,
  relevance: Brain,
  competitive: Building2,
};

/* KPI cards.
 *
 * Deltas compare against the previous scan in this session. When there is no
 * previous scan the original showed an em dash rather than a fabricated 0%, and
 * that honesty is preserved — the tooltip says why.
 */

/* What each KPI actually measures. A bare number with a short label invites the
   wrong reading — "Avg AI Relevance" in particular is a mean over every finding,
   not a score for the scan, and the delta is only ever session-relative. */
const KPI_HELP = {
  findings: "Total items collected across every source this scan touched. The sub-line counts how many cleared the relevance bar.",
  topics: "Recurring themes derived from this scan — detected strategic signals plus phrases repeating across finding titles.",
  relevance: "Mean relevance across all findings in this scan, not a quality score for the scan itself.",
  competitive: "Findings tied to a tracked company or carrying a strategic signal such as a launch, funding round or acquisition.",
};

function Kpi({ item }) {
  const value = useCountUp(item.value);
  const Icon = KPI_ICONS[item.iconKey] || CircleDot;
  const DeltaIcon = item.delta >= 0 ? TrendingUp : TrendingDown;

  const deltaHelp =
    item.delta === null
      ? "No previous scan in this session, so there is nothing to compare against."
      : `${item.delta >= 0 ? "Up" : "Down"} ${Math.abs(item.delta).toFixed(1)}% versus the previous scan in this session.`;

  return (
    <article
      title={`${item.label} — ${KPI_HELP[item.iconKey] || ""} ${deltaHelp}`}
      className={cx(
        accentClass(item.accent),
        "nb-frame nb-lift group relative cursor-help overflow-hidden p-4",
      )}
    >
      <span className="nb-a-solid absolute inset-x-0 top-0 h-2" />

      <div className="mt-2 mb-2.5 flex items-start justify-between gap-2">
        <span className="nb-a-bg grid h-9 w-9 place-items-center border-2 border-line">
          <Icon aria-hidden="true" className="nb-a-fg h-4 w-4" strokeWidth={2.4} />
        </span>
        {item.delta === null ? (
          <span
            title="No previous scan to compare against"
            className="flex items-center gap-1 border-2 border-line bg-brand-slate-bg px-1.5 py-0.5 text-[11px] font-bold text-ink-4"
          >
            <Minus aria-hidden="true" className="h-3 w-3" strokeWidth={3} />
            <span className="sr-only">No previous scan to compare against</span>
          </span>
        ) : (
          <span
            className={cx(
              "flex items-center gap-1 border-2 border-line px-1.5 py-0.5 text-[11px] font-bold tabular-nums",
              item.delta >= 0
                ? "bg-brand-green-bg text-brand-green"
                : "bg-brand-red-bg text-brand-red",
            )}
          >
            <DeltaIcon aria-hidden="true" className="h-3 w-3" strokeWidth={3} />
            {pct(item.delta)}
          </span>
        )}
      </div>

      <b className="block font-mono text-3xl font-bold leading-none tabular-nums">
        {typeof value === "number" ? value.toLocaleString() : value}
        {item.suffix || ""}
      </b>
      <span className="mt-1.5 flex items-center gap-1.5 text-[12.5px] font-bold uppercase tracking-wide text-ink-2">
        {item.label}
        <Info
          aria-hidden="true"
          className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-50"
          strokeWidth={2.4}
        />
      </span>
      <span className="mt-0.5 block text-[11.5px] text-ink-4">{item.sub}</span>

      {/* Full explanation on hover — the title attribute alone is easy to miss. */}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-full border-t border-line-soft bg-[var(--gl-panel-strong,var(--nb-surface))] px-3 py-2 text-[11px] leading-snug text-ink-2 opacity-0 backdrop-blur-md transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
        {KPI_HELP[item.iconKey]}
      </span>
    </article>
  );
}

export function KpiGrid({ items }) {
  if (!items?.length) return null;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <Kpi key={item.key} item={item} />
      ))}
    </div>
  );
}

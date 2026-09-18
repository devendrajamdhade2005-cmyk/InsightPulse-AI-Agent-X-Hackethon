import { CATEGORY, PRIORITY, SIGNAL_LABEL, relevanceBand } from "../../lib/format.js";
import { Badge, Tag } from "../ui/Primitives.jsx";
import { ToneDot, categoryIconFor } from "../icons/index.jsx";

/* Domain atoms — the small labelled units reused across every surface.
 *
 * Each pairs an icon or shape with text. Colour is never the only signal, which
 * matters most for priority and relevance: those are exactly the cues a
 * colour-blind user cannot afford to miss.
 */

export function PriorityBadge({ priority }) {
  const p = PRIORITY[priority] || PRIORITY.MEDIUM;
  return (
    <Badge tone={p.tone}>
      <ToneDot />
      {p.label}
    </Badge>
  );
}

export function RelevanceBadge({ score }) {
  const b = relevanceBand(score);
  return (
    <Badge tone={b.tone}>
      <ToneDot />
      {b.label}
    </Badge>
  );
}

export function CategoryTag({ category }) {
  const c = CATEGORY[category] || { label: category, accent: "slate" };
  const Icon = categoryIconFor(category);
  return (
    <Tag accent={c.accent}>
      <Icon aria-hidden="true" className="h-3 w-3" strokeWidth={2.4} />
      {c.label}
    </Tag>
  );
}

/**
 * Simulated-data marker.
 *
 * Carries a hatched fill as well as colour, so "this is not verified real-world
 * data" survives greyscale printing and colour blindness.
 */
export function SimTag({ on }) {
  if (!on) return null;
  return (
    <span
      title="Generated in simulation mode — not verified real-world data"
      className="nb-hatch inline-flex items-center border-2 border-brand-yellow bg-surface px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-yellow"
    >
      Simulated
    </span>
  );
}

export function LiveTag() {
  return (
    <span className="inline-flex items-center border-2 border-line bg-brand-green-bg px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-green">
      Live
    </span>
  );
}

export function MixedTag({ children = "Mixed" }) {
  return (
    <span className="inline-flex items-center border-2 border-line bg-brand-orange-bg px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-orange">
      {children}
    </span>
  );
}

/** First few strategic signals, labelled in plain language. */
export function SignalTags({ signals = [], limit = 3 }) {
  return (signals || []).slice(0, limit).map((s) => (
    <Tag key={s} accent="yellow">
      {SIGNAL_LABEL[s] || s}
    </Tag>
  ));
}

/** Derived link strength. Labelled as derived, because it is not source-provided. */
export function Confidence({ value, caption = "confidence" }) {
  return (
    <span
      title="Derived link strength, not a source-provided figure"
      className="shrink-0 border-2 border-line bg-brand-purple-bg px-3 py-1.5 text-center"
    >
      <b className="block font-mono text-base font-bold text-brand-purple">{value}%</b>
      <span className="nb-label text-[9px]">{caption}</span>
    </span>
  );
}

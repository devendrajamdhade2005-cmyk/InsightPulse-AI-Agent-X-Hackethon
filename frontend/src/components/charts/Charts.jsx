import { useId, useMemo } from "react";

/* Hand-rolled inline SVG charts, as React components.
 *
 * Geometry is ported from the original `analytics/charts.js` — same padding,
 * same tick counts, same deterministic bubble packing — so the charts read
 * identically. Two things changed on purpose:
 *
 *  1. Colour now comes from the theme tokens instead of hardcoded hex, so the
 *     charts follow light/dark mode. The original could not do this because its
 *     palette was baked into JS strings.
 *  2. Gradient ids are generated per-instance with useId(). The original used
 *     fixed ids ("gTotal"/"gHigh"), which collide if two area charts are ever on
 *     the page at once — the second chart would pick up the first one's fill.
 *
 * preserveAspectRatio is left at its default so axis labels are not distorted;
 * the original forced "none", which stretched the text non-uniformly.
 */

/* Palette as CSS custom properties — these resolve per theme. */
export const DONUT_VARS = [
  "var(--nb-blue)",
  "var(--nb-purple)",
  "var(--nb-cyan)",
  "var(--nb-orange)",
  "var(--nb-pink)",
  "var(--nb-green)",
  "var(--nb-red)",
  "var(--nb-slate)",
];

export const donutColor = (i) => DONUT_VARS[i % DONUT_VARS.length];

const SERIES_TOTAL = "var(--nb-blue)";
const SERIES_HIGH = "var(--nb-cyan)";

/** Size = volume, colour = growth. Same thresholds as the original. */
function growthColor(item) {
  if (item.isNew) return "var(--nb-pink)";
  const g = item.growth ?? 0;
  if (g >= 40) return "var(--nb-red)";
  if (g >= 15) return "var(--nb-orange)";
  if (g > 0) return "var(--nb-purple)";
  if (g === 0) return "var(--nb-blue)";
  return "var(--nb-slate)";
}

/* ── stacked area / line chart ───────────────────────────── */
export function AreaChart({ series, width = 760, height = 220 }) {
  const uid = useId().replace(/:/g, "");
  const points = series?.points || [];
  if (points.length < 2) return null;

  const pad = { top: 16, right: 14, bottom: 26, left: 34 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;
  const max = Math.max(1, ...points.map((p) => p.total));
  const stepX = points.length > 1 ? w / (points.length - 1) : w;

  const x = (i) => pad.left + i * stepX;
  const y = (v) => pad.top + h - (v / max) * h;

  const line = (key) =>
    points
      .map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`)
      .join(" ");
  const area = (key) =>
    `${line(key)} L${x(points.length - 1).toFixed(1)},${(pad.top + h).toFixed(1)} ` +
    `L${pad.left.toFixed(1)},${(pad.top + h).toFixed(1)} Z`;

  const ticks = 4;
  const everyNth = Math.max(1, Math.ceil(points.length / 7));

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Intelligence activity over time"
      className="block h-auto max-h-64 w-full"
    >
      <defs>
        <linearGradient id={`t-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={SERIES_TOTAL} stopOpacity="0.35" />
          <stop offset="100%" stopColor={SERIES_TOTAL} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`h-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={SERIES_HIGH} stopOpacity="0.3" />
          <stop offset="100%" stopColor={SERIES_HIGH} stopOpacity="0" />
        </linearGradient>
      </defs>

      {Array.from({ length: ticks + 1 }, (_, i) => {
        const value = Math.round((max / ticks) * i);
        const gy = y(value);
        return (
          <g key={i}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={gy.toFixed(1)}
              y2={gy.toFixed(1)}
              stroke="var(--nb-line-soft)"
              strokeWidth="1"
            />
            <text
              x={pad.left - 8}
              y={(gy + 3.5).toFixed(1)}
              textAnchor="end"
              fill="var(--nb-ink-4)"
              fontSize="10"
              className="font-mono"
            >
              {value}
            </text>
          </g>
        );
      })}

      <path d={area("total")} fill={`url(#t-${uid})`} />
      <path
        d={line("total")}
        fill="none"
        stroke={SERIES_TOTAL}
        strokeWidth="2.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path d={area("high")} fill={`url(#h-${uid})`} />
      <path
        d={line("high")}
        fill="none"
        stroke={SERIES_HIGH}
        strokeWidth="2"
        strokeDasharray="5 3"
        strokeLinejoin="round"
      />

      {points.map((p, i) => (
        <circle
          key={i}
          cx={x(i).toFixed(1)}
          cy={y(p.total).toFixed(1)}
          r="3.6"
          fill={SERIES_TOTAL}
          stroke="var(--nb-surface)"
          strokeWidth="1.8"
        >
          <title>{`${p.label} — ${p.total} finding(s), ${p.high} high relevance`}</title>
        </circle>
      ))}

      {points.map((p, i) =>
        i % everyNth === 0 || i === points.length - 1 ? (
          <text
            key={`l-${i}`}
            x={x(i).toFixed(1)}
            y={height - 8}
            textAnchor="middle"
            fill="var(--nb-ink-4)"
            fontSize="10"
            className="font-mono"
          >
            {p.label}
          </text>
        ) : null,
      )}
    </svg>
  );
}

/* ── donut ───────────────────────────────────────────────── */
export function Donut({ slices, size = 168, thickness = 24 }) {
  const total = slices.reduce((s, x) => s + x.count, 0);
  if (!total) return null;

  const r = (size - thickness) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;

  let offset = 0;
  const arcs = slices.map((slice, i) => {
    const frac = slice.count / total;
    const len = frac * circumference;
    const rotation = (offset / circumference) * 360 - 90;
    offset += len;
    return { slice, i, len, rotation, frac };
  });

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="Source distribution"
      className="h-auto w-full max-w-[168px]"
    >
      <circle
        cx={c}
        cy={c}
        r={r.toFixed(2)}
        fill="none"
        stroke="var(--nb-bg-2)"
        strokeWidth={thickness}
      />
      {arcs.map(({ slice, i, len, rotation, frac }) => (
        <circle
          key={`${slice.label}-${i}`}
          cx={c}
          cy={c}
          r={r.toFixed(2)}
          fill="none"
          stroke={donutColor(i)}
          strokeWidth={thickness}
          strokeDasharray={`${len.toFixed(2)} ${(circumference - len).toFixed(2)}`}
          strokeLinecap="butt"
          transform={`rotate(${rotation.toFixed(2)} ${c} ${c})`}
        >
          <title>{`${slice.label} — ${slice.count} (${Math.round(frac * 100)}%)`}</title>
        </circle>
      ))}
      <text
        x={c}
        y={c - 1}
        textAnchor="middle"
        fill="var(--nb-ink)"
        fontSize="24"
        fontWeight="700"
        className="font-mono"
      >
        {total}
      </text>
      <text
        x={c}
        y={c + 15}
        textAnchor="middle"
        fill="var(--nb-ink-4)"
        fontSize="9"
        fontWeight="700"
        letterSpacing="0.1em"
      >
        FINDINGS
      </text>
    </svg>
  );
}

/* ── landscape bubbles ──────────────────────────────────── */
/**
 * Deterministic golden-angle spiral packing — no physics simulation, so the same
 * data always produces the same layout. Ported constant-for-constant.
 */
export function Bubbles({ items, width = 560, height = 260, onSelect }) {
  const placed = useMemo(() => {
    const out = [];
    const maxR = Math.min(54, height / 3.4);
    const minR = 20;
    const sorted = [...items].sort((a, b) => b.weight - a.weight);

    for (const item of sorted) {
      const r = minR + (maxR - minR) * Math.sqrt(item.weight);
      let best = null;
      for (let attempt = 0; attempt < 220; attempt++) {
        const angle = attempt * 2.399;
        const dist = 6 + attempt * 2.05;
        const cx = width / 2 + Math.cos(angle) * dist * (width / height) * 0.62;
        const cy = height / 2 + Math.sin(angle) * dist * 0.62;
        if (cx - r < 4 || cx + r > width - 4 || cy - r < 4 || cy + r > height - 4) {
          continue;
        }
        const clash = out.some(
          (p) => Math.hypot(p.cx - cx, p.cy - cy) < p.r + r + 4,
        );
        if (!clash) {
          best = { cx, cy, r };
          break;
        }
      }
      if (best) out.push({ ...best, item });
    }
    return out;
  }, [items, width, height]);

  if (!items.length) return null;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Research landscape"
      className="h-auto max-h-72 w-full"
    >
      {placed.map(({ cx, cy, r, item }) => {
        const fill = growthColor(item);
        const label =
          item.label.length > 16 ? `${item.label.slice(0, 15)}…` : item.label;
        const fontSize = Math.max(9, Math.min(12.5, r / 3.2));
        const growthNote = item.isNew
          ? ", new this window"
          : item.growth !== null
            ? `, ${item.growth > 0 ? "+" : ""}${Math.round(item.growth)}%`
            : "";
        return (
          <g
            key={item.key}
            role="button"
            tabIndex={0}
            aria-label={`${item.label}: ${item.count} findings`}
            className="cursor-pointer outline-none focus-visible:opacity-70"
            onClick={() => onSelect?.(item.key)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect?.(item.key);
              }
            }}
          >
            <title>{`${item.label} — ${item.count} finding(s)${growthNote}`}</title>
            <circle
              cx={cx.toFixed(1)}
              cy={cy.toFixed(1)}
              r={r.toFixed(1)}
              fill={fill}
              fillOpacity="0.2"
              stroke={fill}
              strokeWidth="2.2"
            />
            <text
              x={cx.toFixed(1)}
              y={(cy + 1).toFixed(1)}
              textAnchor="middle"
              fill={fill}
              fontWeight="700"
              style={{ fontSize: `${fontSize.toFixed(1)}px` }}
              className="pointer-events-none capitalize"
            >
              {label}
            </text>
            <text
              x={cx.toFixed(1)}
              y={(cy + fontSize + 4).toFixed(1)}
              textAnchor="middle"
              fill="var(--nb-ink-3)"
              fontSize="9"
              className="pointer-events-none font-mono"
            >
              {item.count}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ── sparkline ──────────────────────────────────────────── */
export function Sparkline({ values, width = 68, height = 22 }) {
  if (!values || values.length < 2) return null;
  const max = Math.max(1, ...values);
  const stepX = width / (values.length - 1);
  const d = values
    .map(
      (v, i) =>
        `${i ? "L" : "M"}${(i * stepX).toFixed(1)},${(height - (v / max) * height).toFixed(1)}`,
    )
    .join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="inline-block align-middle">
      <path
        d={d}
        fill="none"
        stroke={SERIES_TOTAL}
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Legend swatch that matches the chart palette. */
export function Swatch({ color, dashed }) {
  return (
    <i
      aria-hidden="true"
      className="mr-1.5 inline-block h-[4px] w-4 align-middle"
      style={
        dashed
          ? { borderTop: `3px dashed ${color}` }
          : { backgroundColor: color }
      }
    />
  );
}

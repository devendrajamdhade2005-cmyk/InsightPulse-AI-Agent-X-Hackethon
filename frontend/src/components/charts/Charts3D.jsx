import { useMemo, useState } from "react";
import { cx } from "../../lib/accents.js";
import { useInView, useProgress } from "../../hooks/useReveal.js";

/* Dimensional charts.
 *
 * Isometric / layered SVG rather than WebGL: these are small business charts, and
 * three.js would add ~600 KB plus a render loop to draw a dozen extruded prisms
 * while losing the ability to inherit CSS custom properties.
 *
 * Deliberately NOT pointer-tilted. An earlier version rotated on mousemove, which
 * made reading a value while moving toward it genuinely difficult — the thing you
 * were aiming at kept moving. Depth now comes from fixed projection, shading and
 * occlusion, and the pointer is reserved for inspecting data.
 */

const COS = Math.cos(Math.PI / 6);
const SIN = Math.sin(Math.PI / 6);

function project(x, y, z, unit) {
  return { sx: (x - y) * COS * unit, sy: (x + y) * SIN * unit - z };
}
const poly = (pts) => pts.map((p) => `${p.sx.toFixed(2)},${p.sy.toFixed(2)}`).join(" ");

const topFace = (c) => `color-mix(in oklab, ${c} 82%, white)`;
const frontFace = (c) => c;
const sideFace = (c) => `color-mix(in oklab, ${c} 68%, black)`;

/* ── shared hover tooltip ─────────────────────────────────── */
/**
 * Floating readout for chart hover.
 *
 * Rendered in the parent's coordinate space and clamped away from the edges, so a
 * point near the right-hand side does not push the label out of the panel.
 */
function Tooltip({ at, title, rows = [], visible }) {
  if (!visible || !at) return null;
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-20 min-w-[9rem] max-w-[14rem] -translate-x-1/2 rounded-lg border border-[var(--gl-hairline-strong)] bg-[var(--gl-panel-strong)] px-2.5 py-2 shadow-[var(--gl-shadow)] backdrop-blur-xl"
      style={{
        left: `clamp(5rem, ${at.x}px, calc(100% - 5rem))`,
        top: at.y,
        transform: "translate(-50%, calc(-100% - 12px))",
      }}
    >
      <b className="block text-[12px] font-bold leading-tight capitalize">{title}</b>
      {rows.map(([k, v]) => (
        <span
          key={k}
          className="mt-0.5 flex items-baseline justify-between gap-3 text-[11px]"
        >
          <span className="text-ink-3">{k}</span>
          <b className="font-mono tabular-nums">{v}</b>
        </span>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Bars3D — extruded isometric bars. Static; hover reads values.
   ═══════════════════════════════════════════════════════════ */
export function Bars3D({
  data = [],
  height = 260,
  unit = 30,
  depth = 0.62,
  className,
  valueFormat = (v) => v,
}) {
  const [ref, inView] = useInView({ threshold: 0.3 });
  const t = useProgress(inView, 900);
  const [hover, setHover] = useState(null);

  const max = Math.max(1, ...data.map((d) => Number(d.value) || 0));
  const n = data.length || 1;
  const zFor = (v) => ((Number(v) || 0) / max) * (height * 0.6) * t;

  const geom = useMemo(
    () =>
      data.map((d, i) => ({
        d,
        x0: i * 1.15,
        x1: i * 1.15 + 0.8,
        y0: 0,
        y1: depth,
      })),
    [data, depth],
  );

  const spanX = (n * 1.15 + depth) * COS * unit;
  const spanY = (n * 1.15 + depth) * SIN * unit + height * 0.6;
  const padX = unit * 1.6;
  const padY = unit * 2;
  const minX = -depth * COS * unit - padX;

  return (
    <div ref={ref} className={cx("relative w-full", className)}>
      <svg
        viewBox={`${minX} ${-height * 0.6 - padY / 2} ${spanX + padX * 2} ${spanY + padY}`}
        role="img"
        aria-label="Values by category"
        className="h-auto w-full overflow-visible"
        style={{ maxHeight: height + 100 }}
        onPointerLeave={() => setHover(null)}
      >
        <polygon
          points={poly([
            project(-0.25, -0.25, 0, unit),
            project(n * 1.15, -0.25, 0, unit),
            project(n * 1.15, depth + 0.25, 0, unit),
            project(-0.25, depth + 0.25, 0, unit),
          ])}
          fill="currentColor"
          opacity="0.05"
        />

        {geom.map(({ d, x0, x1, y0, y1 }, i) => {
          const accent = d.accent || "var(--nb-blue)";
          const z = zFor(d.value);
          const lit = hover === null || hover === i;

          const t_bl = project(x0, y0, z, unit);
          const t_br = project(x1, y0, z, unit);
          const t_fr = project(x1, y1, z, unit);
          const t_fl = project(x0, y1, z, unit);
          const b_bl = project(x0, y0, 0, unit);
          const b_fl = project(x0, y1, 0, unit);
          const b_fr = project(x1, y1, 0, unit);

          const labelAt = project(x1, y1 + 0.6, 0, unit);
          const valueAt = project((x0 + x1) / 2, (y0 + y1) / 2, z + 18, unit);

          return (
            <g
              key={d.label || i}
              onPointerEnter={() => setHover(i)}
              style={{
                opacity: lit ? 1 : 0.42,
                transition: "opacity 0.18s ease",
                cursor: "default",
              }}
            >
              <polygon points={poly([t_bl, t_fl, b_fl, b_bl])} fill={sideFace(accent)} />
              <polygon points={poly([t_fl, t_fr, b_fr, b_fl])} fill={frontFace(accent)} />
              <polygon points={poly([t_bl, t_br, t_fr, t_fl])} fill={topFace(accent)} />
              <title>{`${d.label}: ${valueFormat(d.value)}`}</title>

              {z > 8 ? (
                <text
                  x={valueAt.sx}
                  y={valueAt.sy}
                  textAnchor="middle"
                  fill="currentColor"
                  fontSize={unit * 0.44}
                  fontWeight="700"
                  className="font-mono"
                  opacity={t}
                >
                  {valueFormat(d.value)}
                </text>
              ) : null}

              <text
                x={labelAt.sx}
                y={labelAt.sy + unit * 0.55}
                textAnchor="middle"
                fill="currentColor"
                fontSize={unit * 0.36}
                opacity="0.7"
                className="capitalize"
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Donut3D — extruded ring. Slices are hoverable and report
   their share, which the flat version could not do.
   ═══════════════════════════════════════════════════════════ */
export function Donut3D({
  slices = [],
  size = 200,
  thickness = 34,
  lift = 14,
  className,
  centerLabel = "total",
  onHoverSlice,
}) {
  const [ref, inView] = useInView({ threshold: 0.3 });
  const t = useProgress(inView, 800);
  const [active, setActive] = useState(null);

  const total = slices.reduce((s, x) => s + (Number(x.count) || 0), 0);
  if (!total) return null;

  const r = (size - thickness) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;

  let offset = 0;
  const arcs = slices.map((slice, i) => {
    const frac = (Number(slice.count) || 0) / total;
    const len = frac * circumference * t;
    const rotation = (offset / circumference) * 360 - 90;
    // Mid-angle drives the hover pop direction and the tooltip anchor.
    const midDeg = ((offset + (frac * circumference) / 2) / circumference) * 360 - 90;
    offset += frac * circumference;
    return { slice, i, len, rotation, frac, midDeg };
  });

  const select = (i) => {
    setActive(i);
    onHoverSlice?.(i);
  };
  const clear = () => {
    setActive(null);
    onHoverSlice?.(null);
  };

  const activeArc = active !== null ? arcs[active] : null;
  const rad = activeArc ? (activeArc.midDeg * Math.PI) / 180 : 0;

  const Ring = ({ shade, dy }) =>
    arcs.map(({ slice, i, len, rotation, midDeg }) => {
      const isActive = active === i;
      // Nudge the hovered slice outward along its own mid-angle.
      const pop = isActive ? 5 : 0;
      const px = Math.cos((midDeg * Math.PI) / 180) * pop;
      const py = Math.sin((midDeg * Math.PI) / 180) * pop;
      return (
        <circle
          key={`${shade.name}-${i}`}
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke={shade(slice.color || "var(--nb-blue)")}
          strokeWidth={thickness}
          strokeDasharray={`${len.toFixed(2)} ${(circumference - len).toFixed(2)}`}
          strokeLinecap="butt"
          transform={`translate(${px.toFixed(2)} ${(py + dy).toFixed(2)}) rotate(${rotation.toFixed(2)} ${c} ${c})`}
          opacity={active === null || isActive ? 1 : 0.4}
          style={{
            transition: "opacity 0.18s ease, transform 0.22s cubic-bezier(0.22,1,0.36,1)",
            cursor: "pointer",
          }}
          onPointerEnter={() => select(i)}
        >
          <title>{`${slice.label} — ${slice.count} (${Math.round((slice.count / total) * 100)}%)`}</title>
        </circle>
      );
    });

  return (
    <div ref={ref} className={cx("relative", className)} style={{ maxWidth: size }}>
      <svg
        viewBox={`0 0 ${size} ${size + lift}`}
        role="img"
        aria-label="Source distribution"
        className="h-auto w-full overflow-visible"
        onPointerLeave={clear}
      >
        <ellipse
          cx={c}
          cy={size + lift - 4}
          rx={r * 0.95}
          ry={thickness * 0.24}
          fill="currentColor"
          opacity="0.12"
        />
        <g>{Ring({ shade: sideFace, dy: lift })}</g>
        <g>{Ring({ shade: topFace, dy: 0 })}</g>

        {/* Centre reads the hovered slice, or the total when nothing is hovered. */}
        <text
          x={c}
          y={c + 2}
          textAnchor="middle"
          fill="currentColor"
          fontSize={activeArc ? 26 : 30}
          fontWeight="700"
          className="font-mono"
        >
          {activeArc ? activeArc.slice.count : Math.round(total * t)}
        </text>
        <text
          x={c}
          y={c + 20}
          textAnchor="middle"
          fill="currentColor"
          opacity="0.6"
          fontSize="9"
          fontWeight="700"
          letterSpacing="0.12em"
        >
          {activeArc
            ? `${Math.round(activeArc.frac * 100)}% SHARE`
            : centerLabel.toUpperCase()}
        </text>
      </svg>

      <Tooltip
        visible={Boolean(activeArc)}
        at={
          activeArc
            ? {
                x: c + Math.cos(rad) * (r + thickness / 2),
                y: c + Math.sin(rad) * (r + thickness / 2),
              }
            : null
        }
        title={activeArc?.slice.label}
        rows={
          activeArc
            ? [
                ["findings", activeArc.slice.count],
                ["share", `${Math.round(activeArc.frac * 100)}%`],
              ]
            : []
        }
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Area3D — layered area with a fixed extruded base. Static:
   hovering reads a point, it does not move the chart.
   ═══════════════════════════════════════════════════════════ */
export function Area3D({ series = [], width = 720, height = 240, className }) {
  const [ref, inView] = useInView({ threshold: 0.25 });
  const t = useProgress(inView, 1000);
  const [hover, setHover] = useState(null);

  const points = series?.points || [];
  if (points.length < 2) return null;

  const pad = { top: 22, right: 18, bottom: 34, left: 40 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;
  const max = Math.max(1, ...points.map((p) => p.total));
  const stepX = w / (points.length - 1);
  const wall = 14; // extrusion depth of the base slab

  const x = (i) => pad.left + i * stepX;
  const y = (v) => pad.top + h - (v / max) * h * t;

  const line = (key) =>
    points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");
  const area = (key) =>
    `${line(key)} L${x(points.length - 1).toFixed(1)},${(pad.top + h).toFixed(1)} ` +
    `L${pad.left.toFixed(1)},${(pad.top + h).toFixed(1)} Z`;

  // Back plane first, front plane second — fixed offsets, no pointer motion.
  const planes = [
    { key: "high", color: "var(--nb-cyan)", dx: 9, dy: 11, fill: 0.3, label: "High relevance" },
    { key: "total", color: "var(--nb-blue)", dx: 0, dy: 0, fill: 0.26, label: "All findings" },
  ];

  const hoveredPoint = hover !== null ? points[hover] : null;

  return (
    <div ref={ref} className={cx("relative w-full", className)}>
      <svg
        viewBox={`0 0 ${width} ${height + wall + 10}`}
        role="img"
        aria-label="Intelligence activity over time"
        className="h-auto w-full"
        onPointerLeave={() => setHover(null)}
      >
        {/* extruded base slab gives the plot a physical floor */}
        <path
          d={`M${pad.left},${pad.top + h} L${width - pad.right},${pad.top + h} L${width - pad.right + 6},${pad.top + h + wall} L${pad.left + 6},${pad.top + h + wall} Z`}
          fill="currentColor"
          opacity="0.14"
        />

        {Array.from({ length: 5 }, (_, i) => {
          const v = Math.round((max / 4) * i);
          const gy = pad.top + h - (v / max) * h;
          return (
            <g key={i}>
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={gy}
                y2={gy}
                stroke="currentColor"
                opacity="0.1"
                strokeWidth="1"
              />
              <text
                x={pad.left - 10}
                y={gy + 3.5}
                textAnchor="end"
                fill="currentColor"
                opacity="0.45"
                fontSize="10"
                className="font-mono"
              >
                {v}
              </text>
            </g>
          );
        })}

        {planes.map((plane) => (
          <g key={plane.key} transform={`translate(${plane.dx} ${plane.dy})`}>
            <path d={area(plane.key)} fill={plane.color} opacity={plane.fill * t} />
            <path
              d={line(plane.key)}
              fill="none"
              stroke={plane.color}
              strokeWidth="2.6"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </g>
        ))}

        {/* hover guide + markers on the front plane */}
        {hover !== null ? (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={pad.top - 6}
            y2={pad.top + h}
            stroke="currentColor"
            opacity="0.3"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        ) : null}

        {points.map((p, i) => (
          <circle
            key={i}
            cx={x(i)}
            cy={y(p.total)}
            r={hover === i ? 5.5 : 3.4}
            fill="var(--nb-blue)"
            stroke="var(--gl-panel-strong, #fff)"
            strokeWidth="1.8"
            style={{ transition: "r 0.14s ease" }}
          />
        ))}

        {/* Wide invisible hit zones: 3px dots are far too small to aim at. */}
        {points.map((p, i) => (
          <rect
            key={`hit-${i}`}
            x={x(i) - stepX / 2}
            y={pad.top - 8}
            width={stepX}
            height={h + 16}
            fill="transparent"
            style={{ cursor: "pointer" }}
            onPointerEnter={() => setHover(i)}
          >
            <title>{`${p.label} — ${p.total} finding(s), ${p.high} high relevance`}</title>
          </rect>
        ))}

        {points.map((p, i) =>
          i % Math.max(1, Math.ceil(points.length / 7)) === 0 ||
          i === points.length - 1 ? (
            <text
              key={`l-${i}`}
              x={x(i)}
              y={height + wall + 2}
              textAnchor="middle"
              fill="currentColor"
              opacity={hover === i ? 0.9 : 0.45}
              fontSize="10"
              fontWeight={hover === i ? 700 : 400}
              className="font-mono"
            >
              {p.label}
            </text>
          ) : null,
        )}
      </svg>

      <Tooltip
        visible={Boolean(hoveredPoint)}
        at={hoveredPoint ? { x: x(hover), y: y(hoveredPoint.total) } : null}
        title={hoveredPoint?.label}
        rows={
          hoveredPoint
            ? [
                ["all findings", hoveredPoint.total],
                ["high relevance", hoveredPoint.high],
              ]
            : []
        }
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Network3D — the research landscape as a linked constellation.
   Replaces the old packed-bubble cloud, which showed volume but
   no relationships at all. Topics that share a source category
   are now visibly connected.
   ═══════════════════════════════════════════════════════════ */
export function Network3D({
  items = [],
  width = 620,
  height = 380,
  className,
  onSelect,
}) {
  const [ref, inView] = useInView({ threshold: 0.2 });
  const t = useProgress(inView, 1100);
  const [active, setActive] = useState(null);

  const { nodes, edges } = useMemo(() => {
    const list = [...items].sort((a, b) => b.weight - a.weight).slice(0, 12);
    if (!list.length) return { nodes: [], edges: [] };

    const cx = width / 2;
    const cy = height / 2;

    /* Deterministic layout: the heaviest topic anchors the centre, the rest sit on
       two rings. A force simulation would re-settle differently on every mount,
       which makes the same scan look like different data. */
    const placed = list.map((item, i) => {
      if (i === 0) return { item, x: cx, y: cy, ring: 0, z: 1 };
      const inner = i <= 5;
      const ringIndex = inner ? i - 1 : i - 6;
      const ringCount = inner ? Math.min(5, list.length - 1) : Math.max(1, list.length - 6);
      const radius = inner ? Math.min(width, height) * 0.24 : Math.min(width, height) * 0.42;
      // Offset the outer ring so nodes do not line up radially with the inner one.
      const angle = (ringIndex / ringCount) * Math.PI * 2 + (inner ? -Math.PI / 2 : -Math.PI / 2 + Math.PI / ringCount);
      return {
        item,
        x: cx + Math.cos(angle) * radius * 1.22,
        y: cy + Math.sin(angle) * radius * 0.82,
        ring: inner ? 1 : 2,
        // Depth: outer nodes read as further away.
        z: inner ? 0.78 : 0.58,
      };
    });

    // An edge exists when two topics were observed in a shared source category.
    const links = [];
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const a = placed[i].item.categories || [];
        const b = placed[j].item.categories || [];
        const shared = a.filter((c) => b.includes(c));
        if (!shared.length) continue;
        links.push({
          a: i,
          b: j,
          shared,
          strength: shared.length / Math.max(1, Math.min(a.length, b.length)),
        });
      }
    }
    // Keep the graph legible: strongest links only.
    links.sort((p, q) => q.strength - p.strength);
    return { nodes: placed, edges: links.slice(0, 18) };
  }, [items, width, height]);

  if (!nodes.length) return null;

  const maxCount = Math.max(...nodes.map((n) => n.item.count));
  const radiusFor = (n) => (13 + Math.sqrt(n.item.weight) * 20) * n.z;

  const growthColor = (item) => {
    if (item.isNew) return "var(--nb-pink)";
    const g = item.growth ?? 0;
    if (g >= 40) return "var(--nb-red)";
    if (g >= 15) return "var(--nb-orange)";
    if (g > 0) return "var(--nb-purple)";
    if (g === 0) return "var(--nb-blue)";
    return "var(--nb-slate)";
  };

  const neighbours =
    active === null
      ? null
      : new Set(
          edges
            .filter((e) => e.a === active || e.b === active)
            .flatMap((e) => [e.a, e.b]),
        );

  const activeNode = active !== null ? nodes[active] : null;

  return (
    <div ref={ref} className={cx("relative w-full", className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Research landscape — topics and their shared sources"
        className="h-auto w-full"
        onPointerLeave={() => setActive(null)}
      >
        <defs>
          {/* One radial gradient per node gives each a spherical shading. */}
          {nodes.map((n, i) => {
            const c = growthColor(n.item);
            return (
              <radialGradient
                key={i}
                id={`nodeg-${i}`}
                cx="35%"
                cy="30%"
                r="72%"
              >
                <stop offset="0%" stopColor={`color-mix(in oklab, ${c} 55%, white)`} />
                <stop offset="60%" stopColor={c} />
                <stop offset="100%" stopColor={`color-mix(in oklab, ${c} 72%, black)`} />
              </radialGradient>
            );
          })}
        </defs>

        {/* edges behind everything, drawn as gentle curves */}
        <g>
          {edges.map((e, i) => {
            const A = nodes[e.a];
            const B = nodes[e.b];
            const lit = active === null || e.a === active || e.b === active;
            const mx = (A.x + B.x) / 2;
            const my = (A.y + B.y) / 2 - 18;
            return (
              <path
                key={i}
                d={`M${A.x},${A.y} Q${mx},${my} ${B.x},${B.y}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={0.8 + e.strength * 1.8}
                opacity={(lit ? 0.3 : 0.07) * t}
                style={{ transition: "opacity 0.2s ease" }}
              />
            );
          })}
        </g>

        {/* contact shadows ground the spheres */}
        {nodes.map((n, i) => {
          const r = radiusFor(n) * t;
          return (
            <ellipse
              key={`sh-${i}`}
              cx={n.x}
              cy={n.y + r * 0.92}
              rx={r * 0.8}
              ry={r * 0.18}
              fill="currentColor"
              opacity="0.1"
            />
          );
        })}

        {/* nodes, far ring first so near nodes overlap correctly */}
        {[...nodes.keys()]
          .sort((a, b) => nodes[a].z - nodes[b].z)
          .map((i) => {
            const n = nodes[i];
            const r = radiusFor(n) * t;
            const dim = neighbours && !neighbours.has(i) ? 0.28 : 1;
            const isActive = active === i;
            const label =
              n.item.label.length > 15
                ? `${n.item.label.slice(0, 14)}…`
                : n.item.label;

            return (
              <g
                key={n.item.key}
                role="button"
                tabIndex={0}
                aria-label={`${n.item.label}: ${n.item.count} findings`}
                className="cursor-pointer outline-none"
                opacity={dim}
                style={{ transition: "opacity 0.2s ease" }}
                onPointerEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onClick={() => onSelect?.(n.item.key)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect?.(n.item.key);
                  }
                }}
              >
                <title>
                  {`${n.item.label} — ${n.item.count} finding(s), ${n.item.confidence}% avg relevance`}
                </title>

                {isActive ? (
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={r + 6}
                    fill="none"
                    stroke={growthColor(n.item)}
                    strokeWidth="2"
                    opacity="0.55"
                  />
                ) : null}

                <circle
                  cx={n.x}
                  cy={n.y}
                  r={r}
                  fill={`url(#nodeg-${i})`}
                  stroke={growthColor(n.item)}
                  strokeWidth="1.2"
                  style={{ transition: "r 0.2s cubic-bezier(0.22,1,0.36,1)" }}
                />
                {/* specular highlight — the cue that reads as a sphere */}
                <ellipse
                  cx={n.x - r * 0.3}
                  cy={n.y - r * 0.38}
                  rx={r * 0.3}
                  ry={r * 0.19}
                  fill="white"
                  opacity="0.34"
                  className="pointer-events-none"
                />

                {r > 20 ? (
                  <text
                    x={n.x}
                    y={n.y + 3}
                    textAnchor="middle"
                    fill="white"
                    fontSize={Math.max(9, Math.min(12, r / 3))}
                    fontWeight="700"
                    className="pointer-events-none capitalize"
                    style={{ paintOrder: "stroke", textShadow: "0 1px 2px rgb(0 0 0 / 0.45)" }}
                  >
                    {label}
                  </text>
                ) : null}
              </g>
            );
          })}
      </svg>

      {/* Small nodes cannot hold their label, so the readout carries it. */}
      <Tooltip
        visible={Boolean(activeNode)}
        at={
          activeNode
            ? { x: activeNode.x, y: activeNode.y - radiusFor(activeNode) }
            : null
        }
        title={activeNode?.item.label}
        rows={
          activeNode
            ? [
                ["findings", activeNode.item.count],
                ["avg relevance", `${activeNode.item.confidence}%`],
                [
                  "growth",
                  activeNode.item.isNew
                    ? "new"
                    : activeNode.item.growth === null
                      ? "—"
                      : `${activeNode.item.growth > 0 ? "+" : ""}${Math.round(activeNode.item.growth)}%`,
                ],
                [
                  "linked topics",
                  edges.filter((e) => e.a === active || e.b === active).length,
                ],
              ]
            : []
        }
      />

      <p className="mt-1 text-center text-[11px] text-ink-4">
        Lines connect topics observed in the same source category · click a node to
        filter
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Stack3D — competitive position. Static tilt, hoverable segments.
   ═══════════════════════════════════════════════════════════ */
export function Stack3D({ rows = [], className, keys = [] }) {
  const [ref, inView] = useInView({ threshold: 0.25 });
  const t = useProgress(inView, 750);
  const [hover, setHover] = useState(null);

  const max = Math.max(1, ...rows.map((r) => r.total || 0));

  return (
    <div ref={ref} className={cx("grid gap-3.5", className)}>
      {rows.map((row) => (
        <div
          key={row.name}
          className="grid items-center gap-3 sm:grid-cols-[9rem_1fr_3rem]"
        >
          <span className="truncate text-[13.5px] font-semibold">{row.name}</span>

          <div className="relative">
            <div
              className="flex h-9 gap-[3px]"
              style={{ perspective: "700px" }}
              onPointerLeave={() => setHover(null)}
            >
              {keys.map((k) => {
                const n = row.byCategory?.[k.key] || 0;
                if (!n) return null;
                const id = `${row.name}-${k.key}`;
                const lit = hover === null || hover === id;
                return (
                  <div
                    key={k.key}
                    title={`${row.name} · ${k.label}: ${n}`}
                    onPointerEnter={() => setHover(id)}
                    className="relative grid cursor-pointer place-items-center rounded-[5px] font-mono text-[11px] font-bold text-white"
                    style={{
                      flex: n,
                      minWidth: 28,
                      transform: `rotateX(18deg) scale(${lit ? 1 : 0.97})`,
                      opacity: lit ? 1 : 0.45,
                      background: `linear-gradient(180deg, ${topFace(k.color)}, ${frontFace(k.color)} 58%, ${sideFace(k.color)})`,
                      boxShadow: `0 3px 8px -2px color-mix(in oklab, ${k.color} 55%, transparent)`,
                      transition: "opacity 0.18s ease, transform 0.18s ease",
                    }}
                  >
                    {n}
                  </div>
                );
              })}
              {!keys.some((k) => row.byCategory?.[k.key]) ? (
                <div className="grid flex-1 place-items-center rounded-[5px] bg-current/10 text-[11px] opacity-60">
                  no signals
                </div>
              ) : null}
            </div>
          </div>

          <span className="font-mono text-[14px] font-bold tabular-nums sm:text-right">
            {Math.round((row.total || 0) * t)}
          </span>
        </div>
      ))}
    </div>
  );
}

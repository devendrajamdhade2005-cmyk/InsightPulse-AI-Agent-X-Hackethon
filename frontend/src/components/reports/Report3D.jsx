import { useCallback, useEffect, useRef, useState } from "react";
import { cx } from "../../lib/accents.js";
import { Spinner } from "../ui/Loading.jsx";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileText,
  Layers,
  RefreshCw,
} from "../icons/index.jsx";

/* Report preview with a real page turn.
 *
 * Two problems with the previous version, both fixed here:
 *
 *  1. It "fanned" by translating pages upward, which escaped the container and
 *     collided with the panel above it. Nothing now moves outside the frame: the
 *     book sits in a fixed-aspect stage with its own padding, and the turning page
 *     rotates within that box.
 *
 *  2. The motion was a morph, not a turn. A page now rotates about its spine
 *     (transform-origin on the left edge, rotateY toward -180°) with a distinct
 *     front and back face, so it reads as paper being lifted and laid over — which
 *     is what a page turn actually looks like.
 */

const SECTIONS = [
  { key: "summary", label: "Executive Summary", accent: "var(--nb-blue)", lines: [92, 78, 88, 64, 84] },
  { key: "insights", label: "Prioritized Insights", accent: "var(--nb-pink)", lines: [70, 94, 62, 88] },
  { key: "agents", label: "Agent Contributions", accent: "var(--nb-purple)", lines: [86, 72, 90, 58, 76] },
  { key: "execution", label: "Execution Summary", accent: "var(--nb-cyan)", lines: [64, 88, 74] },
  { key: "findings", label: "Detailed Findings", accent: "var(--nb-green)", lines: [94, 82, 90, 70, 86, 60] },
  { key: "sources", label: "Sources & Coverage", accent: "var(--nb-orange)", lines: [78, 92, 66, 84] },
  { key: "limits", label: "Limitations & Caveats", accent: "var(--nb-slate)", lines: [72, 60, 86] },
];

/* ── page content ─────────────────────────────────────────── */

function CoverFace({ pageCount }) {
  return (
    <div className="flex h-full flex-col p-5">
      <span
        className="inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em]"
        style={{
          background: "color-mix(in oklab, var(--nb-blue) 18%, transparent)",
          color: "var(--nb-blue)",
        }}
      >
        <FileText className="h-2.5 w-2.5" strokeWidth={2.8} />
        Intelligence Report
      </span>

      <h4 className="mt-3 text-[15px] font-bold leading-tight">
        Research &amp; Competitive
        <br />
        Intelligence Briefing
      </h4>

      <div className="mt-4 space-y-1.5">
        {[92, 74, 84, 62].map((w, k) => (
          <span
            key={k}
            className="block h-[3px] rounded-full bg-current opacity-20"
            style={{ width: `${w}%` }}
          />
        ))}
      </div>

      <div className="mt-auto flex items-end justify-between">
        <div className="flex items-baseline gap-1">
          <b className="font-mono text-2xl font-bold leading-none">{pageCount}</b>
          <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">
            pages
          </span>
        </div>
        <div className="flex gap-1">
          {SECTIONS.slice(0, 5).map((s) => (
            <span
              key={s.key}
              className="h-4 w-[3px] rounded-full"
              style={{ background: s.accent, opacity: 0.8 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SectionFace({ section, index }) {
  return (
    <div className="flex h-full flex-col justify-between p-4 pl-6">
      <div>
        <span
          className="text-[9px] font-bold uppercase tracking-[0.14em]"
          style={{ color: section.accent }}
        >
          {section.label}
        </span>
        <div className="mt-1.5 h-[2px] w-8 rounded-full" style={{ background: section.accent }} />
        <div className="mt-3 space-y-[5px]">
          {section.lines.map((w, k) => (
            <span
              key={k}
              className="block h-[2.5px] rounded-full bg-current opacity-[0.17]"
              style={{ width: `${w}%` }}
            />
          ))}
        </div>
      </div>
      <span className="font-mono text-[9px] opacity-40">
        {String(index + 1).padStart(2, "0")} / {SECTIONS.length}
      </span>
    </div>
  );
}

/** One leaf. `state` is "turned" | "turning" | "stacked". */
function Leaf({ section, index, pageCount, state, depth }) {
  const isCover = index === 0;

  const rotation =
    state === "turned" ? -178 : state === "turning" ? -104 : 0;

  return (
    <div
      className="absolute inset-0"
      style={{
        transformStyle: "preserve-3d",
        transformOrigin: "left center",
        transform: `translateZ(${depth}px) rotateY(${rotation}deg)`,
        transition:
          "transform 0.72s cubic-bezier(0.55, 0.06, 0.3, 0.99)",
        // Turned leaves must not intercept clicks meant for the page beneath.
        pointerEvents: state === "stacked" ? "auto" : "none",
        zIndex: state === "stacked" ? 50 - index : index,
      }}
    >
      {/* front (recto) */}
      <div
        className="absolute inset-0 overflow-hidden rounded-r-[10px] rounded-l-[3px] border border-[var(--gl-hairline-strong)]"
        style={{
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
          background: `linear-gradient(160deg,
            color-mix(in oklab, var(--gl-panel-strong) 88%, ${section.accent} 5%),
            var(--gl-panel))`,
          boxShadow: "0 6px 20px -10px rgb(0 0 0 / 0.30)",
        }}
      >
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-[5px]"
          style={{ background: section.accent }}
        />
        {/* gutter shading near the spine sells the curve of a real page */}
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-[5px] w-6"
          style={{
            background:
              "linear-gradient(90deg, rgb(0 0 0 / 0.10), transparent)",
          }}
        />
        {isCover ? <CoverFace pageCount={pageCount} /> : (
          <SectionFace section={section} index={index} />
        )}
      </div>

      {/* back (verso) — mirrored, so the turned leaf shows a reverse side */}
      <div
        className="absolute inset-0 overflow-hidden rounded-l-[10px] rounded-r-[3px] border border-[var(--gl-hairline-strong)]"
        style={{
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
          transform: "rotateY(180deg)",
          background:
            "linear-gradient(200deg, var(--gl-panel-strong), var(--gl-panel))",
        }}
      >
        <span
          aria-hidden="true"
          className="absolute inset-y-0 right-0 w-6"
          style={{
            background: "linear-gradient(270deg, rgb(0 0 0 / 0.10), transparent)",
          }}
        />
        <div className="flex h-full flex-col justify-between p-4 pr-6 text-right">
          <div className="space-y-[5px]">
            {[58, 84, 70, 90].map((w, k) => (
              <span
                key={k}
                className="ml-auto block h-[2.5px] rounded-full bg-current opacity-[0.12]"
                style={{ width: `${w}%` }}
              />
            ))}
          </div>
          <span className="font-mono text-[9px] opacity-30">
            {section.label}
          </span>
        </div>
      </div>
    </div>
  );
}

export function Report3D({
  pageCount = 14,
  busy = false,
  onPreview,
  onDownload,
  onRegenerate,
  reportId,
  className,
}) {
  // How many leaves have been turned. 0 = closed on the cover.
  const [turned, setTurned] = useState(0);
  const [turning, setTurning] = useState(null);
  const timer = useRef(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  /* A turn is animated in two beats: lift the leaf to mid-air, then lay it flat.
     Without the intermediate state the page snaps through the spine and the
     motion reads as a flicker rather than a turn. */
  const turn = useCallback((direction) => {
    window.clearTimeout(timer.current);
    setTurned((current) => {
      const next = current + direction;
      if (next < 0 || next > SECTIONS.length - 1) return current;
      setTurning(direction > 0 ? next - 1 : next);
      timer.current = window.setTimeout(() => setTurning(null), 230);
      return next;
    });
  }, []);

  const atStart = turned === 0;
  const atEnd = turned >= SECTIONS.length - 1;
  const current = SECTIONS[Math.min(turned, SECTIONS.length - 1)];

  return (
    <div className={cx("grid items-start gap-7 lg:grid-cols-[21rem_1fr]", className)}>
      {/* ── the book. Fixed stage, generous padding: nothing escapes. ── */}
      <div className="mx-auto w-full max-w-[21rem]">
        <div
          className="relative mx-auto w-full px-3 py-2"
          style={{ perspective: "1500px", perspectiveOrigin: "60% 45%" }}
        >
          <div
            className="relative mx-auto"
            style={{ aspectRatio: "3 / 4", transformStyle: "preserve-3d" }}
          >
            {/* spine */}
            <span
              aria-hidden="true"
              className="absolute inset-y-2 -left-1 w-2 rounded-l-md"
              style={{
                background:
                  "linear-gradient(90deg, rgb(0 0 0 / 0.22), rgb(0 0 0 / 0.05))",
              }}
            />
            {/* the closed block of remaining pages, behind everything */}
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-r-[10px] border border-[var(--gl-hairline)]"
              style={{
                transform: "translateZ(-26px) translateX(3px)",
                background: "var(--gl-panel-soft)",
                boxShadow: "0 10px 26px -12px rgb(0 0 0 / 0.35)",
              }}
            />

            {SECTIONS.map((section, i) => (
              <Leaf
                key={section.key}
                section={section}
                index={i}
                pageCount={pageCount}
                depth={(SECTIONS.length - i) * 1.6}
                state={
                  turning === i
                    ? "turning"
                    : i < turned
                      ? "turned"
                      : "stacked"
                }
              />
            ))}

            {busy ? (
              <div className="absolute inset-0 z-[60] grid place-items-center rounded-[10px] bg-[var(--gl-panel-strong)] backdrop-blur-sm">
                <div className="flex flex-col items-center gap-2">
                  <Spinner size="lg" className="text-brand-blue" label="Building report" />
                  <span className="text-[11px] font-bold uppercase tracking-wider">
                    Building
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* page controls */}
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => turn(-1)}
            disabled={atStart}
            aria-label="Previous page"
            className="nb-press grid h-8 w-8 place-items-center rounded-lg border border-[var(--gl-hairline-strong)] bg-[var(--gl-panel-strong)] disabled:opacity-35"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={2.6} />
          </button>

          <span className="min-w-[9.5rem] text-center">
            <b className="block text-[11.5px] font-bold uppercase tracking-wide">
              {current.label}
            </b>
            <span className="font-mono text-[10px] text-ink-4">
              {turned + 1} / {SECTIONS.length}
            </span>
          </span>

          <button
            type="button"
            onClick={() => turn(1)}
            disabled={atEnd}
            aria-label="Next page"
            className="nb-press grid h-8 w-8 place-items-center rounded-lg border border-[var(--gl-hairline-strong)] bg-[var(--gl-panel-strong)] disabled:opacity-35"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={2.6} />
          </button>
        </div>
      </div>

      {/* ── actions + contents ── */}
      <div className="min-w-0">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onPreview}
            disabled={busy}
            className="nb-press inline-flex items-center gap-2 border-2 border-line bg-brand-blue px-4 py-2.5 text-[13px] font-bold uppercase tracking-wide text-white disabled:opacity-60"
          >
            <Eye className="h-4 w-4" strokeWidth={2.4} />
            Preview
          </button>
          <button
            type="button"
            onClick={() => onDownload("pdf")}
            disabled={busy}
            className="nb-press inline-flex items-center gap-2 border-2 border-line bg-surface px-4 py-2.5 text-[13px] font-bold uppercase tracking-wide disabled:opacity-60"
          >
            <Download className="h-4 w-4" strokeWidth={2.4} />
            PDF
          </button>
          <button
            type="button"
            onClick={() => onDownload("md")}
            disabled={busy}
            className="nb-press border-2 border-line bg-surface px-3 py-2.5 text-[12px] font-bold uppercase tracking-wide disabled:opacity-60"
          >
            Markdown
          </button>
          <button
            type="button"
            onClick={() => onDownload("json")}
            disabled={busy}
            className="nb-press border-2 border-line bg-surface px-3 py-2.5 text-[12px] font-bold uppercase tracking-wide disabled:opacity-60"
          >
            JSON
          </button>
          {onRegenerate ? (
            <button
              type="button"
              onClick={onRegenerate}
              disabled={busy}
              title="Rebuild from the same run"
              className="nb-press inline-flex items-center gap-2 border-2 border-line bg-surface px-3 py-2.5 text-[12px] font-bold uppercase tracking-wide disabled:opacity-60"
            >
              <RefreshCw className="h-3.5 w-3.5" strokeWidth={2.4} />
              Rebuild
            </button>
          ) : null}
        </div>

        {reportId ? (
          <p className="mt-3 truncate font-mono text-[11px] text-ink-3">{reportId}</p>
        ) : null}

        <div className="mt-5">
          <span className="nb-label mb-2 flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" strokeWidth={2.4} />
            Contents
          </span>
          <ul className="grid gap-1">
            {SECTIONS.map((s, i) => {
              const isCurrent = i === turned;
              return (
                <li key={s.key}>
                  <button
                    type="button"
                    onClick={() => setTurned(i)}
                    className={cx(
                      "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[12.5px] transition-colors",
                      isCurrent ? "bg-current/[0.07] font-semibold" : "hover:bg-current/5",
                    )}
                  >
                    <span className="font-mono text-[10px] opacity-45">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span
                      aria-hidden="true"
                      className="shrink-0 rounded-full transition-all"
                      style={{
                        background: s.accent,
                        width: 3,
                        height: isCurrent ? 18 : 14,
                      }}
                    />
                    <span className="min-w-0 flex-1 truncate">{s.label}</span>
                    <ChevronRight
                      aria-hidden="true"
                      className={cx(
                        "h-3.5 w-3.5 shrink-0 transition-opacity",
                        isCurrent ? "opacity-70" : "opacity-25",
                      )}
                      strokeWidth={2.4}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

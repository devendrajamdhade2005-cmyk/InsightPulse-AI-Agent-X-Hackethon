import { useEffect, useMemo, useRef, useState } from "react";
import { cx } from "../../lib/accents.js";
import { useCycle, useInView } from "../../hooks/useReveal.js";
import { Bars3D } from "../charts/Charts3D.jsx";
import { Dots, ProgressRing, Spinner } from "../ui/Loading.jsx";
import {
  Beaker,
  Brain,
  Building2,
  Check,
  Eye,
  Globe,
  ListChecks,
  Newspaper,
  Scale,
  Scroll,
  Search,
  Sparkles,
  Target,
} from "../icons/index.jsx";

/* Interactive hero demo.
 *
 * Replays a representative agent run on a loop: the six loop stages advance, tools
 * light up as they are "called", and the result chart grows. It is clearly a
 * demonstration rather than live data — the panel says so — but the sequence and
 * the vocabulary are the real ones, so it teaches the product instead of just
 * decorating the page.
 *
 * Pauses when scrolled out of view or when the tab is hidden, so an idle landing
 * page in a background tab costs nothing.
 */

const STAGES = [
  {
    key: "goal",
    icon: Target,
    label: "Understanding goal",
    accent: "var(--nb-blue)",
    detail: "Track AI agents · monitor OpenAI and Anthropic",
  },
  {
    key: "plan",
    icon: ListChecks,
    label: "Planning",
    accent: "var(--nb-purple)",
    detail: "Needs: research, patents, competitor activity",
  },
  {
    key: "decide",
    icon: Scale,
    label: "Deciding next action",
    accent: "var(--nb-cyan)",
    detail: "Holding back live web until evidence justifies it",
  },
  {
    key: "call",
    icon: Search,
    label: "Calling tools",
    accent: "var(--nb-orange)",
    detail: "research_search → 14 results from arXiv, OpenAlex",
  },
  {
    key: "observe",
    icon: Eye,
    label: "Observing",
    accent: "var(--nb-green)",
    detail: "9 relevant, 3 duplicates suppressed, 1 signal found",
  },
  {
    key: "report",
    icon: Sparkles,
    label: "Prioritizing",
    accent: "var(--nb-pink)",
    detail: "6 insights written · 2 high priority",
  },
];

const TOOLS = [
  { key: "research", icon: Beaker, label: "Research", at: 3, color: "var(--nb-blue)" },
  { key: "patent", icon: Scroll, label: "Patents", at: 3, color: "var(--nb-cyan)" },
  { key: "competitor", icon: Building2, label: "Competitors", at: 4, color: "var(--nb-orange)" },
  { key: "news", icon: Newspaper, label: "News", at: 4, color: "var(--nb-green)" },
  { key: "web", icon: Globe, label: "Live web", at: 5, color: "var(--nb-purple)" },
];

const RESULT = [
  { label: "research", value: 14, accent: "var(--nb-blue)" },
  { label: "patents", value: 6, accent: "var(--nb-cyan)" },
  { label: "competitors", value: 11, accent: "var(--nb-orange)" },
  { label: "news", value: 9, accent: "var(--nb-green)" },
  { label: "web", value: 4, accent: "var(--nb-purple)" },
];

export function LiveDemo({ className }) {
  const [ref, inView] = useInView({ threshold: 0.2 });
  const [stage] = useCycle(STAGES.length, { interval: 2300, active: inView });

  const active = STAGES[stage];
  const done = stage === STAGES.length - 1;
  const progress = (stage + 1) / STAGES.length;

  return (
    <div ref={ref} className={cx("gl-card gl-card-lg overflow-hidden", className)}>
      {/* window chrome — signals "this is the app" without faking a screenshot */}
      <div className="flex items-center gap-2 border-b border-[var(--gl-hairline)] px-4 py-2.5">
        <span className="flex gap-1.5">
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
            <span
              key={c}
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: c }}
            />
          ))}
        </span>
        <span className="ml-2 font-mono text-[10.5px] text-ink-3">
          insightpulse · agent run
        </span>
        <span className="ml-auto flex items-center gap-1.5 rounded-full border border-[var(--gl-hairline)] px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-ink-3">
          {done ? (
            <>
              <Check className="h-2.5 w-2.5 text-brand-green" strokeWidth={3} />
              complete
            </>
          ) : (
            <>
              <Spinner size="xs" className="text-brand-blue" label="Running" />
              running
            </>
          )}
        </span>
      </div>

      <div className="grid gap-0 lg:grid-cols-[1.05fr_1fr]">
        {/* ── left: the loop ── */}
        <div className="border-b border-[var(--gl-hairline)] p-4 lg:border-b-0 lg:border-r">
          <div className="mb-3 flex items-center justify-between">
            <span className="nb-label">Reasoning loop</span>
            <ProgressRing
              value={progress}
              size={34}
              stroke={3.5}
              className="text-brand-blue"
              label="Run progress"
            >
              {stage + 1}/{STAGES.length}
            </ProgressRing>
          </div>

          <ol className="grid gap-1">
            {STAGES.map((s, i) => {
              const isActive = i === stage;
              const isPast = i < stage;
              const Icon = s.icon;
              return (
                <li
                  key={s.key}
                  className={cx(
                    "flex items-start gap-2.5 rounded-lg px-2 py-1.5 transition-all duration-500",
                    isActive && "bg-current/[0.06]",
                  )}
                  style={{ opacity: isActive ? 1 : isPast ? 0.62 : 0.3 }}
                >
                  <span
                    className="relative mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md transition-colors duration-500"
                    style={{
                      background: isActive || isPast
                        ? `color-mix(in oklab, ${s.accent} 20%, transparent)`
                        : "transparent",
                      color: isActive || isPast ? s.accent : "currentColor",
                    }}
                  >
                    {isPast ? (
                      <Check className="h-3 w-3" strokeWidth={3.2} />
                    ) : (
                      <Icon className="h-3 w-3" strokeWidth={2.6} />
                    )}
                    {isActive ? (
                      <span
                        aria-hidden="true"
                        className="absolute inset-0 rounded-md"
                        style={{
                          border: `2px solid ${s.accent}`,
                          animation: "pulse-ring 1.8s ease-out infinite",
                        }}
                      />
                    ) : null}
                  </span>
                  <span className="min-w-0">
                    <b className="block text-[12.5px] font-semibold leading-snug">
                      {s.label}
                      {isActive && !done ? <Dots className="ml-1.5 align-middle" /> : null}
                    </b>
                    {isActive ? (
                      <span className="anim-rise-sm mt-0.5 block font-mono text-[10.5px] leading-snug text-ink-3">
                        {s.detail}
                      </span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ol>

          {/* tools light up as the loop reaches them */}
          <div className="mt-4 border-t border-[var(--gl-hairline)] pt-3">
            <span className="nb-label mb-2 block">Tools</span>
            <div className="flex flex-wrap gap-1.5">
              {TOOLS.map((tool) => {
                const lit = stage >= tool.at;
                const Icon = tool.icon;
                return (
                  <span
                    key={tool.key}
                    className="inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10.5px] font-bold transition-all duration-500"
                    style={{
                      borderColor: lit
                        ? `color-mix(in oklab, ${tool.color} 45%, transparent)`
                        : "var(--gl-hairline)",
                      background: lit
                        ? `color-mix(in oklab, ${tool.color} 14%, transparent)`
                        : "transparent",
                      color: lit ? tool.color : "var(--nb-ink-4)",
                      transform: lit ? "translateY(-1px)" : "none",
                    }}
                  >
                    <Icon className="h-3 w-3" strokeWidth={2.6} />
                    {tool.label}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── right: the result ── */}
        <div className="flex flex-col p-4">
          <span className="nb-label mb-1">Findings by source</span>
          <div className="flex-1">
            <Bars3D data={RESULT} height={168} unit={26} className="mt-1" />
          </div>

          <div className="mt-2 grid grid-cols-3 gap-2 border-t border-[var(--gl-hairline)] pt-3">
            {[
              ["44", "gathered"],
              ["6", "insights"],
              ["2", "high"],
            ].map(([v, l]) => (
              <div key={l}>
                <b className="block font-mono text-lg font-bold leading-none tabular-nums">
                  {v}
                </b>
                <span className="nb-label text-[9px]">{l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="border-t border-[var(--gl-hairline)] px-4 py-2 text-[10.5px] text-ink-4">
        Illustrative replay of a representative run. Your own scans report only what
        they actually found.
      </p>
    </div>
  );
}

/** Slow ticker of source names — ambient motion that also lists real providers. */
export function ProviderMarquee() {
  const providers = useMemo(
    () => [
      "arXiv", "OpenAlex", "Semantic Scholar", "Google Patents", "PatentsView",
      "Curated RSS", "Hacker News", "GitHub", "Reddit", "NewsAPI", "NewsData",
      "GNews", "Tavily",
    ],
    [],
  );
  // Duplicated so the -50% translate loops seamlessly.
  const doubled = [...providers, ...providers];

  return (
    <div
      className="relative overflow-hidden py-2"
      style={{
        maskImage:
          "linear-gradient(90deg, transparent, black 8%, black 92%, transparent)",
        WebkitMaskImage:
          "linear-gradient(90deg, transparent, black 8%, black 92%, transparent)",
      }}
    >
      <div className="anim-marquee flex w-max gap-3">
        {doubled.map((p, i) => (
          <span
            key={`${p}-${i}`}
            className="shrink-0 rounded-full border border-[var(--gl-hairline)] bg-current/[0.04] px-3 py-1 font-mono text-[11px] text-ink-3"
          >
            {p}
          </span>
        ))}
      </div>
    </div>
  );
}

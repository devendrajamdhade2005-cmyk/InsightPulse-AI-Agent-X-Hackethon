import { Link } from "react-router-dom";
import { cx } from "../lib/accents.js";
import { useReveal } from "../hooks/useReveal.js";
import { MarketingFooter, MarketingHeader } from "../components/marketing/Chrome.jsx";
import { LiveDemo, ProviderMarquee } from "../components/marketing/LiveDemo.jsx";
import { Donut3D } from "../components/charts/Charts3D.jsx";
import { Report3D } from "../components/reports/Report3D.jsx";
import {
  ArrowRight,
  Brain,
  ChartColumn,
  Check,
  FileDown,
  GitBranch,
  Shield,
  Target,
} from "../components/icons/index.jsx";

/* Landing page.
 *
 * Structure deliberately walks the reader down the design spectrum: the hero is
 * hard-edged and brutalist, the middle sections soften, and the last two run on the
 * glass canvas the workspace uses. By the time someone signs in, the dashboard's
 * look has already been introduced rather than sprung on them.
 *
 * Everything animates in on scroll, once, and stays visible if motion is disabled.
 */

function Reveal({ children, delay = 0, className, as: Tag = "div" }) {
  const ref = useReveal({ delay });
  return (
    <Tag ref={ref} className={cx("reveal", className)}>
      {children}
    </Tag>
  );
}

const CAPABILITIES = [
  {
    icon: Brain,
    accent: "var(--nb-purple)",
    title: "It reasons, not routes",
    body: "A real ReAct loop picks each next action from the current state. The same goal can produce a different tool sequence depending on what earlier calls returned.",
  },
  {
    icon: GitBranch,
    accent: "var(--nb-blue)",
    title: "Multi-agent orchestration",
    body: "A LangGraph StateGraph coordinates specialists scoped to disjoint tool sets, with parallel fan-out, checkpointing and autonomous replanning.",
  },
  {
    icon: Shield,
    accent: "var(--nb-green)",
    title: "Degrades, never breaks",
    body: "One failing provider never fails a run. Retry, circuit-break, fall back — and report the degradation rather than hiding it.",
  },
  {
    icon: ChartColumn,
    accent: "var(--nb-cyan)",
    title: "Measured, not asserted",
    body: "An evaluation suite scores the agent across adversarial, contradictory and tool-failure scenarios, and compares it against baselines.",
  },
  {
    icon: Target,
    accent: "var(--nb-pink)",
    title: "Prioritized output",
    body: "Every finding is scored for relevance, novelty and strategic significance, with the justification attached.",
  },
  {
    icon: FileDown,
    accent: "var(--nb-orange)",
    title: "Auditable reports",
    body: "Each insight leads with the actual publisher, and every provider's access model is listed in full.",
  },
];

const HONESTY = [
  "Simulated data is labelled everywhere — in the dashboard and in every export.",
  "When a metric cannot be derived, the UI shows a limited-data state, not a number.",
  "If no language model is available the agent says so and continues on its deterministic reasoner.",
  "Unverified forum content can never be rated high-priority on its own.",
];

const COVERAGE = [
  { label: "Research", count: 38, color: "var(--nb-blue)" },
  { label: "Patents", count: 21, color: "var(--nb-cyan)" },
  { label: "Competitors", count: 27, color: "var(--nb-orange)" },
  { label: "News", count: 24, color: "var(--nb-green)" },
  { label: "Live web", count: 14, color: "var(--nb-purple)" },
];

function Stat({ value, label, delay }) {
  return (
    <Reveal delay={delay} className="nb-frame-flat px-4 py-3 text-center">
      <b className="block font-mono text-2xl font-bold tabular-nums">{value}</b>
      <span className="nb-label mt-1 block">{label}</span>
    </Reveal>
  );
}

export default function Landing() {
  return (
    <div className="flex min-h-screen flex-col">
      <MarketingHeader />

      <main className="flex-1">
        {/* ══ HERO — full brutalist ══ */}
        <section className="relative overflow-hidden border-b-4 border-line">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:py-20">
            <div>
              <Reveal>
                <span className="nb-eyebrow">Autonomous research agent</span>
              </Reveal>

              <Reveal delay={80}>
                <h1 className="mt-5 text-4xl font-bold uppercase leading-[1.02] tracking-tight sm:text-5xl lg:text-6xl">
                  Stop reading
                  <br />
                  <span className="gl-gradient-text">everything.</span>
                  <br />
                  Know what moved.
                </h1>
              </Reveal>

              <Reveal delay={160}>
                <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-ink-2">
                  InsightPulse tracks research papers, patent filings, competitor
                  activity, industry news and the live web. It decides where to look,
                  reads what it finds, and delivers a prioritized briefing with the
                  reasoning attached.
                </p>
              </Reveal>

              <Reveal delay={240}>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Link
                    to="/signup"
                    className="nb-press group inline-flex items-center gap-2 border-2 border-line bg-brand-blue px-5 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-[var(--shadow-nb)]"
                  >
                    Start tracking
                    <ArrowRight
                      aria-hidden="true"
                      className="h-4 w-4 transition-transform group-hover:translate-x-1"
                      strokeWidth={2.6}
                    />
                  </Link>
                  <Link
                    to="/how-it-works"
                    className="nb-press inline-flex items-center gap-2 border-2 border-line bg-surface px-5 py-3 text-sm font-bold uppercase tracking-wide shadow-[var(--shadow-nb-sm)]"
                  >
                    See how it works
                  </Link>
                </div>
              </Reveal>

              <div className="mt-9 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat value="13" label="Providers" delay={300} />
                <Stat value="5" label="Agent tools" delay={360} />
                <Stat value="7" label="Scenarios" delay={420} />
                <Stat value="201" label="Tests" delay={480} />
              </div>
            </div>

            {/* the interactive replay — the first hint of the glass language */}
            <Reveal delay={200} className="lg:pl-2">
              <div className="anim-float">
                <LiveDemo />
              </div>
            </Reveal>
          </div>
        </section>

        {/* ══ PROVIDERS ══ */}
        <section className="border-b-4 border-line bg-bg-2 py-5">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <span className="nb-label mb-1 block text-center">
              Reading from
            </span>
            <ProviderMarquee />
          </div>
        </section>

        {/* ══ CAPABILITIES — softening ══ */}
        <section className="border-b-4 border-line">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
            <Reveal className="max-w-2xl">
              <span className="nb-eyebrow">Capabilities</span>
              <h2 className="mt-4 text-2xl font-bold uppercase tracking-tight sm:text-3xl">
                Built like infrastructure, not a demo
              </h2>
            </Reveal>

            <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {CAPABILITIES.map(({ icon: Icon, accent, title, body }, i) => (
                <Reveal key={title} delay={i * 70}>
                  <article className="nb-frame nb-lift h-full p-5">
                    <span
                      className="grid h-11 w-11 place-items-center border-2 border-line"
                      style={{
                        background: `color-mix(in oklab, ${accent} 16%, transparent)`,
                        color: accent,
                      }}
                    >
                      <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={2.3} />
                    </span>
                    <h3 className="mt-4 text-base font-bold uppercase tracking-tight">
                      {title}
                    </h3>
                    <p className="mt-2 text-[13px] leading-relaxed text-ink-2">{body}</p>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ══ HONESTY + COVERAGE — first glass canvas ══ */}
        <section className="gl-canvas border-b-4 border-line">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1fr]">
            <Reveal>
              <span className="nb-eyebrow">The part most tools skip</span>
              <h2 className="mt-4 text-2xl font-bold uppercase tracking-tight sm:text-3xl">
                It tells you what it does not know
              </h2>
              <p className="mt-3 text-[14px] leading-relaxed text-ink-2">
                An intelligence tool that quietly fabricates a number is worse than no
                tool. Every figure is computed from the actual run, and where something
                could not be derived, the interface says so.
              </p>

              <ul className="mt-6 grid gap-2.5">
                {HONESTY.map((line, i) => (
                  <Reveal
                    key={line}
                    delay={i * 90}
                    as="li"
                    className="gl-card flex items-start gap-3 p-3.5"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md"
                      style={{
                        background:
                          "color-mix(in oklab, var(--nb-green) 20%, transparent)",
                        color: "var(--nb-green)",
                      }}
                    >
                      <Check className="h-3 w-3" strokeWidth={3.2} />
                    </span>
                    <span className="text-[13px] leading-relaxed text-ink-2">
                      {line}
                    </span>
                  </Reveal>
                ))}
              </ul>
            </Reveal>

            <Reveal delay={150}>
              <div className="gl-card gl-card-lg p-6">
                <span className="nb-label">Typical coverage per scan</span>
                <div className="mt-4 grid items-center gap-6 sm:grid-cols-[13rem_1fr]">
                  <Donut3D slices={COVERAGE} size={190} centerLabel="findings" />
                  <ul className="grid gap-2">
                    {COVERAGE.map((s) => (
                      <li key={s.label} className="flex items-center gap-2.5 text-[12.5px]">
                        <span
                          aria-hidden="true"
                          className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                          style={{ background: s.color }}
                        />
                        <span className="flex-1 font-medium">{s.label}</span>
                        <b className="font-mono tabular-nums">{s.count}</b>
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="mt-4 border-t border-[var(--gl-hairline)] pt-3 text-[11.5px] text-ink-3">
                  Live providers and simulated providers are always reported separately.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ══ DELIVERABLE — full glass, 3D report ══ */}
        <section className="gl-canvas">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
            <Reveal className="max-w-2xl">
              <span className="nb-eyebrow">What you get</span>
              <h2 className="mt-4 text-2xl font-bold uppercase tracking-tight sm:text-3xl">
                A briefing you can hand to someone
              </h2>
              <p className="mt-3 text-[14px] leading-relaxed text-ink-2">
                Prioritized insights, the agent&apos;s full execution trail, detailed
                findings, source provenance and an explicit limitations section.
                Exportable as PDF, HTML, Markdown or JSON.
              </p>
            </Reveal>

            <Reveal delay={120} className="mt-9">
              <div className="gl-card gl-card-lg p-6 sm:p-9">
                <Report3D
                  pageCount={14}
                  onPreview={() => {}}
                  onDownload={() => {}}
                />
              </div>
            </Reveal>

            <Reveal delay={200} className="mt-10">
              <div className="gl-card gl-card-lg flex flex-col items-start gap-6 p-7 sm:p-10 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-xl">
                  <h2 className="text-2xl font-bold uppercase tracking-tight sm:text-3xl">
                    Run it on your own brief
                  </h2>
                  <p className="mt-3 text-[14px] leading-relaxed text-ink-2">
                    No API keys required to start. Providers without a key serve clearly
                    labelled synthetic data, and the interface always states which parts
                    were live.
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col">
                  <Link
                    to="/signup"
                    className="nb-press group inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--gl-hairline-strong)] bg-brand-blue px-6 py-3.5 text-sm font-bold uppercase tracking-wide text-white shadow-[var(--gl-shadow)]"
                  >
                    Create an account
                    <ArrowRight
                      aria-hidden="true"
                      className="h-4 w-4 transition-transform group-hover:translate-x-1"
                      strokeWidth={2.6}
                    />
                  </Link>
                  <Link
                    to="/signin"
                    className="nb-press inline-flex items-center justify-center rounded-xl border border-[var(--gl-hairline-strong)] bg-[var(--gl-panel-strong)] px-6 py-3 text-sm font-bold uppercase tracking-wide"
                  >
                    I already have one
                  </Link>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}

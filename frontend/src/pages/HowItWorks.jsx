import { useState } from "react";
import { Link } from "react-router-dom";
import { cx } from "../lib/accents.js";
import { useReveal } from "../hooks/useReveal.js";
import { MarketingFooter, MarketingHeader } from "../components/marketing/Chrome.jsx";
import { Bars3D } from "../components/charts/Charts3D.jsx";
import { ProgressRing } from "../components/ui/Loading.jsx";
import {
  ArrowRight,
  Beaker,
  Brain,
  Building2,
  ChartColumn,
  Check,
  Database,
  Eye,
  GitBranch,
  Handshake,
  ListChecks,
  Scale,
  Search,
  Shield,
  Target,
  Wrench,
} from "../components/icons/index.jsx";

/* "How it works".
 *
 * The loop is the product's central claim, so it is presented as an interactive
 * stepper rather than six stacked cards: clicking a stage swaps the detail panel.
 * Reading top-to-bottom still works, but exploring is faster than scrolling.
 *
 * Like the landing page, the treatment walks from brutalist to glass so the
 * workspace aesthetic is already familiar by the end.
 */

function Reveal({ children, delay = 0, className, as: Tag = "div" }) {
  const ref = useReveal({ delay });
  return (
    <Tag ref={ref} className={cx("reveal", className)}>
      {children}
    </Tag>
  );
}

const STAGES = [
  {
    icon: Target,
    accent: "var(--nb-blue)",
    title: "Understand the goal",
    body: "Your brief is read for intent, not keyword-matched. Topics, research focus, named companies, requested domains, time scope and constraints are extracted into a structured task context.",
    note: "A goal like “continue monitoring this” carries no subject, so the subject is restored from long-term memory.",
  },
  {
    icon: ListChecks,
    accent: "var(--nb-purple)",
    title: "Plan what must be learned",
    body: "The planner declares information needs and marks each required or conditional. Conditional needs are held back and only searched if the evidence justifies it.",
    note: "A patents-only goal never wakes the competitive agent, so no web-search quota is spent.",
  },
  {
    icon: Scale,
    accent: "var(--nb-cyan)",
    title: "Decide the next action",
    body: "Each iteration chooses one tool from the current state — evidence gathered so far, coverage gaps, detected signals and remaining budget.",
    note: "This is the step that makes it an agent rather than a pipeline: the order is not hard-coded.",
  },
  {
    icon: Wrench,
    accent: "var(--nb-orange)",
    title: "Call the tool",
    body: "Providers are queried concurrently behind one interface, with retry, jittered backoff, circuit-breaking and rate limiting.",
    note: "A tool costs its slowest provider instead of the sum of all of them.",
  },
  {
    icon: Eye,
    accent: "var(--nb-green)",
    title: "Observe and score",
    body: "Results are de-duplicated three ways, scored for relevance and novelty, and checked for strategic signals such as launches, funding or acquisitions.",
    note: "Real evidence outranks simulated evidence, which carries an explicit scoring penalty.",
  },
  {
    icon: Brain,
    accent: "var(--nb-pink)",
    title: "Analyze, then loop or finish",
    body: "If coverage is thin or a signal needs corroborating, the loop runs again with a different tool. Otherwise it writes the prioritized briefing.",
    note: "An observation can create work: research with commercial bearing can trigger a competitor check the goal never asked for.",
  },
];

const AGENTS = [
  {
    icon: Brain,
    accent: "var(--nb-purple)",
    name: "Intelligence Orchestrator",
    owns: "Decomposition, delegation, consolidation",
    tools: "no tools",
    answers: "Who should work on this, and what does it all mean together?",
  },
  {
    icon: Beaker,
    accent: "var(--nb-blue)",
    name: "Research Intelligence Agent",
    owns: "Academic and IP evidence",
    tools: "research_search · patent_search",
    answers: "What is technically real, and who filed it?",
  },
  {
    icon: Building2,
    accent: "var(--nb-orange)",
    name: "Competitive Intelligence Agent",
    owns: "Market and company activity",
    tools: "competitor_search · news_search · web_search",
    answers: "What are competitors actually shipping?",
  },
];

const RUNTIME = [
  ["Shared state", "Typed graph state with order-independent reducers, so parallel agents can write safely."],
  ["Conditional routing", "The next node is chosen from observed state — verify, replan or finalize."],
  ["Parallel fan-out", "Independent agents run in one superstep; reducers merge their results."],
  ["Checkpointing", "Resumable by thread id, after understand / plan / agents / verification / synthesis."],
  ["Failure recovery", "Real retry then fallback through the resilience layer. Failure is data, not a crash."],
  ["Conflict resolution", "Contradictions are detected, weighed by credibility, then resolved or verified."],
  ["Uncertainty", "Every claim carries confidence, evidence strength and verification status."],
  ["Resource governance", "Tool, model, step, time and cost budgets. Low-value work is dropped under pressure."],
];

const MEMORY = [
  ["TaskContext", "one run", "The structured reading of the goal"],
  ["WorkingMemory", "one run", "Plan state, findings that mattered, decisions, coverage gaps"],
  ["LongTermStore", "across runs", "What earned persistence, retrieved by relevance"],
];

const PERF = [
  { label: "research", value: 23, accent: "var(--nb-blue)" },
  { label: "news", value: 20, accent: "var(--nb-green)" },
  { label: "sweep", value: 19, accent: "var(--nb-orange)" },
  { label: "mixed", value: 59, accent: "var(--nb-purple)" },
];

/* ── interactive loop stepper ── */
function LoopStepper() {
  const [active, setActive] = useState(0);
  const stage = STAGES[active];
  const Icon = stage.icon;

  return (
    <div className="grid gap-5 lg:grid-cols-[19rem_1fr]">
      {/* stage rail */}
      <ol className="grid gap-1.5">
        {STAGES.map((s, i) => {
          const StageIcon = s.icon;
          const isActive = i === active;
          return (
            <li key={s.title}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-current={isActive ? "step" : undefined}
                className={cx(
                  "nb-press flex w-full items-center gap-3 border-2 px-3 py-2.5 text-left",
                  isActive
                    ? "border-line bg-surface shadow-[var(--shadow-nb-sm)]"
                    : "border-transparent hover:border-line hover:bg-surface/60",
                )}
              >
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center border-2 border-line transition-colors"
                  style={{
                    background: isActive
                      ? s.accent
                      : `color-mix(in oklab, ${s.accent} 14%, transparent)`,
                    color: isActive ? "#fff" : s.accent,
                  }}
                >
                  <StageIcon aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="nb-label block text-[9px]">
                    Stage {String(i + 1).padStart(2, "0")}
                  </span>
                  <b className="block truncate text-[13px] font-bold">{s.title}</b>
                </span>
                {isActive ? (
                  <ArrowRight
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0"
                    strokeWidth={2.8}
                  />
                ) : null}
              </button>
            </li>
          );
        })}
      </ol>

      {/* detail */}
      <div className="nb-frame flex flex-col p-6">
        <div className="flex items-start justify-between gap-4">
          <span
            className="grid h-14 w-14 shrink-0 place-items-center border-2 border-line"
            style={{
              background: `color-mix(in oklab, ${stage.accent} 16%, transparent)`,
              color: stage.accent,
            }}
          >
            <Icon aria-hidden="true" className="h-6 w-6" strokeWidth={2.2} />
          </span>
          <ProgressRing
            value={(active + 1) / STAGES.length}
            size={46}
            stroke={4}
            style={{ color: stage.accent }}
            className="shrink-0"
            label="Stage progress"
          >
            {active + 1}/{STAGES.length}
          </ProgressRing>
        </div>

        {/* keyed so the content re-animates on each switch */}
        <div key={active} className="anim-rise-sm mt-5">
          <h3 className="text-xl font-bold uppercase tracking-tight">{stage.title}</h3>
          <p className="mt-3 text-[14px] leading-relaxed text-ink-2">{stage.body}</p>
          <p
            className="mt-4 border-l-[4px] pl-3.5 text-[13px] italic text-ink-3"
            style={{ borderColor: stage.accent }}
          >
            {stage.note}
          </p>
        </div>

        <div className="mt-auto flex items-center gap-2 pt-6">
          <button
            type="button"
            onClick={() => setActive((i) => (i - 1 + STAGES.length) % STAGES.length)}
            className="nb-press border-2 border-line bg-surface px-3 py-1.5 text-[12px] font-bold uppercase tracking-wide"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setActive((i) => (i + 1) % STAGES.length)}
            className="nb-press border-2 border-line bg-brand-blue px-3 py-1.5 text-[12px] font-bold uppercase tracking-wide text-white"
          >
            Next stage
          </button>
        </div>
      </div>
    </div>
  );
}

export default function HowItWorks() {
  return (
    <div className="flex min-h-screen flex-col">
      <MarketingHeader />

      <main className="flex-1">
        {/* ══ intro ══ */}
        <section className="border-b-4 border-line">
          <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:py-20">
            <Reveal>
              <span className="nb-eyebrow">How it works</span>
            </Reveal>
            <Reveal delay={80}>
              <h1 className="mt-5 text-3xl font-bold uppercase leading-[1.05] tracking-tight sm:text-4xl lg:text-5xl">
                A reasoning loop,
                <br />
                <span className="gl-gradient-text">not a search wrapper</span>
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="mt-5 text-[15px] leading-relaxed text-ink-2">
                Most “AI research tools” run a fixed sequence of queries and summarise
                the output. InsightPulse decides what to do next from what it has
                already found — which means two runs of the same goal can legitimately
                take different paths, and the trail of those decisions is shown to you.
              </p>
            </Reveal>
          </div>
        </section>

        {/* ══ the loop ══ */}
        <section className="border-b-4 border-line bg-bg-2">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <Reveal className="mb-8 max-w-2xl">
              <span className="nb-eyebrow">The loop</span>
              <h2 className="mt-4 text-2xl font-bold uppercase tracking-tight sm:text-3xl">
                Six stages, repeated until the evidence is enough
              </h2>
              <p className="mt-2 text-[13.5px] text-ink-3">
                Pick a stage to see what actually happens in it.
              </p>
            </Reveal>
            <Reveal delay={100}>
              <LoopStepper />
            </Reveal>
          </div>
        </section>

        {/* ══ agents ══ */}
        <section className="border-b-4 border-line">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <Reveal className="max-w-3xl">
              <span className="nb-eyebrow">Multi-agent architecture</span>
              <h2 className="mt-4 text-2xl font-bold uppercase tracking-tight sm:text-3xl">
                Specialisation is structural, not cosmetic
              </h2>
              <p className="mt-3 text-[14px] leading-relaxed text-ink-2">
                Each specialist is scoped to a disjoint set of tools, so it physically
                cannot do the other&apos;s job. The orchestrator only recruits the
                agents it needs, and every selected or skipped decision is logged with
                its reason.
              </p>
            </Reveal>

            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              {AGENTS.map(({ icon: Icon, accent, name, owns, tools, answers }, i) => (
                <Reveal key={name} delay={i * 90}>
                  <article
                    className="nb-frame nb-lift h-full border-t-[6px] p-5"
                    style={{ borderTopColor: accent }}
                  >
                    <span
                      className="grid h-11 w-11 place-items-center border-2 border-line"
                      style={{
                        background: `color-mix(in oklab, ${accent} 16%, transparent)`,
                        color: accent,
                      }}
                    >
                      <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={2.3} />
                    </span>
                    <h3 className="mt-4 text-[15px] font-bold uppercase tracking-tight">
                      {name}
                    </h3>
                    <dl className="mt-3 grid gap-2 text-[12.5px]">
                      <div>
                        <dt className="nb-label">Owns</dt>
                        <dd className="mt-0.5 text-ink-2">{owns}</dd>
                      </div>
                      <div>
                        <dt className="nb-label">Tools</dt>
                        <dd className="mt-0.5 font-mono text-[11.5px] text-ink-2">
                          {tools}
                        </dd>
                      </div>
                    </dl>
                    <p className="mt-3 border-t-2 border-line pt-3 text-[13px] italic text-ink-2">
                      “{answers}”
                    </p>
                  </article>
                </Reveal>
              ))}
            </div>

            <Reveal delay={200} className="mt-5">
              <div className="nb-frame flex items-start gap-3.5 p-5">
                <Handshake
                  aria-hidden="true"
                  className="mt-0.5 h-5 w-5 shrink-0 text-brand-purple"
                  strokeWidth={2.3}
                />
                <div>
                  <h3 className="text-[14px] font-bold uppercase tracking-tight">
                    Agents genuinely collaborate
                  </h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
                    <b>Corroboration</b> fires when both agents surface the same event —
                    a shared company or market signal plus meaningful title overlap.
                    Confidence rises and both source URLs are retained.{" "}
                    <b>Handoff</b> fires when a competitive signal is topically backed by
                    the other agent&apos;s technical evidence. Every finding carries who
                    discovered it, and that attribution survives into the API, the
                    dashboard and the PDF.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ══ runtime — first glass ══ */}
        <section className="gl-canvas border-b-4 border-line">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <Reveal className="max-w-3xl">
              <div className="flex items-center gap-2.5">
                <GitBranch
                  aria-hidden="true"
                  className="h-5 w-5 text-brand-blue"
                  strokeWidth={2.3}
                />
                <span className="nb-eyebrow">LangGraph runtime</span>
              </div>
              <h2 className="mt-4 text-2xl font-bold uppercase tracking-tight sm:text-3xl">
                Stateful, cyclic, and observable
              </h2>
              <p className="mt-3 text-[14px] leading-relaxed text-ink-2">
                The loop runs inside a LangGraph{" "}
                <span className="font-mono">StateGraph</span>. The planner,
                specialists, tool registry, resilience layer and memory manager are
                reused unchanged — LangGraph coordinates them, it does not replace them.
              </p>
            </Reveal>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {RUNTIME.map(([title, body], i) => (
                <Reveal key={title} delay={i * 50}>
                  <div className="gl-card h-full p-4">
                    <b className="block text-[13px] font-bold uppercase tracking-tight">
                      {title}
                    </b>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-2">
                      {body}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>

            {/* performance, as a dimensional chart */}
            <Reveal delay={120} className="mt-8">
              <div className="gl-card gl-card-lg p-6">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <span className="nb-label">Concurrency gain</span>
                    <h3 className="mt-1 text-lg font-bold uppercase tracking-tight">
                      Percent faster after parallel fan-out
                    </h3>
                  </div>
                  <span className="text-[12px] text-ink-3">
                    measured on live APIs
                  </span>
                </div>
                <Bars3D
                  data={PERF}
                  height={210}
                  unit={34}
                  valueFormat={(v) => `${v}%`}
                  className="mt-4"
                />
                <p className="mt-2 border-t border-[var(--gl-hairline)] pt-3 text-[11.5px] text-ink-3">
                  Providers are queried concurrently, so a tool costs its slowest
                  provider rather than the sum of all of them. The competitor sweep
                  gained most because it fans out twice.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ══ memory ══ */}
        <section className="gl-canvas border-b-4 border-line">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
            <Reveal>
              <div className="flex items-center gap-2.5">
                <Database
                  aria-hidden="true"
                  className="h-5 w-5 text-brand-cyan"
                  strokeWidth={2.3}
                />
                <span className="nb-eyebrow">Context &amp; memory</span>
              </div>
              <h2 className="mt-4 text-2xl font-bold uppercase tracking-tight sm:text-3xl">
                Three layers, deliberately separated
              </h2>
            </Reveal>

            <div className="mt-7 grid gap-2.5">
              {MEMORY.map(([layer, lifetime, holds], i) => (
                <Reveal key={layer} delay={i * 80}>
                  <div className="gl-card grid items-baseline gap-2 p-4 sm:grid-cols-[12rem_7rem_1fr]">
                    <b className="font-mono text-[13px] font-bold">{layer}</b>
                    <span className="w-fit rounded-full border border-[var(--gl-hairline)] bg-current/[0.05] px-2.5 py-0.5 text-[11px] font-bold uppercase">
                      {lifetime}
                    </span>
                    <span className="text-[13px] text-ink-2">{holds}</span>
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal delay={150} className="mt-6 grid gap-3">
              <p className="text-[13.5px] leading-relaxed text-ink-2">
                Context sharing is <b>selective</b>. Each agent receives a packet built
                for its objective rather than the whole run history, and every packet
                records what was withheld and why. Shared context also changes
                behaviour: terms drawn from one agent&apos;s findings become the next
                agent&apos;s search focus, so a follow-up query is shaped by what was
                already learned instead of repeating the original goal.
              </p>
              <p className="text-[13.5px] leading-relaxed text-ink-2">
                Long-term memory is <b>selective and honest</b>. Only high-importance
                items persist; transient errors, duplicates and all simulated data are
                rejected at the door, so a keyless demo can never manufacture a fake
                history.
              </p>
            </Reveal>
          </div>
        </section>

        {/* ══ evaluation + cta ══ */}
        <section className="gl-canvas">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
            <Reveal>
              <div className="flex items-center gap-2.5">
                <ChartColumn
                  aria-hidden="true"
                  className="h-5 w-5 text-brand-green"
                  strokeWidth={2.3}
                />
                <span className="nb-eyebrow">Evaluation</span>
              </div>
              <h2 className="mt-4 text-2xl font-bold uppercase tracking-tight sm:text-3xl">
                Quality is measured, not claimed
              </h2>
              <p className="mt-3 text-[14px] leading-relaxed text-ink-2">
                A benchmark suite runs the real agent across seven scenario classes —
                normal, ambiguous, adversarial, contradictory, incomplete, tool-failure
                and unsupported-conclusion — then scores accuracy, groundedness,
                hallucination rate, recovery, robustness, consistency, latency and
                resource efficiency, with repeated runs and baseline comparison.
              </p>
            </Reveal>

            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              {[
                [Search, "Traced", "Every run produces a span tree: agent, decision, prompt shape, tool, provider, latency, tokens, errors."],
                [Shield, "Diagnosed", "Root cause is inferred from the trace with evidence and a confidence score."],
                [Check, "Verified", "A bounded runtime change is applied, the scenario re-run, and the result accepted only if quality did not regress."],
              ].map(([Icon, title, body], i) => (
                <Reveal key={title} delay={i * 90}>
                  <div className="gl-card h-full p-4">
                    <Icon
                      aria-hidden="true"
                      className="h-5 w-5 text-brand-blue"
                      strokeWidth={2.3}
                    />
                    <b className="mt-3 block text-[13px] font-bold uppercase tracking-tight">
                      {title}
                    </b>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-2">
                      {body}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal delay={150} className="mt-10">
              <div className="gl-card gl-card-lg p-8 text-center sm:p-10">
                <h2 className="text-2xl font-bold uppercase tracking-tight sm:text-3xl">
                  Run it on your own brief
                </h2>
                <p className="mx-auto mt-3 max-w-xl text-[14px] text-ink-2">
                  No API keys required to start. Providers without a key serve clearly
                  labelled synthetic data, and the interface always states which parts
                  were live.
                </p>
                <Link
                  to="/signup"
                  className="nb-press group mt-6 inline-flex items-center gap-2 rounded-xl border border-[var(--gl-hairline-strong)] bg-brand-blue px-6 py-3.5 text-sm font-bold uppercase tracking-wide text-white shadow-[var(--gl-shadow)]"
                >
                  Create an account
                  <ArrowRight
                    aria-hidden="true"
                    className="h-4 w-4 transition-transform group-hover:translate-x-1"
                    strokeWidth={2.6}
                  />
                </Link>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
